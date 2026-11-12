# ruroute 改善提案(高速化・軽量化・機能追加)

Fable 5.2 による調査

調査日: 2026-11-11 / ブランチ `chore/update-deps-biome-2.6.6`(v0.6.0 + 開発依存の更新) / Node v26.13.0 / Darwin arm64 / tsdown 0.23.7(rolldown 1.3.0) / TypeScript 7.1.0-beta

この文書は提案だけをまとめたもので、`src/` は変更していない。「実測」と書いた数値は、現行の `dist/index.mjs` と同じコードを土台に試作し、手元で計測した値。「見積もり」「未計測」と書いたものは試作していない。

## 要約

| # | 提案 | 分類 | 効果 | minified の増減 | 推奨度 |
|---|---|---|---|---:|:---:|
| [A1](#a1-パスパラメータと-hash-のエンコードを省く-fast-path) | パスパラメータと hash のエンコードを省く fast path | 速度 | エンコード不要な値で 1.5〜1.6 倍、必要な値で 0.82 倍(実測) | +21 B | ◎ |
| [A2](#a2-クエリを-urlsearchparams-なしで組み立てる) | クエリを `URLSearchParams` なしで組み立てる | 速度 | Chromium で 1.5〜3.8 倍、Node で 0.85〜1.7 倍(実測) | +158 B | ○(サイズ予算次第) |
| [A3](#a3-get-だけのルートでメソッド用のオブジェクトを作らない) | GET だけのルートで `{ get: def }` を作らない | 速度・サイズ | `type.empty` のルート定義が 2〜4% 速い(実測) | −7 B | ◎ |
| [B1](#b1-純粋関数アノテーションで未使用のルート定義を落とす) | `@__NO_SIDE_EFFECTS__` を付ける | 軽量化 | 未使用のルート定義が利用者のバンドルから消える(1,114 B → 33 B、実測) | 0 B | ◎ |
| [B2](#b2-細かいバイト削減) | 細かいバイト削減 | 軽量化 | — | −13 B | ○ |
| [B3](#b3-ルートごとのクロージャを-1-つにまとめる) | ルートごとのクロージャを 1 つにまとめる | 軽量化 | ルート定義が 0.91 倍に落ちる(実測) | −36 B | △ |
| [B4](#b4-サイズ計測の見直しと-ci-での上限チェック) | サイズ計測の見直しと CI での上限チェック | 軽量化 | all exports が 1,295 B → 1,357 B に増えているのを検知できていない | — | ◎ |
| [C1](#c1-型推論を省く軽量モード) | 返り値の型推論を省く軽量モード | 型チェック | instantiation が約 1/3(既存の計測値からの見積もり) | 0 B | △ |
| [D1](#d1-http-メソッドの追加) | `patch` / `head` / `options` の追加 | 機能 | 実行時コードの変更なし、instantiation +3.0%(実測) | 0 B | ◎ |
| [D2](#d2-メソッド間で-params-を共有する) | メソッド間で `params` を共有する | 機能 | 定義の重複がなくなる | 数 B(見積もり) | ○ |
| [D3](#d3-params-を省略したときの既定の型) | `params` を省略したときの既定の型 | 機能 | `'/users/[id]': type.empty` と書ける | 0 B | ○ |
| [D4](#d4-可変長パスパラメータ) | 可変長パスパラメータ `[...slug]` | 機能 | routopia との機能差が埋まる | +80〜120 B(見積もり) | ○ |
| [D5](#d5-ルート単位でツリーシェイクできる定義) | ルート単位でツリーシェイクできる定義 | 機能・軽量化 | 使っていないルートの定義が個別に消える | 別 export | ○ |
| [D6](#d6-パターン変換と-url-のマッチを別エントリで提供する) | パターン変換と URL のマッチ(別エントリ) | 機能 | ルーター登録や逆引きに使える | コアは 0 B | △ |
| [D7](#d7-型ユーティリティの追加) | 型ユーティリティの追加 | 機能 | 返り値の URL 型などを取り出せる | 0 B | ○ |

最初に手を付けるなら A1・A3・B1・B4・D1。5 つ合わせても minified の増加は約 +14 B で、1.5 KB の上限に収まる。A2 は効果が大きいが、サイズの上限をどちらの指標で見るかを先に決める必要がある([B4](#b4-サイズ計測の見直しと-ci-での上限チェック))。

## 計測方法

- 速度: 現行の `dist/index.mjs` を写したもの(v0)と各試作を同じプロセスで交互に計測した。250 ms × 9 ラウンドの中央値。`pnpm bench`(vitest)とは計測の枠組みが違うので絶対値は一致しない(たとえば「パラメータなし」は vitest で約 3,900 万 ops/s、この計測では約 1.5 億 ops/s)。倍率だけを見てほしい。
- 出力の一致: 記号・日本語・絵文字・`1e21`・`NaN` などを混ぜた引数を乱数で 20 万通り作り、3 つのルートで現行実装と全試作の出力を比べた。差は 0 件。孤立サロゲートだけは別に確認した([A2](#a2-クエリを-urlsearchparams-なしで組み立てる))。
- サイズ: `scripts/size.ts` と同じ設定(tsdown で minify、依存を同梱)で、`defineRoutes` だけのコア部分を計測した。現行のコアは minified 851 B / gzip 537 B / brotli 471 B。
- ブラウザ: Chromium 156 で、クエリの組み立て関数とエンコード関数だけを取り出して計測した。タブがバックグラウンドの状態だったので絶対値は当てにならないが、現行と試作は交互に測っている。Safari と Firefox は未計測。

## A. 高速化

### A1. パスパラメータと hash のエンコードを省く fast path

`encodeURIComponent` が何も変換しない文字(英数字と `-_.~!*'()`)だけの値なら、呼び出しを省いてそのまま連結する。ID やスラッグはほぼこれに当たる。

```ts
const UNSAFE_COMPONENT = /[^\w.~!*'()-]/

const encodeComponent = (value: ParamValue) => (UNSAFE_COMPONENT.test(value) ? encodeURIComponent(value) : value)
```

`RegExp.prototype.test` は引数を自分で文字列化するので、数値もそのまま渡せる(TypeScript では引数の型を合わせる必要がある)。`1e21` は `'1e+21'` になって `+` が正規表現に掛かるので、従来どおり `1e%2B21` になる。出力は現行と完全に同じ。

| ケース | 現行 (ops/s) | fast path (ops/s) | 倍率 |
|---|---:|---:|---:|
| パスパラメータ + hash(`{ p: { id: 123 }, h: 'top' }`) | 13,511,142 | 22,183,959 | 1.64x |
| パスパラメータ(安全な文字列 `'my-slug_01'`) | 18,604,521 | 28,687,484 | 1.54x |
| パスパラメータ(エンコードが要る `'a b'`) | 16,859,324 | 13,830,857 | 0.82x |
| params + query + hash | 2,614,558 | 2,728,651 | 1.04x |

速度は A3 と B2 も入れた試作での値(この 2 つは呼び出しの速度に影響しない)。

Chromium 156 でエンコード関数だけを比べると、数値で 2.05 倍、安全な文字列で 2.30 倍、エンコードが要る文字列で 0.79 倍だった。

- サイズ: この変更だけで +21 B(gzip +26 B)
- 注意点: エンコードが要る値では、正規表現の検査の分だけ 2 割ほど遅くなる。パスパラメータに日本語や空白を入れる使い方が中心なら採用しない方がよい。
- 数値だけを `typeof` で判定する案も試した。数値は 1.45 倍、文字列は安全でも 0.96 倍で、サイズは +29 B。正規表現の方が速くて小さい。

### A2. クエリを URLSearchParams なしで組み立てる

キーを配列に集めて `sort()` し、文字列連結で組み立てる。`URLSearchParams` が変換しない文字(英数字と `*-._`)だけの値はエンコードを省き、それ以外は `encodeURIComponent` の結果に `!'()~` の変換を足して `URLSearchParams` と同じ出力にする。

```ts
const UNSAFE_QUERY = /[^\w*.-]/
const FORM_EXTRA = /[!'()~]/g

const escapeFormExtra = (char: string) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`

const encodeQuery = (value: Scalar) =>
  UNSAFE_QUERY.test(value) ? encodeURIComponent(value).replace(FORM_EXTRA, escapeFormExtra) : value

const stringifyQuery = (query: Record<string, QueryValue> | undefined) => {
  if (query == null) return ''
  const keys: string[] = []
  for (const key in query) if (query[key] !== undefined) keys.push(key)
  keys.sort()
  let search = ''
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const value = query[keys[keyIndex]]
    const name = `&${encodeQuery(keys[keyIndex])}=`
    if (Array.isArray(value)) {
      for (let valueIndex = 0; valueIndex < value.length; valueIndex++) search += name + encodeQuery(value[valueIndex])
    } else {
      search += name + encodeQuery(value)
    }
  }
  return search && `?${search.slice(1)}`
}
```

Node(A1 を入れた状態との比較):

| ケース | 現行 (ops/s) | 自前組み立て (ops/s) | 倍率 |
|---|---:|---:|---:|
| クエリ(数値 1 個 `{ page: 2 }`) | 7,824,726 | 13,254,167 | 1.69x |
| クエリ(安全な値 3 個) | 3,110,308 | 3,936,879 | 1.27x |
| クエリ(配列・空白を含む `{ page: 2, tag: ['a', 'b c'] }`) | 3,508,167 | 3,479,547 | 0.99x |
| クエリ(日本語の値) | 3,319,977 | 2,831,474 | 0.85x |
| params + query + hash | 2,728,651 | 3,186,580 | 1.17x |

Chromium 156(クエリの組み立て関数だけ):

| ケース | 現行 (ops/s) | 自前組み立て (ops/s) | 倍率 |
|---|---:|---:|---:|
| 数値 1 個 | 3,573,333 | 13,653,333 | 3.82x |
| 安全な値 3 個 | 1,778,368 | 3,094,290 | 1.74x |
| 配列・空白を含む | 2,013,333 | 3,417,553 | 1.70x |
| 日本語の値 | 1,848,404 | 2,792,553 | 1.51x |

`docs/benchmark.md` には「Node では `URLSearchParams` の方が速かった」とある。今回もエンコードが要る値では Node の `URLSearchParams` の方が速く、その結果と矛盾しない。違いは、エンコード不要な値を正規表現で見分けて素通しにした点。Chromium では `URLSearchParams` の呼び出し自体が重く、どのケースでも自前の方が速かった。ブラウザでの利用が中心なら効果は大きい。

- サイズ: +158 B(gzip +69〜80 B)。現在の all exports は 1,357 B なので、これだけを入れると 1,515 B になり 1.5 KB を超える。A1・A3・B2 と一緒に入れた試作はコアが 851 B → 1,010 B(+159 B)で、all exports は約 1,516 B、usage は約 1,367 B になる。B3 も入れれば all exports は約 1,480 B に収まる(見積もり)。
- 挙動の違い: 孤立サロゲート(`'\ud800'` など壊れた文字列)を含むキーや値で、現行は U+FFFD に置き換えて出力するが、この案は `URIError` を投げる。パスパラメータと hash は現行でも `URIError` を投げるので、そちらに揃う形になる。それ以外の出力は一致した。
- 現行と完全に同じ挙動を保つ変種も試した。
  - エンコードが要る値だけ `new URLSearchParams({ '': value })` に通す: +124 B。Node でエンコードが要るケースが 0.61〜0.68 倍に落ちる。
  - 安全な値だけのクエリを自前で組み立て、1 つでも外れたら現行の処理に回す: +337 B。回した場合に 0.68〜0.73 倍に落ちる。

  どちらも上の案より遅くて大きいので勧めない。

### A3. GET だけのルートでメソッド用のオブジェクトを作らない

`type.empty` のルートごとに `{ get: def }` を作って `for...in` で回している。`methods` の有無で分ければ、オブジェクトの生成と `kind === 'route'` の比較がなくなる。

```ts
const methods = 'methods' in def ? def.methods : undefined
if (methods) for (const method in methods) fn[method as Method] = fn
else fn.get = fn
```

- `type.empty` だけの 100 ルートの定義が 2〜4% 速くなった(77,194 → 80,169 ops/s)。`type.route({...})` のルートは変わらない。
- サイズ: −7 B

### 試したが効果がなかった案

- ルートごとのクロージャの統合: 呼び出しは 1.00〜1.05 倍で、ばらつきの範囲。定義は遅くなった([B3](#b3-ルートごとのクロージャを-1-つにまとめる))。
- 引数なしの呼び出しで URL の定数をそのまま返す: 「パラメータなし」は 1.00〜1.01 倍。現行ですでに十分速い。
- クエリのキーをソート順に定義すると型計算が減るかの確認: instantiation は昇順・降順・現状のどれでも 241,410 で変わらなかった。

## B. 軽量化

### B1. 純粋関数アノテーションで未使用のルート定義を落とす

`package.json` の `sideEffects: false` が効くのは、ruroute のモジュールが丸ごと未使用のときだけ。利用者のモジュールにある `export const routes = defineRoutes({...})` は関数呼び出しなので、`routes` をどこからも使っていなくても、バンドラは呼び出しを消せない。ルート定義のモジュールから定数だけを import した場合などに、ライブラリとルート定義がすべて残る。

`defineRoutes` と、関数になっている `type.route` / `literal` / `union` / `custom` / `array` / `optional` に `/* @__NO_SIDE_EFFECTS__ */` を付けると消せるようになる。

| 利用者側のバンドル(ルート定義を export するが使わない) | minified |
|---|---:|
| 現行の dist | 1,114 B |
| アノテーションを付けた dist | 33 B |

- `dist` を手で書き換えて rolldown 1.3.0 で確認した。tsdown のビルドでアノテーションが `dist` に残るかは未確認なので、実装時に確かめる。
- minify 後のサイズは変わらない(コメントなので消える)。
- `scripts/check-treeshake.ts` に「使っていないルート定義が消えること」の検証を足すと、退行を防げる。

### B2. 細かいバイト削減

| 変更 | 増減 | 挙動 |
|---|---:|---|
| `path.startsWith('/')` → `path[0] === '/'` | 約 −8 B(見積もり) | 同じ |
| `hash === undefined \|\| hash === ''` → `(hash ?? '') === ''` | 約 −5 B(見積もり) | `null` を渡したときに `#null` ではなく hash なしになる(型では `null` を渡せない) |

2 つ合わせて −13 B、A3 も入れて −20 B(851 B → 831 B、実測)。A1 を足しても 852 B で、現行とほぼ同じサイズに収まる。

### B3. ルートごとのクロージャを 1 つにまとめる

`compileUrl` が返す関数と、`defineRoutes` で `params` / `p` などを取り出す関数を 1 つにする。

- サイズ: −36 B(A3 と合わせて −43 B、851 B → 808 B、実測)
- 速度: 呼び出しは変わらない。100 ルートの定義は 0.91 倍に落ちた(125,153 → 113,737 ops/s)。1 ルートあたり約 8 ns の増加で、原因は調べていない。

絶対値としては小さいが、`docs/benchmark.md` でルート定義の速さを売りにしているので、サイズに困ったとき(A2 を入れるときなど)の選択肢に留める。

### B4. サイズ計測の見直しと CI での上限チェック

今回 `pnpm size` を実行した結果:

| bundle | minified (B) | gzip (B) | brotli (B) |
|---|---:|---:|---:|
| ruroute (all exports) | 1,357 | 811 | 714 |
| ruroute (usage) | 1,208 | 713 | 636 |

`docs/benchmark.md` の all exports は 1,295 / 777 / 681 B で、ソースが同じなのに 62 B 増えている。usage は変わっていない。増えたのは、`export * as type` をバンドルしたときに rolldown が生成する名前空間オブジェクトのヘルパで、tsdown / rolldown の更新で大きくなった。このヘルパは all exports のうち 361 B を占めるが、`type.number` のように使う利用者のバンドルには入らない(usage には出ていない)。

提案:

1. 「1.5 KB 未満」をどの指標で見るかを決める。all exports はバンドラの版で 60 B 単位で動くので、usage か、コアだけ(`defineRoutes` + `type.*` を個別に import したもの)を基準にする方が安定する。
2. `pnpm size` に上限チェックを足して CI で実行する。いまの CI は `check:treeshake` と `check:type-perf` だけで、サイズの増加は検知できない。
3. `docs/benchmark.md` の all exports の値を更新する。

## C. 型チェックの負荷

現状は `pnpm check:type-perf` で 241,410 instantiations / 0.070 s。上限 300,000 に対して約 2 割の余裕がある。

### C1. 型推論を省く軽量モード

`docs/benchmark.md` によると、返り値の URL 型を推論しなかった頃は同じ負荷用コードで 84,070 instantiations だった。現状の約 1/3 にあたる。数百ルートの定義でエディタの応答が気になる利用者向けに、返り値を `string` にする型を選べるようにする案。

- 実行時コードは変わらない。
- 未計測。40 ルート・クエリキー 10 個という厳しい条件でも 0.07 s なので、実際に困っている利用者が出てから検討すれば足りる。

## D. 機能追加

### D1. HTTP メソッドの追加

`patch` / `head` / `options` を足す。実行時は `for...in` で定義されたキーをそのまま付けているので、`Method` 型にメンバーを足すだけで動く。

- 実行時コード: 変更なし(0 B)
- 型チェック: 7 メソッドにした場合、241,410 → 248,613 instantiations(+3.0%、実測)
- README の Unsupported に `patch` が挙がっている。意図して 4 つに絞っているなら見送り。

### D2. メソッド間で params を共有する

README にあるとおり、パスパラメータはルートのすべてのメソッドに定義する必要がある。

```ts
'/users/[id]': type.route({
  get: { params: { id: type.number } },
  delete: { params: { id: type.number } },
})
```

ルートの階層で 1 回だけ書けるようにする。

```ts
'/users/[id]': type.route({
  params: { id: type.number },
  get: { query: { tab: type.optional(type.string) } },
  delete: type.empty,
})
```

- 実行時: メソッドを付ける `for...in` が `params` キーも拾うので、除外が要る(数 B、見積もり)。`type.route(params, methods)` のように引数を分ければ実行時コードは変わらない。
- 型: `ValidateMethod` と `MethodArgs` でルートの `params` を合成する。instantiation への影響は未計測。

### D3. params を省略したときの既定の型

いまは `'/users/[id]': type.empty` が型エラーになる。`params` を書かなかった `[name]` を `string | number` として扱えば、外部サイトへのリンクのような「型を絞るまでもない」ルートを 1 行で書ける。

- 実行時コード: 変更なし
- 懸念: `params` の書き漏れを型エラーで知らせる現在の検証が弱くなる。キーの綴り間違い(`[id]` に対して `userId`)は引き続きエラーにできる。

### D4. 可変長パスパラメータ

`[...slug]`(1 個以上)と `[[...slug]]`(0 個以上)。README で routopia を勧めている理由の 1 つがなくなる。

- 値は `readonly string[]`。要素ごとにエンコードして `/` でつなぐ。
- 実行時: 遅延分割のときに名前の `...` を見て印を付け、ループで配列を処理する。+80〜120 B(見積もり)。all exports の残り予算(約 140 B)の大半を使うので、all exports を基準にする限り A2 とは両立しない。
- 型: `PathParams` と `ReplacePathParams` に分岐が増える。未計測。

### D5. ルート単位でツリーシェイクできる定義

`defineRoutes` は 1 つのオブジェクトを返すので、バンドラは使っていないルートを個別には消せない。ルートが数百あるアプリでは、ライブラリ本体よりルート定義(パス文字列とスキーマの呼び出し)の方が大きくなる。

```ts
export const userRoute = defineRoute('/users/[id]', { get: { params: { id: type.number } } })
```

1 ルートを 1 つの関数として返す export を足し、B1 のアノテーションを付ければ、import されなかったルートは定義ごと消える。`compileUrl` をそのまま使えるので、追加のコードは小さい(未計測)。

### D6. パターン変換と URL のマッチを別エントリで提供する

- `'/users/[id]'` → `'/users/:id'` の変換(Hono / Express などへのルート登録用)。型でも変換できる。
- URL からルートと `params` を逆引きするマッチ。

どちらも `ruroute/pattern` のような別エントリにすれば、コアのサイズは変わらない。README の Unsupported に「URL のパース」とあるので、方針として入れないなら見送り。

### D7. 型ユーティリティの追加

`RouteArgs` と同じ形で、次の型を公開する。実行時コードは変わらない。

- `RouteUrl<T, P, M>`: 返り値の URL 型
- `RouteParams<T, P, M>` / `RouteQuery<T, P, M>`: `params` / `query` だけの型

fetch のラッパーや、フォームの値からクエリを作る関数の引数に使える。

### 見送りを勧めるもの

- 実行時の値の検証(zod などとの連携): 「型だけで実行時は何もしない」という設計の中心と逆向きで、サイズも大きく増える。
- クエリ配列の書式の切り替え(`tags[]=a` やカンマ区切り): 呼び出しごとの分岐が増える。要望が出てからでよい。
- Proxy でルートを遅延生成する: 定義は速くなるが、呼び出しのたびにトラップを通るので、呼び出しが遅くなる(未計測)。

## 進め方の案

1. B4(サイズの基準を決めて CI に上限チェックを入れる)。以降の変更の効果と退行を測れるようにする。
2. A3 + B2 + A1。合わせて +1 B で、パスパラメータの呼び出しが約 1.5 倍になる。
3. B1(アノテーション)と `check:treeshake` の拡張。
4. D1(メソッド追加)と D7(型ユーティリティ)。実行時コードに触れない。
5. A2(クエリの自前組み立て)。サイズの基準と、孤立サロゲートで例外になる挙動の変更を受け入れるかを決めてから。
6. D2〜D6 は要望と残りのサイズ予算を見て個別に判断する。
