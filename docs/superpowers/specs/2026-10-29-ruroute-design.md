# ruroute 設計

型安全な URL を生成するルート定義ライブラリ。`src/sample.ts` の構想を元にする。
参考: [routopia](https://github.com/yKicchan/routopia)

## 目的と範囲

- ルート定義から、型付きの URL 生成関数を作る。
- 実行時は URL 文字列の組み立てのみを行う。値の検証やパース(URL → 値)は行わない。
- 返り値は URL 文字列のみ。HTTP メソッドは「メソッドごとに受け付ける引数の型を分ける」ためだけに使う。

### 対象外(最初の版)

- 実行時バリデーション(`type.string.url` 案は破棄)
- 可変長パスパラメータ `[...name]` / `[[...name]]`
- 任意のパスパラメータ
- URL のパース
- ルートのキーが `string` に広がった定義(変数経由の `Record<string, ...>` など)のパスパラメータ検証。この場合は検証できず、`defineRoutes` が型エラーになりうる(params を持つルートは必ず型エラーになる)。
- baseUrl を指定し、ルートのキーが `string` に広がった定義。キーがパスかどうか判定できないため、型エラーになる。
- ホストに `[...]` を含む URL(IPv6 リテラル `http://[::1]/`)をキーに書くこと。`[::1]` がパスパラメータとして解釈される。baseUrl に書いた場合は動く。

## 公開 API

### 定義

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com', // 任意
  routes: {
    '/health': type.empty, // type.route() と同義
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
```

- ルートの値: `type.empty` または `type.route({ get?, post?, put?, delete? })`。`type.route()` は `type.empty` と同義。
- メソッドの値: `type.empty` または `{ params?, query?, hash? }`。
- 定義側のキー名は正式名 `params` / `query` / `hash` のみ(短縮形不可)。
- `type.route()` は、メソッド名(`get` / `post` / `put` / `delete`)以外のキーと、メソッド定義内の `params` / `query` / `hash` 以外のキーを型エラーにする(typo の検出)。
- パスに `[name]` がある場合、そのルートのすべてのメソッドで `params` にパス中の全キーを定義しなければならない。書き漏れ、パスにない余分なキーはいずれも型エラー。
- パスに `[name]` がないメソッドで `params` を定義することも型エラー。

### 呼び出し

```ts
routes['/health']() // '/health' 相当(get の URL)
routes['/users']({ q: { page: 2 } }) // https://api.example.com/users?page=2
routes['/users'].post() // https://api.example.com/users
routes['/users/[id]']({ p: { id: 1 }, h: 'top' }) // https://api.example.com/users/1#top
routes['/users/[id]'].delete({ params: { id: 1 } }) // https://api.example.com/users/1
```

- 返り値は `string`。
- ルートを直接呼び出すと get の URL を返す。get が定義されていないルート(`type.empty` は get 定義ありとみなす)を直接呼び出すのは型エラー。
- `.get` / `.post` / `.put` / `.delete` は、定義したメソッドだけ存在する。`type.empty` のルートは `.get` のみを持つ。
- 引数のキーは正式名 `params` / `query` / `hash` と短縮形 `p` / `q` / `h` のどちらでもよい。同じ項目を両方の名前で渡すと型エラー。
- 必須の値が1つもないとき、引数オブジェクト自体を省略できる。必須とは「params が1つ以上ある」「optional でない query キーがある」「optional でない hash がある」のいずれか。

### baseUrl とキー

- baseUrl を指定したときは、キーを `/` で始まるパスにしなければならない。`//` で始まるキー(プロトコル相対)、絶対 URL、`/` で始まらないキーは型エラーになる。エラーメッセージは `'baseUrl を指定したときはキーを / で始まるパスにしてください'`。
- baseUrl の型が `string | undefined` の場合も検査する。
- baseUrl を指定しなければ、キーに絶対 URL や独自スキームの URL を書ける。

### type

| 型 | TS 型 | params | query | hash |
|---|---|---|---|---|
| `type.empty` | (引数なし) | – | – | – |
| `type.string` | `string` | ○ | ○ | ○ |
| `type.number` | `number` | ○ | ○ | ○ |
| `type.boolean` | `boolean` | – | ○ | – |
| `type.literal([...])` | 要素のユニオン(string / number) | ○ | ○ | ○ |
| `type.union([...])` | 要素の型のユニオン | ○ | ○ | ○ |
| `type.custom<T>()` | `T` | ○ | ○ | ○ |
| `type.array(T)` | `readonly T[]`(T はスカラー型のみ。mutable な配列も渡せる) | – | ○ | – |
| `type.optional(T)` | `T \| undefined`、キー省略可 | – | ○ | ○ |

- スカラー型 = `string` / `number` / `boolean` / `literal` / `union` / `custom`。
- `type.union` の要素に `type.optional` / `type.array` は書けない。
- `type.optional` の中に `type.optional` は書けない。
- 表で「–」の位置に書いた場合は型エラー。

#### type.custom

任意の TS 型を指定する。ブランド型、アプリ側の既存ユニオン型、テンプレートリテラル型をそのまま使うためのもの。実行時は `{ kind: 'custom' }` のみ。

```ts
type UserId = number & { __brand: 'UserId' }

'/users/[id]': type.route({
  get: {
    params: { id: type.custom<UserId>() },
    query: { sort: type.optional(type.custom<'name' | 'date'>()) },
  },
})
```

- `T` の制約: params / hash では `string | number` の部分型、query では `string | number | boolean` の部分型。満たさない場合は型エラー。
- 文字列化の規則は他のスカラー型と同じ(`String()`)。

### 型ユーティリティ

`types.ts` の型を公開し、自作コンポーネントや fetch ラッパーで利用できるようにする。

```ts
import type { RoutePath, RouteArgs } from 'ruroute'

type Path = RoutePath<typeof routes> // '/health' | '/users' | '/users/[id]'
type Args = RouteArgs<typeof routes, '/users', 'get'> // 呼び出し引数の型
```

- `RoutePath<R>`: ルートのパスのユニオン。
- `RouteArgs<R, P, M>`: パス `P`、メソッド `M` の呼び出し引数の型。引数が省略可能なルートでも、引数オブジェクトの型を返す(`undefined` は含めない)。`M` に未定義のメソッドを指定すると型エラー。引数を取らないメソッド(`type.empty` など)では `never`。
- `RouteArgs` の `M` にユニオンを渡すと、各メソッドの引数型のユニオンになる。
- 型として `Schema`、`Infer`、`Empty`、`Route`、`RouteDef`、`Routes` も公開する。利用者がルート定義を export して型宣言を出力するために必要。
- `ValidRoutes<R, B>`: ルート定義の検証型(パスと params の一致 + baseUrl とキーの整合)。baseUrl を固定した wrapper 関数の引数型に使う。`RoutesConfig<R, B>` は `defineRoutes` の引数の型。

```ts
const BASE = 'https://api.example.com'
export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}
```

## URL の組み立て規則

出力形式は `baseUrl + パス + ?クエリ + #ハッシュ`。

| 要素 | 規則 |
|---|---|
| baseUrl | baseUrl が `/` で終わり、かつキーが `/` で始まるとき、baseUrl 末尾の `/` を1つだけ除いて連結する。それ以外はそのまま連結する(`myapp://` + `/items` → `myapp://items`)。未指定ならキーのみを返す。 |
| params | `[name]` を `encodeURIComponent(String(値))` に置換する。 |
| query | `URLSearchParams` で組み立て、空白(`+`)を `%20` に置き換える(`+` という文字自体は `%2B`)。`undefined` のキーは出力しない。配列は `arr=a&arr=b` のように同じキーを繰り返し、要素は検証せず `String()` で文字列化する。boolean は `true` / `false`、number は `String()` で変換する。 |
| `?` | 出力するクエリが1つもなければ付けない。 |
| hash | `undefined` または `''` なら `#` を付けない。それ以外は `#` + `encodeURIComponent(String(値))`(`0` は `#0`)。 |

例:

```ts
routes['/users']({ q: { page: undefined, tag: ['a', 'b c'] } })
// → https://api.example.com/users?tag=a&tag=b%20c
```

baseUrl を指定しなければ、キーに絶対 URL や独自スキームの URL(`https://api.example1.com/health`、`myapp://path/to/[id]`)を書ける。この場合はキーがそのまま URL の先頭になる。

実行時に値の検証は行わない。型を無視して渡された値もそのまま文字列化する。`null` は型で禁止しているが、渡された場合は他の値と同様に `String(null)` で `"null"` になる(`undefined` のように省略はしない)。

## ファイル構成

```
src/
  index.ts          公開 API の再エクスポート(defineRoutes, type と公開型)
  type.ts           type.* のマーカー定義。index.ts から `export * as type` で公開
  types.ts          型レベルの処理
  compile-url.ts    URL 組み立て(定義時に前処理し、組み立て関数を返す)
  define-routes.ts  defineRoutes 本体
tests/
  compile-url.test.ts     URL 組み立ての実行時テスト
  type.test.ts            マーカーの実行時テスト
  type.test-d.ts          マーカーの型テスト
  define-routes.test.ts   呼び出し経由の実行時テスト
  define-routes.test-d.ts  呼び出し引数の型テスト
  validate.test-d.ts      パスと params の一致の型テスト
  base-url.test-d.ts      baseUrl とキーの整合の型テスト
  utilities.test-d.ts     型ユーティリティと wrapper の型テスト
  compat/
    routopia.test.ts      routopia のテストを翻訳した実行時テスト
    routopia.test-d.ts    routopia のテストを翻訳した型テスト
bench/
  url.bench.ts           URL 生成・ルート定義の性能比較
  size/
    ruroute-all.ts       dist の全 export のサイズ計測用
    ruroute-usage.ts     dist の利用例のサイズ計測用
    ruroute-treeshake.ts dist のツリーシェイキング確認用
    routopia-all.ts      routopia の全 export のサイズ計測用
    routopia-usage.ts    routopia の利用例のサイズ計測用
scripts/
  size.ts               minified / gzip / brotli のサイズ計測
  check-treeshake.ts    未使用マーカーがバンドルに残らないことを検証
docs/
  benchmark.md          性能・バンドルサイズの実測結果
vitest.config.ts        テスト対象とカバレッジ(しきい値 100%)の設定
knip.json               未使用コード検出の設定
lefthook.yml            Git フック(pre-commit: biome / typecheck、pre-push: test / knip / treeshake)
README.md / README.JP.md / LICENSE  公開用ドキュメント
```

### type.ts

- 各マーカーは `{ kind: 'string' }` のような小さなオブジェクト。`literal` / `union` / `array` / `optional` は内側の値も保持する。
- TS 型はファントム型プロパティで持たせる(実行時には存在しない)。
- ソースでは `export * as type` で公開する。tsdown で `type` を別エントリにし、dist の index から `import * as type from './type.mjs'` で参照することで、利用者のバンドラが未使用のマーカーを除去できるようにする。
- モジュール直下で作る `string` / `number` / `boolean` の `schema()` 呼び出しには `/* @__PURE__ */` を付ける。
- `ruroute/type` サブパスも公開する。

### types.ts

- パス文字列から `[name]` を抽出する型(テンプレートリテラル型)。
- メソッド定義から呼び出し引数の型を作る型。正式名/短縮形の両対応、同時指定の禁止、必須値がない場合の引数省略を扱う。
- パスと params キーの一致を検証し、不一致なら定義時に型エラーにする型。
- baseUrl を指定したとき、キーが `/` で始まるパスかを検証する型。この型とパスの検証をまとめた `ValidRoutes`、および `RoutesConfig`。
- `defineRoutes` の返り値の型(ルートごとの呼び出し可能オブジェクト + メソッドプロパティ)。
- 公開する型ユーティリティ `RoutePath` / `RouteArgs` と、公開型 `Schema` / `Infer` / `Empty` / `Route` / `RouteDef` / `Routes`。

### compile-url.ts

- `compileUrl(baseUrl: string | undefined, path: string): (params?, query?, hash?) => string`
- baseUrl との結合は定義時に行う。`[` を含まないパスは URL を定数として持つ。`[` を含むパスは最初の呼び出しで1回だけ分割し、以降は分割結果を使う(ルート定義を軽くするため)。
- 「URL の組み立て規則」をすべて担当する。ルートやメソッドの概念を持たない。

### define-routes.ts

- ルート定義を1回走査し、ルートごとに「呼び出すと get の URL を返す関数」を作る。
- 関数に、定義されたメソッドだけ `.get` / `.post` / `.put` / `.delete` を付ける。
- ルートごとに `compileUrl` を1回呼ぶ。呼び出し時は引数の `p` / `q` / `h` を正式名に揃え、params・query・hash を個別に渡す(オブジェクトを作らない)。

## テスト

実行時(vitest):

- URL 組み立て規則の各項目: params のエンコード、query の `undefined` 省略・配列・boolean・number、`?` の有無、hash の有無とエンコード、baseUrl の有無と、baseUrl 末尾の `/` とキー先頭の `/` が重なるときに baseUrl 末尾の `/` を1つだけ除く結合規則。
- メソッドの呼び分け: 直接呼び出し = get、`.post()` など各メソッド、短縮形引数の正規化。
- baseUrl とキーの結合(境目の `/`、独自スキーム)、絶対 URL のキー、クエリの空白の `%20`、空文字の hash。
- routopia 互換(`tests/compat/routopia.test.ts`)。routopia との違い(null、配列要素、キーのソート)はコメントで明記する。
- カバレッジは `pnpm test:coverage` で 100% を保つ。

型(`expectTypeOf` / `@ts-expect-error`):

- get がないルートの直接呼び出しがエラーになる。
- 定義していないメソッドへのアクセスがエラーになる。
- params の書き漏れ・余分なキー・パスにないのに params を定義、がエラーになる。
- `p` と `params` の同時指定がエラーになる。
- 必須値がないとき引数を省略でき、必須値があるとき省略するとエラーになる。
- 表で「–」の位置への `type` 指定がエラーになる。
- `type.custom<T>()` の `T` がそのまま引数型になり、制約外の `T`(例: params に boolean)がエラーになる。
- `RoutePath` がパスのユニオンになり、`RouteArgs` が呼び出し引数と同じ型になる。未定義メソッド指定がエラーになる。
- baseUrl を指定したとき、`/` で始まらないキーがエラーになり、エラーにメッセージ型が付く。
- `ValidRoutes` を使い、baseUrl を固定した wrapper を書ける。
- routopia 互換(`tests/compat/routopia.test-d.ts`)。

## 後片付け

- 既存の `fn`(`src/index.ts`)と `tests/index.test.ts` は削除する。
- `src/sample.ts`(設計メモ)は削除済み。`tsconfig.json` と `biome.json` に残っていた除外設定も削除した。
