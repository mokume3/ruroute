import { test } from 'vitest'
import { defineRoutes, type } from '../src'

test('正しい定義は通る', () => {
  defineRoutes({
    routes: {
      '/a': type.empty,
      '/b': type.route({
        get: { query: { x: type.string } },
        post: type.empty,
      }),
      '/c/[id]': type.route({
        get: { params: { id: type.number } },
        delete: { params: { id: type.string } },
      }),
      '/d/[a]/e/[b]': type.route({
        put: { params: { a: type.number, b: type.string } },
      }),
    },
  })
})

test('パスにある params の書き漏れはエラー', () => {
  defineRoutes({
    routes: {
      // @ts-expect-error params がない
      '/a/[id]': type.route({ get: { query: { x: type.string } } }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error type.empty だが params が必要
      '/a/[id]': type.empty,
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error メソッドの type.empty だが params が必要
      '/a/[id]': type.route({ delete: type.empty }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error id2 がない
      '/a/[id]/[id2]': type.route({ get: { params: { id: type.number } } }),
    },
  })
})

test('パスにない params キーはエラー', () => {
  defineRoutes({
    routes: {
      // @ts-expect-error extra はパスにない
      '/a/[id]': type.route({
        get: { params: { id: type.number, extra: type.string } },
      }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error パスに [..] がないのに params
      '/a': type.route({ get: { params: { id: type.number } } }),
    },
  })
})

test('複数メソッド・複数パラメータ・空の params', () => {
  defineRoutes({
    routes: {
      // @ts-expect-error post だけ params がない
      '/a/[id]': type.route({
        get: { params: { id: type.number } },
        post: { query: { x: type.string } },
      }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error 複数パラメータで余分なキー z
      '/a/[x]/[y]': type.route({
        get: { params: { x: type.number, y: type.number, z: type.number } },
      }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error パラメータのあるパスに params: {}
      '/a/[id]': type.route({ get: { params: {} } }),
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error パラメータのないパスに params: {}
      '/a': type.route({ get: { params: {} } }),
    },
  })
})
