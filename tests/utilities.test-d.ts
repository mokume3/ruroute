import { expectTypeOf, test } from 'vitest'
import {
  defineRoutes,
  type RouteArgs,
  type RouteDef,
  type RouteHash,
  type RouteParams,
  type RoutePath,
  type RouteQuery,
  type RouteUrl,
  type,
  type ValidRoutes,
} from '../src'

const routes = defineRoutes({
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: { query: { page: type.optional(type.number) } },
      post: type.empty,
    }),
    '/search': type.route({ get: { query: { word: type.string } } }),
    '/users/[id]': type.route({ delete: { params: { id: type.number } } }),
  },
})

test('RoutePath はパスのユニオン', () => {
  expectTypeOf<RoutePath<typeof routes>>().toEqualTypeOf<'/health' | '/users' | '/search' | '/users/[id]'>()
})

test('RouteArgs は呼び出し引数の型', () => {
  type DeleteArgs = RouteArgs<typeof routes, '/users/[id]', 'delete'>
  expectTypeOf<DeleteArgs>().toEqualTypeOf<Parameters<(typeof routes)['/users/[id]']['delete']>[0]>()

  const args: RouteArgs<typeof routes, '/search', 'get'> = { q: { word: 'a' } }
  routes['/search'](args)

  // 省略可能な引数でも undefined を含まない
  expectTypeOf<undefined extends RouteArgs<typeof routes, '/users', 'get'> ? true : false>().toEqualTypeOf<false>()
  const optional: RouteArgs<typeof routes, '/users', 'get'> = {}
  routes['/users'](optional)
})

test('引数を取らないメソッドは never', () => {
  expectTypeOf<RouteArgs<typeof routes, '/users', 'post'>>().toBeNever()
  expectTypeOf<RouteArgs<typeof routes, '/health', 'get'>>().toBeNever()
})

test('未定義メソッドはエラー', () => {
  // @ts-expect-error /users に delete はない
  expectTypeOf<RouteArgs<typeof routes, '/users', 'delete'>>()
})

test('M にユニオンを渡すと各メソッドの引数型のユニオンになる', () => {
  const r = defineRoutes({
    routes: {
      '/u/[id]': type.route({
        get: { params: { id: type.number } },
        delete: { params: { id: type.string } },
      }),
    },
  })
  type Args = RouteArgs<typeof r, '/u/[id]', 'get' | 'delete'>
  expectTypeOf<Args>().toEqualTypeOf<RouteArgs<typeof r, '/u/[id]', 'get'> | RouteArgs<typeof r, '/u/[id]', 'delete'>>()
  const byNumber: Args = { p: { id: 1 } }
  const byString: Args = { p: { id: 'x' } }
  void byNumber
  void byString
})

const detailed = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/health': type.empty,
    '/items/[id]': type.route({
      get: {
        params: { id: type.number },
        query: { tag: type.string, page: type.optional(type.number) },
        hash: type.literal(['top', 'bottom']),
      },
      put: {
        params: { id: type.union([type.string, type.number]) },
        query: { dryRun: type.optional(type.boolean) },
        hash: type.optional(type.string),
      },
      delete: { params: { id: type.number } },
    }),
    '/search': type.route({ get: { query: { word: type.string } } }),
  },
})
type Detailed = typeof detailed

test('RouteParams は params の値の型', () => {
  expectTypeOf<RouteParams<Detailed, '/items/[id]', 'get'>>().toEqualTypeOf<{ id: number }>()
  expectTypeOf<RouteParams<Detailed, '/items/[id]', 'put'>>().toEqualTypeOf<{ id: string | number }>()

  const params: RouteParams<Detailed, '/items/[id]', 'delete'> = { id: 1 }
  detailed['/items/[id]'].delete({ params })
  detailed['/items/[id]'].delete({ p: params })
})

test('RouteQuery は query の値の型', () => {
  expectTypeOf<RouteQuery<Detailed, '/items/[id]', 'get'>>().toEqualTypeOf<{ tag: string; page?: number }>()

  const query: RouteQuery<Detailed, '/items/[id]', 'get'> = { tag: 'a' }
  detailed['/items/[id]']({ p: { id: 1 }, query, h: 'top' })
  detailed['/items/[id]']({ p: { id: 1 }, q: query, h: 'top' })

  // query 全体を省略できるメソッドでも undefined を含まない
  expectTypeOf<RouteQuery<Detailed, '/items/[id]', 'put'>>().toEqualTypeOf<{ dryRun?: boolean }>()
})

test('RouteHash は hash の値の型', () => {
  expectTypeOf<RouteHash<Detailed, '/items/[id]', 'get'>>().toEqualTypeOf<'top' | 'bottom'>()
  // 省略できる hash でも undefined を含まない
  expectTypeOf<RouteHash<Detailed, '/items/[id]', 'put'>>().toEqualTypeOf<string>()
})

test('定義していない部分は never', () => {
  expectTypeOf<RouteParams<Detailed, '/search', 'get'>>().toBeNever()
  expectTypeOf<RouteQuery<Detailed, '/items/[id]', 'delete'>>().toBeNever()
  expectTypeOf<RouteHash<Detailed, '/items/[id]', 'delete'>>().toBeNever()
  expectTypeOf<RouteParams<Detailed, '/health', 'get'>>().toBeNever()
  expectTypeOf<RouteQuery<Detailed, '/health', 'get'>>().toBeNever()
  expectTypeOf<RouteHash<Detailed, '/health', 'get'>>().toBeNever()
})

test('RouteParams などは M のユニオンに分配する', () => {
  expectTypeOf<RouteParams<Detailed, '/items/[id]', 'get' | 'put'>>().toEqualTypeOf<
    { id: number } | { id: string | number }
  >()
  expectTypeOf<RouteHash<Detailed, '/items/[id]', 'get' | 'delete'>>().toEqualTypeOf<'top' | 'bottom'>()
})

test('RouteUrl は返り値の URL の型', () => {
  expectTypeOf<RouteUrl<Detailed, '/health', 'get'>>().toEqualTypeOf<'https://api.example.com/health'>()
  expectTypeOf<RouteUrl<Detailed, '/items/[id]', 'delete'>>().toEqualTypeOf<`https://api.example.com/items/${number}`>()
  expectTypeOf<RouteUrl<Detailed, '/items/[id]', 'delete' | 'put'>>().toEqualTypeOf<
    RouteUrl<Detailed, '/items/[id]', 'delete'> | RouteUrl<Detailed, '/items/[id]', 'put'>
  >()

  // query や hash を持つメソッドでは、どの呼び出しの返り値も代入できる
  const fromLiteral: RouteUrl<Detailed, '/search', 'get'> = detailed['/search']({ q: { word: 'a' } })
  const getArgs: RouteArgs<Detailed, '/items/[id]', 'get'> = { p: { id: 1 }, q: { tag: 'a', page: 2 }, h: 'top' }
  const fromVariable: RouteUrl<Detailed, '/items/[id]', 'get'> = detailed['/items/[id]'](getArgs)
  const fromOmitted: RouteUrl<Detailed, '/items/[id]', 'put'> = detailed['/items/[id]'].put({ p: { id: 'a' } })
  void fromLiteral
  void fromVariable
  void fromOmitted
  expectTypeOf<RouteUrl<Detailed, '/search', 'get'>>().toExtend<`https://api.example.com/search?word=${string}`>()
})

test('RouteUrl などで未定義メソッドはエラー', () => {
  // @ts-expect-error /search に delete はない
  expectTypeOf<RouteUrl<Detailed, '/search', 'delete'>>()
  // @ts-expect-error /search に delete はない
  expectTypeOf<RouteParams<Detailed, '/search', 'delete'>>()
})

const BASE = 'https://api.example.com'

// routopia の README「Best Practice」と同じく、baseUrl を固定した wrapper
function createApi<R extends Record<string, RouteDef>>(routes: ValidRoutes<R, typeof BASE>) {
  return defineRoutes({ baseUrl: BASE, routes })
}

test('ValidRoutes で baseUrl を固定した wrapper を書ける', () => {
  const api = createApi({
    '/users': type.empty,
    '/users/[id]': type.route({ get: { params: { id: type.number } } }),
  })
  expectTypeOf<RoutePath<typeof api>>().toEqualTypeOf<'/users' | '/users/[id]'>()
  expectTypeOf(api['/users/[id]']({ p: { id: 1 } })).toEqualTypeOf<`https://api.example.com/users/${number}`>()

  // @ts-expect-error params の書き漏れ
  createApi({ '/users/[id]': type.empty })
  createApi({
    // @ts-expect-error baseUrl を固定した wrapper に絶対 URL
    'https://x.example.com/a': type.empty,
  })
  // @ts-expect-error 定義していないパス
  void api['/nope']
})
