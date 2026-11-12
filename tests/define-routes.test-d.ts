import { describe, expectTypeOf, test } from 'vitest'
import { defineRoutes, type Routes, type } from '../src'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/health': type.empty,
    '/plain': type.route(),
    '/users': type.route({
      get: {
        query: {
          page: type.optional(type.number),
          tags: type.optional(type.array(type.string)),
        },
      },
      post: type.empty,
    }),
    '/search': type.route({
      get: { query: { word: type.string, exact: type.optional(type.boolean) } },
    }),
    '/users/[id]': type.route({
      get: {
        params: { id: type.number },
        hash: type.optional(type.literal(['top', 'bottom'])),
      },
      delete: { params: { id: type.number } },
    }),
    '/docs': type.route({
      get: { hash: type.union([type.string, type.number]) },
    }),
    '/delete-only': type.route({ delete: type.empty }),
  },
})

describe('呼び出し', () => {
  test('返り値に baseUrl とパスが反映される', () => {
    expectTypeOf(routes['/health']()).toEqualTypeOf<'https://api.example.com/health'>()
    expectTypeOf(routes['/users'].post()).toEqualTypeOf<'https://api.example.com/users'>()
  })

  test('type.empty / type.route() は get のみ持ち、引数を取らない', () => {
    routes['/health']()
    routes['/health'].get()
    routes['/plain']()
    // @ts-expect-error 引数は取らない
    routes['/health']({ q: {} })
    // @ts-expect-error post は未定義
    routes['/health'].post
  })

  test('必須値がなければ引数を省略できる', () => {
    routes['/users']()
    routes['/users']({ q: { page: 1 } })
    routes['/users']({ query: { tags: ['a'] } })
  })

  test('必須値があると引数は省略できない', () => {
    // @ts-expect-error 必須 query がある
    routes['/search']()
    routes['/search']({ q: { word: 'a' } })
    // @ts-expect-error params が必須
    routes['/users/[id]']()
    // @ts-expect-error hash が必須
    routes['/docs']()
    routes['/docs']({ h: 1 })
  })

  test('値の型が推論される', () => {
    routes['/users/[id]']({ p: { id: 1 }, h: 'top' })
    // @ts-expect-error id は number
    routes['/users/[id]']({ p: { id: '1' } })
    // @ts-expect-error literal 以外
    routes['/users/[id]']({ p: { id: 1 }, h: 'middle' })
    // @ts-expect-error 必須クエリキーの欠落
    routes['/search']({ q: { exact: true } })
  })

  test('正式名と短縮形の同時指定はエラー', () => {
    routes['/users/[id]']({ params: { id: 1 } })
    // @ts-expect-error params と p の同時指定
    routes['/users/[id]']({ params: { id: 1 }, p: { id: 2 } })
    // @ts-expect-error query と q の同時指定
    routes['/users']({ query: {}, q: {} })
  })

  test('定義していない項目は渡せない', () => {
    // @ts-expect-error /users に hash はない
    routes['/users']({ h: 'x' })
  })

  test('get がないルートは直接呼び出せない', () => {
    routes['/delete-only'].delete()
    // @ts-expect-error get がない
    routes['/delete-only']()
    // @ts-expect-error 未定義メソッド
    routes['/delete-only'].get
  })
})

describe('返り値の URL 型', () => {
  const urls = defineRoutes({
    routes: {
      'https://api.example3.com/users/[id]': type.route({
        get: { params: { id: type.number } },
      }),
      '/users/[id]/posts/[postId]': type.route({
        get: { params: { id: type.number, postId: type.string } },
      }),
      '/search': type.route({
        get: { query: { term: type.string }, hash: type.optional(type.string) },
      }),
    },
  })

  test('絶対 URL のパラメータを置き換える', () => {
    expectTypeOf(
      urls['https://api.example3.com/users/[id]']({ p: { id: 1 } }),
    ).toEqualTypeOf<`https://api.example3.com/users/${number}`>()
    expectTypeOf(
      urls['https://api.example3.com/users/[id]'].get({ params: { id: 1 } }),
    ).toEqualTypeOf<`https://api.example3.com/users/${number}`>()
  })

  test('複数のパラメータを置き換える', () => {
    expectTypeOf(
      urls['/users/[id]/posts/[postId]']({ p: { id: 1, postId: 'a' } }),
    ).toEqualTypeOf<`/users/${number}/posts/${string}`>()
  })

  test('数値リテラルを含む schema も数値として返す', () => {
    const literals = defineRoutes({
      routes: {
        '/items/[id]': type.route({
          get: { params: { id: type.literal([1, 2]) } },
        }),
      },
    })
    expectTypeOf(literals['/items/[id]']({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
  })

  test('クエリと hash の有無を反映する', () => {
    expectTypeOf(urls['/search']({ q: { term: 'a' } })).toEqualTypeOf<`/search?term=${string}`>()
    expectTypeOf(urls['/search']({ q: { term: 'a' }, h: 'top' })).toEqualTypeOf<`/search?term=${string}#${string}`>()
  })

  test('渡した hash を返り値に反映する', () => {
    expectTypeOf(routes['/users/[id]']({ p: { id: 1 } })).toEqualTypeOf<`https://api.example.com/users/${number}`>()
    expectTypeOf(
      routes['/users/[id]']({ p: { id: 1 }, h: 'top' }),
    ).toEqualTypeOf<`https://api.example.com/users/${number}#${string}`>()
    // 空文字と undefined は # を付けない
    expectTypeOf(urls['/search']({ q: { term: 'a' }, h: '' })).toEqualTypeOf<`/search?term=${string}`>()
    expectTypeOf(urls['/search']({ q: { term: 'a' }, h: undefined })).toEqualTypeOf<`/search?term=${string}`>()
    // 空文字かもしれない string は両方を候補にする
    const hash: string = 'x'
    expectTypeOf(urls['/search']({ q: { term: 'a' }, h: hash })).toEqualTypeOf<
      `/search?term=${string}` | `/search?term=${string}#${string}`
    >()
  })

  test('渡したクエリのキーを返り値に反映する', () => {
    expectTypeOf(routes['/users']({ q: { page: 1 } })).toEqualTypeOf<`https://api.example.com/users?page=${number}`>()
    expectTypeOf(routes['/users']()).toEqualTypeOf<'https://api.example.com/users'>()
    expectTypeOf(routes['/users']({ q: {} })).toEqualTypeOf<'https://api.example.com/users'>()
    // undefined と空配列は出力されない
    expectTypeOf(
      routes['/users']({ q: { page: undefined, tags: [] } }),
    ).toEqualTypeOf<'https://api.example.com/users'>()
  })

  test('数値と真偽値の値は型を保ち、文字列と配列は任意の文字列にする', () => {
    const values = defineRoutes({
      routes: {
        '/v': type.route({
          get: {
            query: {
              n: type.literal([1, 2]),
              b: type.boolean,
              s: type.literal(['x']),
              u: type.union([type.string, type.number]),
              a: type.array(type.number),
            },
          },
        }),
      },
    })
    expectTypeOf(
      values['/v']({ q: { n: 1, b: true, s: 'x', u: 1, a: [1] } }),
    ).toEqualTypeOf<`/v?a=${string}&b=${boolean}&n=${number}&s=${string}&u=${number}`>()
    const u: string | number = 'x' as string | number
    expectTypeOf(
      values['/v']({ q: { n: 1, b: true, s: 'x', u, a: [1] } }),
    ).toEqualTypeOf<`/v?a=${string}&b=${boolean}&n=${number}&s=${string}&u=${string}`>()
  })

  test('複数キーはキー順に並べる', () => {
    expectTypeOf(
      routes['/users']({ q: { tags: ['a'], page: 1 } }),
    ).toEqualTypeOf<`https://api.example.com/users?page=${number}&tags=${string}`>()
    // URLSearchParams.sort() と同じコード単位順(大文字 < _ < 小文字)
    const order = defineRoutes({
      routes: {
        '/o': type.route({ get: { query: { a: type.string, _b: type.string, Z: type.string, '9': type.string } } }),
      },
    })
    expectTypeOf(
      order['/o']({ q: { a: '', _b: '', Z: '', '9': '' } }),
    ).toEqualTypeOf<`/o?9=${string}&Z=${string}&_b=${string}&a=${string}`>()
  })

  test('省略可能なキーは有無の両方を候補にする', () => {
    const query: { word: string; exact?: boolean } = { word: 'a' }
    expectTypeOf(routes['/search']({ q: query })).toEqualTypeOf<
      `https://api.example.com/search?word=${string}` | `https://api.example.com/search?exact=${boolean}&word=${string}`
    >()
  })

  test('エンコードが必要なキーはクエリ全体を任意の文字列にする', () => {
    const odd = defineRoutes({ routes: { '/odd': type.route({ get: { query: { 'a b': type.string } } }) } })
    expectTypeOf(odd['/odd']({ q: { 'a b': 'x' } })).toEqualTypeOf<'/odd' | `/odd?${string}`>()
  })

  test('定義していないクエリキーは渡せない', () => {
    // @ts-expect-error extra は未定義
    routes['/users']({ q: { page: 1, extra: 1 } })
  })

  test('メソッドごとにクエリの有無を反映する', () => {
    const methods = defineRoutes({
      routes: {
        '/items/[id]': type.route({
          get: {
            params: { id: type.number },
            query: { tag: type.optional(type.string) },
          },
          delete: { params: { id: type.number } },
        }),
      },
    })
    expectTypeOf(methods['/items/[id]'].get({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
    expectTypeOf(
      methods['/items/[id]'].get({ p: { id: 1 }, q: { tag: 'a' } }),
    ).toEqualTypeOf<`/items/${number}?tag=${string}`>()
    expectTypeOf(methods['/items/[id]'].delete({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
  })

  test('patch / head / options を定義できる', () => {
    const methods = defineRoutes({
      routes: {
        '/items/[id]': type.route({
          patch: { params: { id: type.number } },
          head: { params: { id: type.number } },
          options: { params: { id: type.number } },
        }),
      },
    })
    expectTypeOf(methods['/items/[id]'].patch({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
    expectTypeOf(methods['/items/[id]'].head({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
    expectTypeOf(methods['/items/[id]'].options({ p: { id: 1 } })).toEqualTypeOf<`/items/${number}`>()
  })

  test('hash だけを持つルートの戻り値', () => {
    expectTypeOf(routes['/docs']({ h: 1 })).toEqualTypeOf<`https://api.example.com/docs#${string}`>()
  })

  test('baseUrl 末尾とパス先頭の / を1つにする', () => {
    const withBase = defineRoutes({
      baseUrl: 'https://api.example.com/v1/',
      routes: {
        '/users/[id]': type.route({ get: { params: { id: type.number } } }),
      },
    })
    expectTypeOf(
      withBase['/users/[id]']({ p: { id: 1 } }),
    ).toEqualTypeOf<`https://api.example.com/v1/users/${number}`>()
  })

  test('Routes<R> の注釈は baseUrl の有無を問わず使える', () => {
    const defs = { '/a': type.empty }
    const withBase: Routes<typeof defs> = defineRoutes({
      baseUrl: 'https://api.example.com',
      routes: defs,
    })
    const withoutBase: Routes<typeof defs> = defineRoutes({ routes: defs })
    const absoluteDefs = {
      '/a': type.empty,
      'https://api.example.com/b': type.empty,
    }
    const withAbsoluteKey: Routes<typeof absoluteDefs> = defineRoutes({
      routes: absoluteDefs,
    })
    // @ts-expect-error baseUrl がない場合は URL に追加されない
    const wrongBase: Routes<typeof defs, 'https://api.example.com'> = defineRoutes({ routes: defs })
    void withBase
    void withoutBase
    void withAbsoluteKey
    void wrongBase
  })
})

describe('type.custom', () => {
  type UserId = number & { __brand: 'UserId' }

  test('T がそのまま引数型になる', () => {
    const r = defineRoutes({
      routes: {
        '/u/[id]': type.route({
          get: {
            params: { id: type.custom<UserId>() },
            query: { sort: type.optional(type.custom<'name' | 'date'>()) },
          },
        }),
      },
    })
    r['/u/[id]']({ p: { id: 1 as UserId }, q: { sort: 'name' } })
    expectTypeOf(r['/u/[id]']({ p: { id: 1 as UserId } })).toEqualTypeOf<`/u/${number}`>()
    // @ts-expect-error ブランドなし number
    r['/u/[id]']({ p: { id: 1 } })
    // @ts-expect-error sort の値が範囲外
    r['/u/[id]']({ p: { id: 1 as UserId }, q: { sort: 'x' } })
  })
})

describe('その他のメソッドと引数', () => {
  const r = defineRoutes({
    routes: {
      '/items/[id]': type.route({
        get: { params: { id: type.number } },
        put: { params: { id: type.number }, query: { force: type.boolean } },
      }),
      '/tags': type.route({
        get: { query: { tags: type.optional(type.array(type.string)) } },
      }),
    },
  })

  test('put も型付きで呼べる', () => {
    r['/items/[id]'].put({ p: { id: 1 }, q: { force: true } })
    // @ts-expect-error 必須クエリ force の欠落
    r['/items/[id]'].put({ p: { id: 1 } })
  })

  test('.get と直接呼び出しは同じ引数型', () => {
    expectTypeOf(r['/items/[id]'].get).parameters.toEqualTypeOf<Parameters<(typeof r)['/items/[id]']>>()
    // @ts-expect-error params が必須
    r['/items/[id]'].get()
  })

  test('readonly 配列を渡せる', () => {
    const TAGS = ['a', 'b'] as const
    r['/tags']({ q: { tags: TAGS } })
  })
})
