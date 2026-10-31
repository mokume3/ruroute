# ruroute 性能改善・独自スキーム対応・公開整備 設計

対象: `2026-10-29-ruroute-design.md` で実装した ruroute。この文書は追加・変更点だけを定める。実装の際は、元の仕様書も合わせて更新する(「元の仕様書の更新」を参照)。

## 目的と範囲

1. URL 組み立ての前処理を `defineRoutes` 時に1回だけ行い、呼び出しを速くする。
2. 独自 URL スキーム(`myapp://…`)を正式にサポートし、`baseUrl` との結合規則を直す。
3. `baseUrl` を指定したときに、キーがパスでなければ型エラーにする。
4. routopia のテストのうち ruroute に当てはまるパターンを、互換テストとして固定する。
5. npm 公開の準備をする(`ruroute` の後継版。0.4.0 とは API が異なる)。
6. カバレッジ、knip、lefthook を導入し、ベンチマークを拡充する。

### 対象外

- 公開作業(changesets によるバージョン更新・公開)
- 開発時だけ動く実行時チェック(`process.env.NODE_ENV` による分岐)
- routopia にあって ruroute にない機能: mock、catch-all `[...x]` / `[[...x]]`、クエリキーのソート、返り値のテンプレートリテラル推論、実行時バリデーション
- ホストに `[...]` を含む URL(IPv6 リテラル `http://[::1]/`)。`[::1]` がパスパラメータとして解釈されるため使えない。既知の制限として明記する。

## 1. 実行時の構造

### 計測の根拠

変更前の値は `pnpm bench` で計測した。倍率は、試作と変更前の実装を同じ素の Node のループで比べた値(両者の出力が一致することは確認済み)。

| ケース | 変更前 (ops/s) | 試作の倍率 |
|---|---:|---:|
| パラメータなし | 8.29M | 約28倍 |
| パスパラメータ + hash | 3.10M | 約3.8倍 |
| クエリ(配列を含む) | 2.33M | 約1.3倍(`%20` 置換を入れると約1.1倍) |
| ルート定義(100 ルート) | 44K | 約0.94倍 |

クエリを `URLSearchParams` を使わずに手で組み立てる案も試したが、0.78倍と遅くなったため採用しない。

### `src/compile-url.ts`(`src/build-url.ts` を置き換える)

```ts
export type UrlBuilder = (
  params?: Record<string, ParamValue>,
  query?: Record<string, QueryValue>,
  hash?: ParamValue,
) => string

/** baseUrl とパスを前処理し、URL を組み立てる関数を返す。値の検証はしない */
export function compileUrl(baseUrl: string | undefined, path: string): UrlBuilder
```

前処理のタイミング:
- `baseUrl` とパスは、定義時に結合規則(2章)に従ってつなぐ。
- `[` を含むパスは最初の呼び出しで1回だけ `path.split(/\[([^\]]+)\]/)` により静的な部分とパラメータ名が交互に並ぶ配列にし、以降は分割結果を使う。
- `[` を含まないパスでは定義時に URL を定数として持ち、クエリとハッシュを後ろに付けるだけにする。

呼び出しのたびに行う処理:
- params の値を `encodeURIComponent` で埋め込む。
- 値の文字列化は `URLSearchParams.append` / `encodeURIComponent` に任せる(`String()` を呼ばない)。
- クエリは `URLSearchParams` で組み立てる。キーの走査には `Object.keys` を使う(継承したプロパティを拾わないため)。スカラー値は配列に包まず直接 `append` する。最後に `toString()` の結果の `+` を `%20` に置き換える。
- ハッシュを付ける(2章)。

`compileUrl` はルートやメソッドの概念を持たない。

定義時にすべて前処理する方式では、ルート定義(100 ルート)が変更前の約 88% に落ちたため、分割を初回呼び出しまで遅らせた。

### `src/define-routes.ts`

```ts
const url = compileUrl(config.baseUrl, path)
const toUrl = (a?: CallArgs) =>
  url(a?.params ?? a?.p, a?.query ?? a?.q, a?.hash ?? a?.h)
const fn = (a?: CallArgs) => toUrl(a)
for (const method in methods) fn[method as Method] = toUrl
```

- `normalize` と `UrlArgs` によるオブジェクト生成をやめる。
- `Object.assign` は直接代入に変える。
- メソッドのプロパティは、定義したメソッドのキーを `for...in` でそのまま付ける(未知のキーは `type.route()` の型で弾く)。

## 2. URL の組み立て規則(変更点)

| 要素 | 変更前 | 変更後 |
|---|---|---|
| baseUrl とキーの結合 | baseUrl 末尾の `/` をすべて除去する | baseUrl が `/` で終わり、かつキーが `/` で始まるとき、baseUrl 末尾の `/` を **1つだけ** 除去する |
| query の空白 | `+` | `%20`(`+` という文字自体は `%2B` になる) |
| hash | `undefined` のとき `#` を付けない | `undefined` または `''` のとき `#` を付けない。`0` は `#0` |
| query の配列要素 | 記述なし | 検証せず `String()` で文字列化する(`undefined` は `"undefined"` になる)。キーの値が `undefined` のときだけ省略する |

結合の例:

| baseUrl | キー | 結果 |
|---|---|---|
| `https://a.com` | `/x` | `https://a.com/x` |
| `https://a.com/` | `/x` | `https://a.com/x` |
| `myapp://` | `/items/[id]` | `myapp://items/1` |
| `file:///` | `/x` | `file:///x` |
| `/users` | `/[id]` | `/users/1` |
| (なし) | `myapp://path/[id]` | `myapp://path/1` |

- `baseUrl` を指定しなければ、キーに絶対 URL や独自スキームの URL を書ける。
- query の `null` は今までどおり `"null"` として出力する(routopia はキーごと省略する。ruroute では型で `null` を禁止している)。

## 3. 型

### baseUrl とキーの検査

```ts
export function defineRoutes<
  R extends Record<string, RouteDef>,
  const B extends string | undefined = undefined,
>(config: RoutesConfig<R, B>): Routes<R>

export interface RoutesConfig<R, B> {
  baseUrl?: B
  routes: ValidRoutes<R, B>
}

/** ルート定義の検証(パスと params の一致 + baseUrl とキーの整合)。wrapper 関数の引数型に使う */
export type ValidRoutes<R, B = undefined> = R & ValidateRoutes<R> & ValidateBaseUrl<R, B>
```

- `ValidateBaseUrl<R, B>`:
  - `B` が `undefined` だけのとき(baseUrl を省略・`undefined` を渡した場合)は検査しない。`string | undefined` は検査する。
  - それ以外では、`//` で始まるキーと `/` で始まらないキーを、メッセージ型 `'baseUrl を指定したときはキーを / で始まるパスにしてください'` に変える。
  - エラーは `Type 'Empty' is not assignable to type 'Empty & "baseUrl を指定したときは…"'` のように表示される(確認済み)。

判定表:

| 定義 | 結果 |
|---|---|
| baseUrl なし + `https://a.example.com/x` | OK |
| baseUrl が文字列リテラル + `/x`、`/u/[id]` | OK |
| baseUrl が `string` + `/x` | OK |
| baseUrl あり + `https://b.example.com/x` | 型エラー |
| baseUrl あり + `//b.example.com/x` | 型エラー |
| baseUrl あり + `users` | 型エラー |
| baseUrl が `string \| undefined` | 検査する(上の3つは型エラー) |

- キーの型が `string` に広がった定義で baseUrl を指定すると型エラーになる。元の仕様書の「対象外」に追記する。

### 公開型の追加

`index.ts` から `ValidRoutes` と `RoutesConfig` を export する。wrapper の例(README に載せ、型テストで固定する。型引数を書かなくても動くことを確認済み):

```ts
const BASE = 'https://api.example.com'
export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}
```

## 4. 公開整備

### `package.json`

- `name`: `ruroute`
- `version`: `0.4.0`(公開済みの版に揃える。次の版番号は changesets で変更を記録し、リリースのときに `pnpm version-packages` で更新する)
- `description`: `Type-safe route definitions and URL builder`
- `author`、`license`、`homepage`、`repository`、`bugs`: 0.4.0 と同じ(`mokume3 <mokume.dev@gmail.com>`、MIT、`github.com/mokume3/ruroute`)
- `keywords`: `typescript`、`url`、`route`、`builder`、`routing`、`type-safe`
- `"sideEffects": false`
- 追加するスクリプト: `test:coverage`、`knip`、`"prepare": "lefthook install"`

### ドキュメント

- `README.md`(英語)と `README.JP.md`(日本語)を同じ構成で作る。
  - 概要、インストール、Quick Start
  - `type.*` の一覧、型ユーティリティ、wrapper の例
  - URL の組み立て規則、baseUrl と絶対 URL・独自スキームの規則
  - 対象外・既知の制限
  - ベンチマーク(`docs/benchmark.md` へのリンク)
  - 0.4 からの移行: API が変わったことと、対応例
- `LICENSE`(MIT、著作権者 mokume3)を追加する。
- 確認: `npm pack --dry-run` で、パッケージに含まれるのが `dist/*`、`README.md`、`README.JP.md`、`LICENSE`、`package.json` だけであること。

## 5. 開発ツール

追加する devDependencies:

| パッケージ | バージョン |
|---|---|
| `@vitest/coverage-v8` | `5.0.5`(vitest と同じ版に固定) |
| `knip` | `^6.44.0` |
| `lefthook` | `^2.2.2` |

### カバレッジ(`vitest.config.ts` を新規作成)

- `coverage.provider: 'v8'`、`include: ['src/**']`。型だけの `src/types.ts` は除外する。
- しきい値は lines / branches / functions / statements すべて 100%。
- `.gitignore` に `coverage` を追加する。

### knip(`knip.json` を新規作成)

- `entry`: `src/index.ts`、`src/type.ts`、`scripts/*.ts`、`bench/**/*.ts`
- `project`: `src/**`、`tests/**`、`scripts/**`、`bench/**`
- 指摘への対処:
  - `types.ts` の中でしか使っていない export は、export を外す。
  - 型テストから参照しているもの、d.ts の出力に必要なものは残す。
  - 例外として残すものには理由をコメントで書く。

### lefthook(`lefthook.yml` を新規作成)

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: biome
      glob: "*.{ts,js,json,jsonc}"
      run: pnpm biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    - name: typecheck
      run: pnpm typecheck
pre-push:
  parallel: true
  jobs:
    - { name: test, run: pnpm test:coverage }
    - { name: knip, run: pnpm knip }
    - { name: treeshake, run: pnpm check:treeshake }
```

フックは `prepare` スクリプトで登録する。pnpm は依存パッケージの postinstall をブロックするため、lefthook 自体の postinstall には頼れない。

### ついでの整理

`tsconfig.json` の `exclude` と `biome.json` の `includes` に残っている `src/sample.ts` はもう存在しないので削除する。元の仕様書の「後片付け」にある sample.ts の記述も直す。

## 6. テスト

| ファイル | 内容 |
|---|---|
| `tests/compile-url.test.ts` | `build-url.test.ts` を改名して既存ケースを移植する。2章の変更に合わせて期待値を更新する(`b+c` → `b%20c`)。追加するケース: パラメータが先頭・末尾にある、`[a][b]` のように連続する、同じ名前が2回出る、絶対 URL・独自スキームのパス、2章の結合の例、空文字 hash、配列要素の `undefined`、同じ関数を繰り返し呼んでも結果が混ざらない |
| `tests/define-routes.test.ts` | 絶対 URL のキー(`baseUrl` なし、ホストが異なる3ルート)の例を追加する |
| `tests/base-url.test-d.ts`(新規) | 3章の判定表の7ケースと、エラーメッセージ型 |
| `tests/utilities.test-d.ts` | `ValidRoutes` を使った wrapper(推論、書き漏れ・絶対 URL・未定義キーのエラー) |
| `tests/compat/routopia.test.ts`(新規) | routopia の実行時テストを翻訳したもの。各テストに、元の routopia のテスト名をコメントで書く |
| `tests/compat/routopia.test-d.ts`(新規) | routopia の型テストを翻訳したもの。書き方は同上 |

routopia 互換テストの対象(routopia 1.2.3 の `definitions.test.ts`、`definitions.test-d.ts`、`utilities.test.ts` から、ruroute にテストがないものを抜き出した):

- 実行時:
  - ルートとメソッドがすべて生成されること
  - マルチバイト文字のエンコード(params、query、hash)
  - params + query + hash を組み合わせた場合
  - パスを含む baseUrl(`https://example.com/api`)と相対の baseUrl(`/users`)
  - 独自スキーム(キーに書く場合と baseUrl に書く場合)
  - `/` で始まらないキー(baseUrl なし)
  - query の空白(`%20`)、空文字、`null`(ruroute は `"null"`。routopia との違いとしてコメントで残す)
  - 配列要素の `undefined`
  - hash の空文字
- 型:
  - 引数を取らないメソッドの引数が `[]` になること
  - 複数パラメータの呼び出し
  - query がすべて必須の場合
  - params は必須で、query と hash が省略できる場合
  - `queries` を渡すとエラーになること
  - 独自スキームのキーから params が推論されること
  - `custom<null | symbol | () => void | bigint | string[]>` が params でエラーになること
  - hash に `custom<null>`、`array(custom<object>)` がエラーになること
  - `type.route({ get: type.empty, query })` や生のオブジェクトがエラーになること
  - optional な query に `undefined` は渡せて、`null` はエラーになること
  - wrapper パターン

## 7. 計測と合格基準

- `bench/url.bench.ts` に2ケースを追加する。
  - params + query + hash の複合(`/users/[id]/posts/[postId]`)
  - 絶対 URL のキー(routopia と比較)
- `docs/benchmark.md` は、`pnpm bench`、`pnpm size`、`pnpm check:treeshake` を実行し直して全体を更新する。変更前と変更後の比較表も載せる。
- 合格基準:
  - どの呼び出しケースも、変更前より遅くならない。
  - ルート定義(100 ルート)の低下は 10% 以内。
  - `pnpm check:treeshake` が OK。
  - カバレッジ 100%。
  - `pnpm typecheck`、`pnpm lint`、`pnpm knip` がエラーなし。
  - サイズは記録する。増えた場合は理由を書く。

## 元の仕様書の更新

`2026-10-29-ruroute-design.md` の次の箇所を、この文書の内容に合わせて書き直す。

- URL の組み立て規則: 2章
- 公開 API: `ValidRoutes`、`RoutesConfig`、baseUrl とキーの検査
- 対象外: IPv6 リテラル、キーの型が `string` に広がった定義と baseUrl の組み合わせ
- ファイル構成: `compile-url.ts`、`tests/compat/`、`tests/base-url.test-d.ts`、`vitest.config.ts`、`knip.json`、`lefthook.yml`
- テスト
- 後片付け: sample.ts の記述
