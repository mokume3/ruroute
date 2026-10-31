import { expectTypeOf, test } from 'vitest'
import { defineRoutes, type RouteArgs, type RouteDef, type RoutePath, type, type ValidRoutes } from '../src'

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
