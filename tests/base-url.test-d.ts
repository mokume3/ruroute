import { expectTypeOf, test } from 'vitest'
import { defineRoutes, type Empty, type, type ValidRoutes } from '../src'

declare const envBase: string
declare const maybeBase: string | undefined

type KeyError = 'baseUrl を指定したときはキーを / で始まるパスにしてください'

test('baseUrl なしなら絶対 URL・独自スキームのキーを書ける', () => {
  defineRoutes({
    routes: {
      'https://a.example.com/x': type.empty,
      'myapp://items/[id]': type.route({
        get: { params: { id: type.number } },
      }),
    },
  })
})

test('baseUrl ありならパスのキーは通る', () => {
  defineRoutes({
    baseUrl: 'https://a.example.com',
    routes: {
      '/x': type.empty,
      '/u/[id]': type.route({ get: { params: { id: type.number } } }),
    },
  })
  const withEnv = defineRoutes({
    baseUrl: envBase,
    routes: { '/x': type.empty },
  })
  expectTypeOf(withEnv['/x']()).toEqualTypeOf<`${string}/x`>()
  defineRoutes({ baseUrl: 'myapp://', routes: { '/items': type.empty } })
})

test('baseUrl ありで / で始まらないキーはエラー', () => {
  defineRoutes({
    baseUrl: 'https://a.example.com',
    routes: {
      // @ts-expect-error 絶対 URL
      'https://b.example.com/x': type.empty,
    },
  })
  defineRoutes({
    baseUrl: envBase,
    routes: {
      // @ts-expect-error プロトコル相対
      '//b.example.com/x': type.empty,
    },
  })
  defineRoutes({
    baseUrl: envBase,
    routes: {
      // @ts-expect-error 先頭の / がない
      users: type.empty,
    },
  })
})

test('baseUrl が string | undefined でも検査する', () => {
  const withMaybeBase = defineRoutes({
    baseUrl: maybeBase,
    routes: { '/x': type.empty },
  })
  expectTypeOf(withMaybeBase['/x']()).toEqualTypeOf<'/x' | `${string}/x`>()
  defineRoutes({
    baseUrl: maybeBase,
    routes: {
      // @ts-expect-error baseUrl が設定されうる
      'https://b.example.com/x': type.empty,
    },
  })
})

test('エラーにはメッセージ型が付く', () => {
  type Bad = ValidRoutes<{ users: Empty }, 'https://a.example.com'>['users']
  expectTypeOf<Bad extends KeyError ? true : false>().toEqualTypeOf<true>()

  type Good = ValidRoutes<{ '/users': Empty }, 'https://a.example.com'>['/users']
  expectTypeOf<Good extends KeyError ? true : false>().toEqualTypeOf<false>()

  type NoBase = ValidRoutes<{ users: Empty }>['users']
  expectTypeOf<NoBase extends KeyError ? true : false>().toEqualTypeOf<false>()

  type MaybeBase = ValidRoutes<{ users: Empty }, string | undefined>['users']
  expectTypeOf<MaybeBase extends KeyError ? true : false>().toEqualTypeOf<true>()
})
