import * as routopia from 'routopia'
import { test } from 'vitest'
import { defineRoutes, type } from '../dist/index.mjs'

const BASE_URL = 'https://api.example.com'

const ru = defineRoutes({
  baseUrl: BASE_URL,
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: {
        query: {
          page: type.optional(type.number),
          tag: type.optional(type.array(type.string)),
        },
      },
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number }, hash: type.optional(type.string) },
    }),
    '/users/[id]/posts/[postId]': type.route({
      get: {
        params: { id: type.number, postId: type.string },
        query: {
          page: type.optional(type.number),
          tag: type.optional(type.array(type.string)),
        },
        hash: type.optional(type.string),
      },
    }),
  },
})

const ro = routopia.routes(BASE_URL, {
  '/health': { get: routopia.empty },
  '/users': {
    get: {
      queries: {
        page: routopia.type as number | undefined,
        tag: routopia.type as string[] | undefined,
      },
    },
  },
  '/users/[id]': {
    get: {
      params: { id: routopia.type as number },
      hash: routopia.type as string,
    },
  },
  '/users/[id]/posts/[postId]': {
    get: {
      params: {
        id: routopia.type as number,
        postId: routopia.type as string,
      },
      queries: {
        page: routopia.type as number | undefined,
        tag: routopia.type as string[] | undefined,
      },
      hash: routopia.type as string,
    },
  },
})

test('パラメータなし', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ru['/health']()
    }),
    bench('routopia', () => {
      ro['/health'].get()
    }),
  )
})

test('パスパラメータ + hash', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ru['/users/[id]']({ p: { id: 123 }, h: 'top' })
    }),
    bench('routopia', () => {
      ro['/users/[id]'].get({ params: { id: 123 }, hash: 'top' })
    }),
  )
})

test('クエリ(配列を含む)', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ru['/users']({ q: { page: 2, tag: ['a', 'b c'] } })
    }),
    bench('routopia', () => {
      ro['/users'].get({ queries: { page: 2, tag: ['a', 'b c'] } })
    }),
  )
})

test('params + query + hash', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ru['/users/[id]/posts/[postId]']({
        p: { id: 1, postId: 'a b' },
        q: { page: 2, tag: ['x', 'y'] },
        h: 'top',
      })
    }),
    bench('routopia', () => {
      ro['/users/[id]/posts/[postId]'].get({
        params: { id: 1, postId: 'a b' },
        queries: { page: 2, tag: ['x', 'y'] },
        hash: 'top',
      })
    }),
  )
})

const ruAbs = defineRoutes({
  routes: {
    'https://api.example3.com/users/[id]': type.route({
      get: { params: { id: type.number } },
    }),
  },
})

const roAbs = routopia.routes({
  'https://api.example3.com/users/[id]': {
    get: { params: { id: routopia.type as number } },
  },
})

test('絶対 URL のキー', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ruAbs['https://api.example3.com/users/[id]']({ p: { id: 1 } })
    }),
    bench('routopia', () => {
      roAbs['https://api.example3.com/users/[id]'].get({ params: { id: 1 } })
    }),
  )
})

const PATHS = Array.from({ length: 100 }, (_, i) => `/resource${i}/[id]`)
// ループ内でモジュールの export getter を参照しないよう、先に取り出しておく
const { route, number } = type
type GeneratedPath = `/resource${number}/[id]`
const generatedRuroute = route({ get: { params: { id: number } } })
const generatedRoutopia = {
  get: { params: { id: routopia.type as number } },
} as const

test('ルート定義(100 ルート)', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      defineRoutes({
        baseUrl: BASE_URL,
        routes: Object.fromEntries(PATHS.map((path) => [path, route({ get: { params: { id: number } } })])) as Record<
          GeneratedPath,
          typeof generatedRuroute
        >,
      })
    }),
    bench('routopia', () => {
      routopia.routes(
        BASE_URL,
        Object.fromEntries(PATHS.map((path) => [path, { get: { params: { id: routopia.type as number } } }])) as Record<
          GeneratedPath,
          typeof generatedRoutopia
        >,
      )
    }),
  )
})
