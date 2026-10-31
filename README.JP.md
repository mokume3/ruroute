# ruroute

TypeScript 向けの、型安全なルート定義と URL 生成ライブラリ。

English README: [README.md](./README.md)

- ルートを1回定義すると、HTTP メソッドごとに型付きの URL 生成関数が手に入る
- パスパラメータはパス(`/users/[id]`)から推論され、定義時に検査される
- クエリ、ハッシュ、絶対 URL、独自スキーム(`myapp://…`)に対応
- 実行時バリデーションなし、依存なし。使っていない `type.*` はツリーシェイキングで除去される

## インストール

```bash
pnpm add ruroute
```

## クイックスタート

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com', // 任意
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: { query: { page: type.optional(type.number) } },
      post: type.empty,
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number }, hash: type.optional(type.string) },
      delete: { params: { id: type.number } },
    }),
  },
})

routes['/health']() // https://api.example.com/health
routes['/users']({ q: { page: 2 } }) // https://api.example.com/users?page=2
routes['/users'].post() // https://api.example.com/users
routes['/users/[id]']({ p: { id: 1 }, h: 'top' }) // https://api.example.com/users/1#top
routes['/users/[id]'].delete({ params: { id: 1 } }) // https://api.example.com/users/1
```

- ルートを直接呼び出すと get の URL を返す。`.get` / `.post` / `.put` / `.delete` は定義したメソッドだけ存在する。
- 引数のキーは `params` / `query` / `hash` と短縮形 `p` / `q` / `h` のどちらでもよい(同じ項目を両方で渡すのは不可)。
- 必須の値がなければ、引数オブジェクトを省略できる。
- パスの `[name]` は、すべてのメソッドの `params` に定義しなければならない。書き漏れや余分なキーは型エラーになる。

## type

| 型 | TS 型 | params | query | hash |
|---|---|---|---|---|
| `type.empty` | (引数なし) | – | – | – |
| `type.string` | `string` | ○ | ○ | ○ |
| `type.number` | `number` | ○ | ○ | ○ |
| `type.boolean` | `boolean` | – | ○ | – |
| `type.literal([...])` | 値のユニオン | ○ | ○ | ○ |
| `type.union([...])` | 要素の型のユニオン | ○ | ○ | ○ |
| `type.custom<T>()` | `T` | ○ | ○ | ○ |
| `type.array(T)` | `readonly T[]` | – | ○ | – |
| `type.optional(T)` | `T \| undefined`(キー省略可) | – | ○ | ○ |

`type.custom<T>()` では、ブランド型や既存のユニオン型をそのまま使える。`T` は params / hash では `string | number`、query では `string | number | boolean` の部分型にする。

## URL の組み立て規則

| 要素 | 規則 |
|---|---|
| baseUrl | キーと連結する。baseUrl が `/` で終わり、キーが `/` で始まるときは baseUrl 末尾の `/` を1つだけ除く(`myapp://` + `/items` → `myapp://items`)。 |
| params | `[name]` を `encodeURIComponent(String(値))` に置き換える。 |
| query | `URLSearchParams` で組み立て、空白は `%20` にする。`undefined` のキーは出力しない。配列は同じキーを繰り返す(`tag=a&tag=b`)。何もなければ `?` を付けない。 |
| hash | `#` + `encodeURIComponent(String(値))`。`undefined` と `''` のときは付けない。 |

実行時に値は検証しない。

## baseUrl・絶対 URL・独自スキーム

baseUrl を指定しなければ、キーに絶対 URL や独自スキームの URL を書ける:

```ts
const routes = defineRoutes({
  routes: {
    'https://api.example1.com/health': type.empty,
    'myapp://items/[id]': type.route({ get: { params: { id: type.number } } }),
  },
})
routes['myapp://items/[id]']({ p: { id: 1 } }) // myapp://items/1
```

baseUrl を指定したときは、キーを `/` で始まるパス(`//` で始まるものは除く)にする。そうでなければ型エラー(`'baseUrl を指定したときはキーを / で始まるパスにしてください'`)になる。

## 型ユーティリティ

```ts
import type { RouteArgs, RoutePath, RouteDef, ValidRoutes } from 'ruroute'

type Path = RoutePath<typeof routes> // '/health' | '/users' | '/users/[id]'
type Args = RouteArgs<typeof routes, '/users', 'get'> // 呼び出し引数の型
```

`ValidRoutes<R, B>` を使うと、baseUrl を固定した wrapper を書ける:

```ts
const BASE = 'https://api.example.com'

export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}
```

`Schema`、`Infer`、`Empty`、`Route`、`RouteDef`、`Routes`、`RoutesConfig` も公開している。

## 対応していないもの

- 可変長パラメータ(`[...slug]` / `[[...slug]]`)、任意のパスパラメータ。`[...slug]` は特別扱いされず、`...slug` という名前の通常の param として扱われる。
- クエリキーのソート
- URL のパース、実行時バリデーション
- キーに IPv6 リテラルのホストを書くこと(`http://[::1]/…`)。baseUrl に書けば動く

## ベンチマーク

[routopia](https://github.com/yKicchan/routopia) との比較は [docs/benchmark.md](./docs/benchmark.md) を参照。

## 0.4 からの移行

API を作り直した。テンプレート文字列と `.types<>()` は、`defineRoutes` と `type.*` に置き換わった。

```ts
// 0.4
const userRoute = ruroute('/users/:id?tab#section').types<{
  id: string
  tab?: string
  section: string
}>()
userRoute({ id: '42', tab: 'profile', section: 'overview' })

// 現在
const routes = defineRoutes({
  routes: {
    '/users/[id]': type.route({
      get: {
        params: { id: type.string },
        query: { tab: type.optional(type.string) },
        hash: type.string,
      },
    }),
  },
})
routes['/users/[id]']({ p: { id: '42' }, q: { tab: 'profile' }, h: 'overview' })
// /users/42?tab=profile#overview
```

- `:name` → `[name]`
- クエリのキーとハッシュは、テンプレートではなくルート定義に書く
- 引数は `p` / `q` / `h` にまとめる

## リリース

1. `pnpm changeset` で変更内容と bump の種類を記録する。
2. `pnpm version-packages` でバージョンと CHANGELOG.md を更新し、その変更をコミットする。
3. `pnpm release` でビルドして npm に公開する(ビルドは `prepublishOnly` が行う)。公開後、作られたタグを `git push --follow-tags` で push する。

## ライセンス

MIT
