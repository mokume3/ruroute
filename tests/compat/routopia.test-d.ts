import { expectTypeOf, test } from 'vitest'
import { defineRoutes, type } from '../../src'

// routopia 1.2.3 の src/definitions.test-d.ts から、ruroute が実装している
// 機能に当てはまり、既存の型テストにないものを翻訳したもの。
// 各テストのコメントは routopia 側の「describe > it」名。
// README「Best Practice」の wrapper は tests/utilities.test-d.ts で確認している。

const r = defineRoutes({
  routes: {
    '/methods': type.route({
      get: type.empty,
      post: type.empty,
      put: type.empty,
      delete: type.empty,
    }),
    '/short': type.empty,
    '/required': type.route({
      get: {
        query: {
          string: type.string,
          number: type.number,
          boolean: type.boolean,
          array: type.array(type.string),
        },
      },
    }),
    '/optional': type.route({
      get: {
        query: {
          string: type.optional(type.string),
          array: type.optional(type.array(type.string)),
        },
      },
    }),
    '/all/[param]': type.route({
      get: {
        params: { param: type.string },
        query: { optional: type.optional(type.string) },
        hash: type.optional(type.string),
      },
    }),
    'myapp://path': type.empty,
    'myapp://path/[param]': type.route({
      get: { params: { param: type.string } },
    }),
    'myapp://https://example.com/[param]': type.route({
      get: { params: { param: type.string } },
    }),
    'path/[a]/x/[b]': type.route({
      get: { params: { a: type.string, b: type.number } },
    }),
  },
})

// 利用時の型チェック > No Parameters > 引数が要求されないこと
test('引数を取らないメソッドの引数は []', () => {
  expectTypeOf(r['/methods'].get).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/methods'].post).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/methods'].put).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/methods'].delete).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/methods']).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/short'].get).parameters.toEqualTypeOf<[]>()
  expectTypeOf(r['/short']).parameters.toEqualTypeOf<[]>()
})

// 利用時の型チェック > Multiple Path Parameters > 引数が要求されること
test('複数のパスパラメータ', () => {
  r['path/[a]/x/[b]']({ p: { a: 'x', b: 1 } })
  // @ts-expect-error b は number
  r['path/[a]/x/[b]']({ p: { a: 'x', b: 'y' } })
})

// 利用時の型チェック > Query Parameters: required > 引数が要求されること
test('必須クエリ', () => {
  const req = r['/required']
  req({ q: { string: 's', number: 1, boolean: false, array: ['a'] } })
  req({ query: { string: 's', number: 1, boolean: false, array: [] } })
  // @ts-expect-error array がない
  req({ q: { string: 's', number: 1, boolean: false } })
  // @ts-expect-error 引数が必要
  req()
  // @ts-expect-error boolean に文字列
  req({ q: { string: 's', number: 1, boolean: 'true', array: [] } })
  // @ts-expect-error 配列の要素の型
  req({ q: { string: 's', number: 1, boolean: true, array: [1] } })
  // @ts-expect-error 定義していないキー
  req({ q: { string: 's', number: 1, boolean: true, array: [], x: 1 } })
})

// 利用時の型チェック > Query Parameters: optional > 省略可能な引数が要求されること
test('省略可能なクエリ', () => {
  const opt = r['/optional']
  opt()
  opt({})
  opt({ q: {} })
  opt({ q: { string: undefined, array: undefined } })
  // @ts-expect-error null は渡せない
  opt({ q: { string: null } })
})

// 利用時の型チェック > All Parameters > 引数が要求されること
test('params は必須、query と hash は省略できる', () => {
  const all = r['/all/[param]']
  all({ p: { param: '1' } })
  all({ params: { param: '1' }, query: { optional: 'o' }, hash: 'h' })
  expectTypeOf(all({ p: { param: '1' } })).toEqualTypeOf<`/all/${string}`>()
  // @ts-expect-error params がない
  all({ q: { optional: 'o' } })
  // @ts-expect-error params に余分なキー
  all({ p: { param: '1', other: '2' } })
  // @ts-expect-error routopia の名前 queries は使えない
  all({ p: { param: '1' }, queries: {} })
})

// 利用時の型チェック > Custom Schema
test('独自スキームのキーからパスパラメータを取り出す', () => {
  r['myapp://path']()
  r['myapp://path/[param]']({ p: { param: 'v' } })
  r['myapp://https://example.com/[param]']({ p: { param: 'v' } })
  // @ts-expect-error param が必要
  r['myapp://path/[param]']()
})

// 定義時の型チェック > Path Parameters > パスパラメータがある場合 > パスパラメータのスキーマ定義を省略できないこと(独自スキーム)
test('独自スキームのキーでも params を検証する', () => {
  defineRoutes({
    routes: {
      // @ts-expect-error params がない
      'myapp://path/[param]': type.empty,
    },
  })
  defineRoutes({
    routes: {
      // @ts-expect-error パスにない b
      'myapp://x/[a]': type.route({
        get: { params: { a: type.string, b: type.string } },
      }),
    },
  })
})

// 定義時の型チェック > Path Parameters > パスパラメータがある場合 > パスパラメータのスキーマには string | number のみ指定できること
test('params に使えない custom の型', () => {
  // @ts-expect-error null
  type.route({ get: { params: { id: type.custom<null>() } } })
  // @ts-expect-error symbol
  type.custom<symbol>()
  // @ts-expect-error 関数
  type.custom<() => void>()
  // @ts-expect-error bigint
  type.custom<bigint>()
  // @ts-expect-error 配列
  type.custom<string[]>()
})

// 定義時の型チェック > Query Parameters > クエリパラメータのスキーマには object を指定できないこと
test('query の配列に object は使えない', () => {
  // @ts-expect-error object の配列
  type.route({ get: { query: { o: type.array(type.custom<object>()) } } })
})

// 定義時の型チェック > Hash > ハッシュパラメータのスキーマには string のみ指定できること
// ruroute は number の hash も許可する
test('hash の制約', () => {
  type.route({ get: { hash: type.literal(['section1', 'section2']) } })
  type.route({ get: { hash: type.custom<'s1' | 's2'>() } })
  type.route({ get: { hash: type.number } })
  // @ts-expect-error null
  type.route({ get: { hash: type.custom<null>() } })
})

// 定義時の型チェック > Shorthand > メソッド定義と混同できないこと
test('メソッド定義とオプションを混在できない', () => {
  // @ts-expect-error ルート直下に query
  type.route({ get: type.empty, query: { q: type.string } })
  // @ts-expect-error ルート直下に hash だけ
  type.route({ hash: type.string })
  // @ts-expect-error type.route を通さないオプション
  defineRoutes({ routes: { '/x': { params: {} } } })
  // @ts-expect-error type.route を通さないメソッド定義
  defineRoutes({ routes: { '/x': { get: type.empty } } })
})
