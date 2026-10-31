import { describe, expect, test } from 'vitest'
import { defineRoutes, type } from '../../src'

// routopia 1.2.3 の src/definitions.test.ts / src/utilities.test.ts から、
// ruroute が実装している機能に当てはまるテストを翻訳したもの。
// 各テストのコメントは routopia 側の「describe > it」名。

const routes = defineRoutes({
  routes: {
    '/methods': type.route({
      get: type.empty,
      post: type.empty,
      put: type.empty,
      delete: type.empty,
    }),
    '/params/[param]': type.route({ get: { params: { param: type.string } } }),
    '/params/[param1]/[param2]': type.route({
      get: { params: { param1: type.string, param2: type.string } },
    }),
    '/queries/required': type.route({
      get: {
        query: {
          string: type.string,
          number: type.number,
          boolean: type.boolean,
          array: type.array(type.string),
        },
      },
    }),
    '/queries/both': type.route({
      get: {
        query: {
          string: type.string,
          number: type.number,
          boolean: type.optional(type.boolean),
          array: type.optional(type.array(type.string)),
        },
      },
    }),
    '/queries/optional': type.route({
      get: {
        query: {
          string: type.optional(type.string),
          number: type.optional(type.number),
        },
      },
    }),
    '/hash': type.route({ get: { hash: type.optional(type.string) } }),
    '/all/[param]': type.route({
      get: {
        params: { param: type.string },
        query: { optional: type.optional(type.string) },
        hash: type.optional(type.string),
      },
    }),
    'path/[param]': type.route({ get: { params: { param: type.string } } }),
  },
})

describe('routes', () => {
  // routes > 各エンドポイントに対応するオブジェクトが生成されること
  test('定義したパスごとにルートが生成される', () => {
    expect(Object.keys(routes)).toEqual([
      '/methods',
      '/params/[param]',
      '/params/[param1]/[param2]',
      '/queries/required',
      '/queries/both',
      '/queries/optional',
      '/hash',
      '/all/[param]',
      'path/[param]',
    ])
  })

  // routes > 各エンドポイントに対応するすべての HTTP メソッドが生成されること
  test('get / post / put / delete がすべて生成される', () => {
    expect(Object.keys(routes['/methods'])).toEqual(['get', 'post', 'put', 'delete'])
    expect(routes['/methods'].get()).toBe('/methods')
    expect(routes['/methods'].post()).toBe('/methods')
    expect(routes['/methods'].put()).toBe('/methods')
    expect(routes['/methods'].delete()).toBe('/methods')
  })

  // routes > パスパラメータが宣言されている場合 > 複数のパスパラメータを指定して URL を生成できること
  test('複数のパスパラメータ', () => {
    expect(
      routes['/params/[param1]/[param2]']({
        p: { param1: '1', param2: '2' },
      }),
    ).toBe('/params/1/2')
  })

  // routes > パスパラメータが宣言されている場合 > パスパラメータはエンコードされること
  test('パスパラメータのマルチバイト文字と空白をエンコードする', () => {
    expect(routes['/params/[param]']({ p: { param: 'あ' } })).toBe('/params/%E3%81%82')
    expect(routes['/params/[param]']({ p: { param: '1 2' } })).toBe('/params/1%202')
  })

  // routes > クエリパラメータが宣言されている場合 > ソートされたクエリパラメータ付きの URL を生成できること
  test('必須クエリをすべて指定する', () => {
    expect(
      routes['/queries/required']({
        q: { string: 'string', number: 1, boolean: true, array: ['string'] },
      }),
    ).toBe('/queries/required?array=string&boolean=true&number=1&string=string')
  })

  // routes > クエリパラメータが宣言されている場合 > オプショナルなクエリパラメータは省略して URL を生成できること
  test('省略可能なクエリは省略できる', () => {
    expect(routes['/queries/both']({ q: { string: 'string', number: 1 } })).toBe('/queries/both?number=1&string=string')
  })

  // routes > クエリパラメータが宣言されている場合 > パラメータが全て省略可能な場合は、引数なしで URL を生成できること
  test('クエリがすべて省略可能なら引数なしで呼べる', () => {
    expect(routes['/queries/optional']()).toBe('/queries/optional')
  })

  // routes > クエリパラメータが宣言されている場合 > エンコードされること
  // stringifyQueries > クエリパラメータが設定されている場合 > クエリパラメータがエンコードされること
  test('クエリの空白は %20、マルチバイト文字と予約文字はエンコードする', () => {
    const q = routes['/queries/optional']
    expect(q({ q: { string: 'string with space' } })).toBe('/queries/optional?string=string%20with%20space')
    expect(q({ q: { string: 'りんご' } })).toBe('/queries/optional?string=%E3%82%8A%E3%82%93%E3%81%94')
    expect(q({ q: { string: 'a&b=c/d?e#f+g' } })).toBe('/queries/optional?string=a%26b%3Dc%2Fd%3Fe%23f%2Bg')
  })

  // stringifyQueries(空文字の値)
  test('クエリの空文字は値なしで出力する', () => {
    expect(routes['/queries/optional']({ q: { string: '' } })).toBe('/queries/optional?string=')
  })

  // stringifyQueries(null の値)
  // routopia は null のキーを省略する。ruroute は型で null を禁止しており、実行時は "null" を出力する
  test('クエリの null は "null" として出力する(routopia との違い)', () => {
    const query = { string: null } as unknown as { string: string }
    expect(routes['/queries/optional']({ q: query })).toBe('/queries/optional?string=null')
  })

  // stringifyQueries > クエリパラメータが設定されている場合 > クエリパラメータの値が配列の場合、キーを繰り返して返すこと
  test('配列は同じキーを繰り返し、空配列は出力しない', () => {
    const both = routes['/queries/both']
    expect(both({ q: { string: 's', number: 1, array: ['a', 'b'] } })).toBe(
      '/queries/both?array=a&array=b&number=1&string=s',
    )
    expect(both({ q: { string: 's', number: 1, array: [] } })).toBe('/queries/both?number=1&string=s')
  })

  // stringifyQueries > … > クエリパラメータの値が混在した配列の場合、null/undefinedを除外してキーを繰り返して返すこと
  // routopia は要素の null/undefined を除外する。ruroute は検証せず String() で文字列化する
  test('配列要素の null / undefined は文字列化する(routopia との違い)', () => {
    const array = ['a', null, 'b', undefined, 'c'] as unknown as string[]
    expect(routes['/queries/both']({ q: { string: 's', number: 1, array } })).toBe(
      '/queries/both?array=a&array=null&array=b&array=undefined&array=c&number=1&string=s',
    )
  })

  // routes > ハッシュが宣言されている場合 > ハッシュを指定して URL を生成できること / エンコードされること / ハッシュパラメータを指定せずに URL を生成できること
  // stringifyHash > ハッシュパラメータが設定されている場合 > エンコードされること
  test('hash の付与・エンコード・省略', () => {
    const hash = routes['/hash']
    expect(hash({ h: 'section' })).toBe('/hash#section')
    expect(hash({ h: 'hash with space' })).toBe('/hash#hash%20with%20space')
    expect(hash({ h: 'りんご' })).toBe('/hash#%E3%82%8A%E3%82%93%E3%81%94')
    expect(hash()).toBe('/hash')
  })

  // stringifyHash(空文字)
  test('hash の空文字は # を付けない', () => {
    expect(routes['/hash']({ h: '' })).toBe('/hash')
  })

  // routes > すべてのパラメータが宣言されている場合 > パスパラメータとクエリパラメータとハッシュを指定して URL を生成できること / オプショナルなパラメータは指定なしで URL を生成できること
  test('params + query + hash', () => {
    const all = routes['/all/[param]']
    expect(all({ p: { param: '1' }, q: { optional: 'optional' }, h: 'hash' })).toBe('/all/1?optional=optional#hash')
    expect(all({ p: { param: '1' } })).toBe('/all/1')
  })
})

describe('replacePathParams', () => {
  // replacePathParams > パスの先頭の / の扱い > パスが / で始まる場合、結果のパスも / で始まること / パスが / で始まらない場合、結果のパスは / で始まらないこと
  test('先頭の / の有無を保つ', () => {
    expect(routes['/params/[param]']({ p: { param: '1' } })).toBe('/params/1')
    expect(routes['path/[param]']({ p: { param: '1' } })).toBe('path/1')
  })
})

describe('routes: baseUrl', () => {
  // routes: baseUrl > baseUrl がついた URL を生成できること
  test('パスを含む baseUrl', () => {
    const r = defineRoutes({
      baseUrl: 'https://example.com/api',
      routes: {
        '/path/[param]': type.route({
          get: {
            params: { param: type.string },
            query: { q: type.string },
            hash: type.string,
          },
        }),
      },
    })
    expect(r['/path/[param]']({ p: { param: '1' }, q: { q: 'query' }, h: 'hash' })).toBe(
      'https://example.com/api/path/1?q=query#hash',
    )
  })

  // README「Base URL」の相対 baseUrl
  test('相対の baseUrl', () => {
    const r = defineRoutes({
      baseUrl: '/users',
      routes: {
        '/[id]': type.route({ get: { params: { id: type.number } } }),
      },
    })
    expect(r['/[id]']({ p: { id: 1 } })).toBe('/users/1')
  })
})

describe('routes: custom scheme', () => {
  // routes: custom scheme > baseUrl なし > スラッシュが変わらずに URL を生成できること / パラメータがあってもスラッシュが変わらずに URL を生成できること / 2重スキーマもスラッシュが変わらずに URL を生成できること
  test('baseUrl なし', () => {
    const r = defineRoutes({
      routes: {
        'schema://empty': type.empty,
        'schema://params/[param]': type.route({
          get: { params: { param: type.string } },
        }),
        'schema://https://example.com/path/[param]': type.route({
          get: { params: { param: type.string } },
        }),
      },
    })
    expect(r['schema://empty']()).toBe('schema://empty')
    expect(r['schema://params/[param]']({ p: { param: '1' } })).toBe('schema://params/1')
    expect(r['schema://https://example.com/path/[param]']({ p: { param: '1' } })).toBe(
      'schema://https://example.com/path/1',
    )
  })

  // routes: custom scheme > baseUrl あり > baseUrl があってもスラッシュが変わらずに URL を生成できること / パラメータがあってもスラッシュが変わらずに URL を生成できること
  // ruroute では、baseUrl を指定したときキーは / で始める(境目の / は1つになる)
  test('baseUrl あり', () => {
    const r = defineRoutes({
      baseUrl: 'schema://',
      routes: {
        '/empty': type.empty,
        '/params/[param]': type.route({
          get: { params: { param: type.string } },
        }),
      },
    })
    expect(r['/empty']()).toBe('schema://empty')
    expect(r['/params/[param]']({ p: { param: '1' } })).toBe('schema://params/1')
  })
})
