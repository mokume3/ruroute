import { test } from 'vitest'
import { defineRoutes, type } from '../dist/index.mjs'

// routopia との比較は url.bench.ts。ここは ruroute の内部の変更の効果と退行を見るためのケース

const ROUTE_COUNT = 100
const LONG_ARRAY_LENGTH = 100
// ループ内でモジュールの export getter を参照しないよう、先に取り出しておく
const { route, number, empty } = type

type ParamPath = `/resource${number}/[id]`
type StaticPath = `/static${number}`

const paramRoute = route({ get: { params: { id: number } } })
const PARAM_PATHS = Array.from({ length: ROUTE_COUNT }, (_, index): ParamPath => `/resource${index}/[id]`)
const STATIC_PATHS = Array.from({ length: ROUTE_COUNT }, (_, index): StaticPath => `/static${index}`)

const buildParamRoutes = () => {
  const routes: Record<ParamPath, typeof paramRoute> = {}
  for (const path of PARAM_PATHS) routes[path] = route({ get: { params: { id: number } } })
  return routes
}

const buildStaticRoutes = () => {
  const routes: Record<StaticPath, typeof empty> = {}
  for (const path of STATIC_PATHS) routes[path] = empty
  return routes
}

const paramRoutes = buildParamRoutes()
const staticRoutes = buildStaticRoutes()

test(`ルート定義の内訳(${ROUTE_COUNT} ルート)`, async ({ bench }) => {
  await bench.compare(
    bench('設定オブジェクトの構築(type.route)', () => {
      buildParamRoutes()
    }),
    bench('defineRoutes だけ(type.route)', () => {
      defineRoutes({ routes: paramRoutes })
    }),
    bench('defineRoutes だけ(type.empty)', () => {
      defineRoutes({ routes: staticRoutes })
    }),
  )
})

const definedParamRoutes = defineRoutes({ routes: paramRoutes })

const callEach = (routes: typeof definedParamRoutes) => {
  for (let index = 0; index < ROUTE_COUNT; index++) routes[PARAM_PATHS[index]]({ p: { id: index } })
}

callEach(definedParamRoutes)

// 初回の呼び出しはパスの分割(遅延)を含む。「定義 + 初回」から「定義だけ」を引いた値を「2 回目以降」と比べる
test(`初回の呼び出しと 2 回目以降(${ROUTE_COUNT} ルートを 1 回ずつ)`, async ({ bench }) => {
  await bench.compare(
    bench('定義だけ', () => {
      defineRoutes({ routes: paramRoutes })
    }),
    bench('定義 + 初回の呼び出し', () => {
      callEach(defineRoutes({ routes: paramRoutes }))
    }),
    bench('2 回目以降の呼び出し', () => {
      callEach(definedParamRoutes)
    }),
  )
})

const optionalString = type.optional(type.string)

const routes = defineRoutes({
  routes: {
    '/items/[id]': route({ get: { params: { id: type.union([type.string, number]) } } }),
    '/search': route({
      get: {
        query: {
          k0: optionalString,
          k1: optionalString,
          k2: optionalString,
          k3: optionalString,
          k4: optionalString,
          k5: optionalString,
          k6: optionalString,
          k7: optionalString,
          k8: optionalString,
          k9: optionalString,
          tags: type.optional(type.array(type.string)),
        },
      },
    }),
  },
})

test('パスパラメータの値', async ({ bench }) => {
  const item = routes['/items/[id]']
  await bench.compare(
    bench('数値', () => {
      item({ p: { id: 123 } })
    }),
    bench('変換が要らない文字列', () => {
      item({ p: { id: 'my-slug_01' } })
    }),
    bench('空白を含む文字列', () => {
      item({ p: { id: 'a b' } })
    }),
    bench('日本語', () => {
      item({ p: { id: '東京都' } })
    }),
  )
})

const SAFE_QUERY = {
  k0: 'v0',
  k1: 'v1',
  k2: 'v2',
  k3: 'v3',
  k4: 'v4',
  k5: 'v5',
  k6: 'v6',
  k7: 'v7',
  k8: 'v8',
  k9: 'v9',
}
const UNSAFE_QUERY = {
  k0: 'a b',
  k1: 'a&b',
  k2: 'a=b',
  k3: 'a+b',
  k4: 'a/b',
  k5: 'a?b',
  k6: 'a#b',
  k7: '東京',
  k8: 'a%b',
  k9: 'a,b',
}
const LONG_ARRAY = Array.from({ length: LONG_ARRAY_LENGTH }, (_, index) => `tag${index}`)

test('クエリの形', async ({ bench }) => {
  const search = routes['/search']
  await bench.compare(
    bench('クエリなし', () => {
      search()
    }),
    bench('空のクエリ', () => {
      search({ q: {} })
    }),
    bench('1 キー', () => {
      search({ q: { k0: 'v0' } })
    }),
    bench('10 キー(変換が要らない値)', () => {
      search({ q: SAFE_QUERY })
    }),
    bench('10 キー(変換が要る値)', () => {
      search({ q: UNSAFE_QUERY })
    }),
    bench(`配列(${LONG_ARRAY_LENGTH} 要素)`, () => {
      search({ q: { tags: LONG_ARRAY } })
    }),
  )
})
