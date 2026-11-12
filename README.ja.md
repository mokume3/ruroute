Language: [🇺🇸](./README.md) [🇯🇵](./README.ja.md)

[![GitHub Release](https://img.shields.io/github/v/release/mokume3/ruroute)](https://github.com/mokume3/ruroute/releases)
[![license](https://img.shields.io/github/license/mokume3/ruroute)](https://github.com/mokume3/ruroute/blob/main/LICENSE)
[![minzip](https://badgen.net/bundlephobia/minzip/ruroute)](https://bundlephobia.com/package/ruroute)
[![dependencies](https://badgen.net/bundlephobia/dependency-count/ruroute)](https://bundlephobia.com/package/ruroute)
[![CI](https://github.com/mokume3/ruroute/actions/workflows/ci.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/ci.yml)
[![Publish](https://github.com/mokume3/ruroute/actions/workflows/publish.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/publish.yml)
[![Deploy](https://github.com/mokume3/ruroute/actions/workflows/deploy.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/deploy.yml)
[![Coverage](https://mokume3.github.io/ruroute/coverage/badge.svg)](https://mokume3.github.io/ruroute/coverage)

# ruroute

> ルート定義から、型安全に URL を組み立てる TypeScript ライブラリ

## ✨ Features

- 🔒 パスパラメータ・クエリ・ハッシュまで型安全にルートを定義できる
- 🎯 返り値の URL もテンプレートリテラル型で推論される
- 🪶 依存パッケージなし。使っていない `type.*` はツリーシェイキングで除去される
- ⚡ 実行時のコストが小さい([ベンチマーク](#-benchmark))
- 📝 定義に書いた JSDoc が、呼び出し側の引数にも表示される
- 🌐 Base URL・絶対 URL・独自スキーム(`myapp://…`)に対応

## 🚀 Getting Started

### 1. Install

```bash
pnpm add ruroute
```

### 2. Define Routes

```ts
import { defineRoutes, type } from 'ruroute'

export const routes = defineRoutes({
  routes: {
    '/users': type.route({
      get: { query: { page: type.optional(type.number) } },
      post: type.empty,
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number } },
    }),
  },
})
```

### 3. Use Routes

```ts
import { routes } from './routes'

routes['/users']()
routes['/users'].get()
routes['/users'].post()
// => '/users'

routes['/users']({ query: { page: 2 } })
// => '/users?page=2'

routes['/users/[id]']({ params: { id: 123 } })
// => '/users/123'
```

> [!TIP]
> 返り値はテンプレートリテラル型で推論される。  
> たとえば `routes['/users/[id]']({ params: { id: 123 } })` の型は `` `/users/${number}` `` になる。  
> `string` 型で受けたいときは型注釈を付ける: `const url: string = routes['/users/[id]']({ params: { id: 123 } })`

## 📘 Why ruroute?

ルートを1か所に宣言し、そこから型の付いた URL 生成関数を得ることに絞ったライブラリ。主な特徴は次のとおり。

- スキーマは `type.number` などの値で書くので、型アサーションが要らない
- ルートを直接呼び出すと GET の URL を返し、引数のキーは `p` / `q` / `h` に短縮できる
- 定義に書いた JSDoc が呼び出し側の引数に引き継がれる
- 実行時の処理を軽くし、URL 生成とルート定義を速くしている

次のような場面に向いている。

- SDK のないサードパーティ API のエンドポイントや、外部サイトへのリンクを管理する
- 独自スキームの URL(例: `myapp://items/1`)を管理する
- OpenAPI generator のようなコード生成を使っていないプロジェクトで、API の URL を管理する
- 内部リンクをシンプルに型安全にしたい

## 📖 API Reference

- [No Parameters](#no-parameters)
- [Path Parameters](#path-parameters)
- [Query Parameters](#query-parameters)
- [Hash](#hash)
- [Schema Types](#schema-types)
- [Base URL](#base-url)
- [Shorthand](#shorthand)
- [JSDoc](#jsdoc)
- [Type Utilities](#type-utilities)
- [URL Encoding](#url-encoding)

### No Parameters

- パラメータが不要なメソッドには `type.empty` を指定する
- メソッドは `get` / `post` / `put` / `delete` から選ぶ。それ以外のキーは型エラーになる
- 定義したメソッドだけが `.get` / `.post` / `.put` / `.delete` として生える
- `'/path': type.empty` と書くと GET だけのルートになる([Shorthand](#shorthand))

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/items': type.route({
      get: type.empty,
      post: type.empty,
      put: type.empty,
      delete: type.empty,
    }),
  },
})

routes['/items'].get()
routes['/items'].post()
routes['/items'].put()
routes['/items'].delete()
// => すべて '/items'
```

### Path Parameters

- パスの中で `[name]` のように `[]` で囲む
- 値は `params` に定義する。`string` / `number` を満たす型を指定できる([Schema Types](#schema-types))
- パスの `[name]` と `params` のキーは定義時に照合される。書き漏れや余分なキーは型エラーになる
- パスパラメータは、そのルートのすべてのメソッドに定義する
- 値は `encodeURIComponent` でエンコードされる

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/users/[id]': type.route({
      get: { params: { id: type.number } },
      delete: { params: { id: type.number } },
    }),
    '/orgs/[org]/repos/[repo]': type.route({
      get: { params: { org: type.string, repo: type.string } },
    }),
  },
})

routes['/users/[id]']({ params: { id: 123 } })
// => '/users/123'

routes['/users/[id]']({ params: { id: 'abc' } })
//                                ^^
// エラー: string は number に割り当てられない

routes['/orgs/[org]/repos/[repo]']({ params: { org: 'mokume3', repo: 'my repo' } })
// => '/orgs/mokume3/repos/my%20repo'

routes['/users/[id]']()
//                   ^^
// エラー: パスパラメータは省略できない
```

```ts
defineRoutes({
  routes: {
    // エラー: パスの [id] に対応する params がない
    '/users/[id]': type.route({
      get: { params: { userId: type.number } },
    }),
  },
})
```

### Query Parameters

- 値は `query` に定義する。`string` / `number` / `boolean` と、その配列を指定できる
- `type.optional(...)` で包んだキーは、呼び出し時に省略できる
- 必須のキーがなければ、引数そのものを省略できる
- 定義にないキーを渡すと型エラーになる
- 配列は同じキーを繰り返す(`tags=a&tags=b`)。`undefined` のキーと空配列は出力しない

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/search': type.route({
      get: {
        query: {
          q: type.string,
          page: type.optional(type.number),
          exact: type.optional(type.boolean),
          tags: type.optional(type.array(type.string)),
        },
      },
    }),
    '/posts': type.route({
      get: { query: { page: type.optional(type.number) } },
    }),
  },
})

routes['/search']({ query: { q: 'type safe', page: 2, tags: ['ts', 'url'] } })
// => '/search?page=2&q=type%20safe&tags=ts&tags=url'

routes['/search']()
//               ^^
// エラー: 必須のクエリ q があるので省略できない

routes['/search']({ query: { q: 'url', sort: 'new' } })
//                                     ^^^^
// エラー: sort は定義にない

routes['/posts']()
// => '/posts'
```

> [!TIP]
> クエリのキーは並べ替えて出力するので、同じ値なら常に同じ URL になる。URL をキャッシュのキーにする SWR や TanStack Query でもそのまま使える。返り値の型も並べ替えた後の順になる。

### Hash

- 値は `hash` に定義する。`string` / `number` を満たす型を指定できる
- リテラル型のユニオンで候補を絞るのが安全だが、`type.string` で何でも受け付けることもできる
- `type.optional(...)` で包まない限り、呼び出し時に省略できない
- `undefined` と空文字のときは `#` を付けない

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/docs': type.route({
      get: { hash: type.optional(type.literal(['install', 'usage'])) },
    }),
    '/faq': type.route({
      get: { hash: type.string },
    }),
  },
})

routes['/docs']({ hash: 'usage' })
// => '/docs#usage'

routes['/docs']({ hash: 'unknown' })
//                ^^^^
// エラー: 'unknown' は 'install' | 'usage' に割り当てられない

routes['/docs']()
// => '/docs'

routes['/faq']()
//            ^^
// エラー: hash は省略できない
```

### Schema Types

| 型 | TS の型 | params | query | hash |
|---|---|:---:|:---:|:---:|
| `type.string` | `string` | ✅ | ✅ | ✅ |
| `type.number` | `number` | ✅ | ✅ | ✅ |
| `type.boolean` | `boolean` | – | ✅ | – |
| `type.literal([...])` | 値のユニオン | ✅ | ✅ | ✅ |
| `type.union([...])` | 要素の型のユニオン | ✅ | ✅ | ✅ |
| `type.custom<T>()` | `T` | ✅ | ✅ | ✅ |
| `type.array(T)` | `readonly T[]` | – | ✅ | – |
| `type.optional(T)` | `T \| undefined`(キーを省略できる) | – | ✅ | ✅ |

- `type.custom<T>()` では、ブランド型や既存のユニオン型をそのまま使える。`T` は params / hash では `string | number`、query では `string | number | boolean` の部分型にする
- 実行時に値は検証しない。`type.*` は型のための目印で、実行時はすべて同じ空オブジェクトになる

```ts
import { defineRoutes, type } from 'ruroute'

type UserId = string & { readonly __brand: 'UserId' }

const routes = defineRoutes({
  routes: {
    '/users/[id]/posts': type.route({
      get: {
        params: { id: type.custom<UserId>() },
        query: {
          sort: type.optional(type.literal(['new', 'popular'])),
          limit: type.optional(type.union([type.number, type.literal(['all'])])),
        },
      },
    }),
  },
})

declare const userId: UserId

routes['/users/[id]/posts']({ params: { id: userId }, query: { sort: 'new', limit: 'all' } })
// => '/users/<userId>/posts?limit=all&sort=new'
```

### Base URL

- `baseUrl` を指定すると、各ルートのキーの前に連結される
- `baseUrl` が `/` で終わり、キーが `/` で始まるときは、`baseUrl` 末尾の `/` を1つだけ除く
- `baseUrl` を指定したときは、キーを `/` で始まるパス(`//` で始まるものは除く)にする。そうでなければ型エラーになる
- `baseUrl` を指定しなければ、キーに絶対 URL や独自スキームの URL をそのまま書ける

```ts
import { defineRoutes, type } from 'ruroute'

const api = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/users': type.empty,
  },
})

api['/users']()
// => 'https://api.example.com/users'

const app = defineRoutes({
  baseUrl: 'myapp://',
  routes: {
    '/items/[id]': type.route({ get: { params: { id: type.number } } }),
  },
})

app['/items/[id]']({ params: { id: 1 } })
// => 'myapp://items/1'

const links = defineRoutes({
  routes: {
    'https://github.com/[owner]/[repo]': type.route({
      get: { params: { owner: type.string, repo: type.string } },
    }),
    'myapp://settings': type.empty,
  },
})

links['https://github.com/[owner]/[repo]']({ params: { owner: 'mokume3', repo: 'ruroute' } })
// => 'https://github.com/mokume3/ruroute'
```

```ts
defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    // エラー: 'baseUrl を指定したときはキーを / で始まるパスにしてください'
    users: type.empty,
  },
})
```

### Shorthand

- `'/path': type.empty` は GET だけのルートになる。`type.route()` を引数なしで呼んでも同じ
- ルートを直接呼び出すと `.get` と同じ URL を返す。GET を定義していないルートは直接呼び出せない
- 引数のキーは `params` / `query` / `hash` の代わりに `p` / `q` / `h` と書ける。同じ項目を両方で渡すのは型エラーになる

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/health': type.empty,
    // = '/health': type.route({ get: type.empty })

    '/users/[id]': type.route({
      get: {
        params: { id: type.number },
        query: { tab: type.optional(type.literal(['posts', 'likes'])) },
        hash: type.optional(type.string),
      },
    }),
  },
})

routes['/health']()
routes['/health'].get()
// => '/health'

routes['/users/[id]']({ p: { id: 1 }, q: { tab: 'posts' }, h: 'top' })
routes['/users/[id]'].get({ params: { id: 1 }, query: { tab: 'posts' }, hash: 'top' })
// => '/users/1?tab=posts#top'

routes['/users/[id]']({ params: { id: 1 }, p: { id: 2 } })
//                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// エラー: params と p は同時に渡せない
```

### JSDoc

- `params` / `query` のキーと `hash` に書いた JSDoc は、呼び出し側の引数にも表示される
- 短縮形の `p` / `q` で渡しても表示される。`h` に表示されるのは TypeScript 7.1 以降

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/users': type.route({
      get: {
        query: {
          /** 1 始まりのページ番号 */
          page: type.optional(type.number),
        },
      },
    }),
  },
})

routes['/users']({ query: { page: 2 } })
//                          ^^^^
// ホバーすると「1 始まりのページ番号」と表示される
```

### Type Utilities

- `RoutePath<T>`: ルートのパスのユニオン
- `RouteArgs<T, P, M>`: パス `P`・メソッド `M` の呼び出し引数の型。引数のないメソッドでは `never`
- `ValidRoutes<R, B>`: ルート定義の検証。`defineRoutes` をラップする関数の引数に使う
- ほかに `Schema` / `Infer` / `Empty` / `Route` / `RouteDef` / `Routes` / `RoutesConfig` も公開している

```ts
import type { RouteArgs, RoutePath } from 'ruroute'

type Path = RoutePath<typeof routes>
// => '/users' | '/users/[id]'

type Args = RouteArgs<typeof routes, '/users/[id]', 'get'>
// => { params: { id: number } } | { p: { id: number } } など、呼び出し引数の型
```

### URL Encoding

| 要素 | 規則 |
|---|---|
| baseUrl | キーと連結する。baseUrl が `/` で終わり、キーが `/` で始まるときは baseUrl 末尾の `/` を1つだけ除く(`myapp://` + `/items` → `myapp://items`) |
| params | `[name]` を `encodeURIComponent(String(値))` に置き換える |
| query | `URLSearchParams` で組み立ててキーを並べ替え、空白は `%20` にする。`undefined` のキーと空配列は出力しない。配列は同じキーを繰り返す。何もなければ `?` を付けない |
| hash | `#` + `encodeURIComponent(String(値))`。`undefined` と空文字のときは付けない |

## 🚫 Unsupported

- 可変長パスパラメータ(`[...slug]` / `[[...slug]]`)と、省略できるパスパラメータ。`[...slug]` は特別扱いされず、`...slug` という名前の通常のパスパラメータとして扱われる
- `get` / `post` / `put` / `delete` 以外のメソッド(`patch` など)
- テスト用の `mock` メソッド
- URL のパースと、実行時の値の検証
- キーに IPv6 リテラルのホストを書くこと(`http://[::1]/…`)。baseUrl に書けば動く

可変長パスパラメータやテスト用の `mock` が必要なら、[routopia](https://github.com/yKicchan/routopia) の方が合っている。

## 📊 Benchmark

[routopia](https://github.com/yKicchan/routopia) 1.2.3 との比較(2026-11-06 計測)。計測方法と詳細は [docs/benchmark.md](./docs/benchmark.md) を参照。

| ケース | ruroute / routopia |
|---|---:|
| パラメータなし | 5.27x |
| パスパラメータ + hash | 5.00x |
| クエリ(配列を含む) | 2.38x |
| params + query + hash | 2.49x |
| 絶対 URL のキー | 5.76x |
| ルート定義(100 ルート) | 4.09x |

| バンドル(3ルートを定義して4回呼び出す) | minified | gzip | brotli |
|---|---:|---:|---:|
| ruroute | 1,222 B | 739 B | 659 B |
| routopia | 1,975 B | 821 B | 725 B |

## 📝 License

[MIT](./LICENSE)
