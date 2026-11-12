# ruroute 改善・機能拡張提案

作成日: 2026-11-11

Gemini 4 Argon からの提案

## 1. 高速化・パフォーマンス強化（Runtime & Type Check）

### 1-1. 【実行時】クエリ文字列生成の高速化（定義時キーソート & 早期リターン）
現在、`src/compile-url.ts` の `stringifyQuery` が実行時の最大のボトルネックになっている（パラメータなし約 3,958万 ops/s に対し、クエリありは約 386万 ops/s）。

- **課題**:
  - 呼び出しごとに `new URLSearchParams()` の生成、C++ バインディング境界の往復、`search.sort()`、`replaceAll('+', '%20')` が発生する。
  - `query: {}` や全キーが `undefined` / `[]` の場合でも `new URLSearchParams()` が生成される。
- **改善案**:
  1. **定義時のクエリキー事前ソート**:
     `defineRoutes` に渡されるルート定義（`def.methods[m].query`）には、あらかじめキー一覧が存在する。定義時（または初回呼び出し時）にキーをコード単位順でソートした配列 `sortedKeys` を作っておけば、実行時は `for (let i = 0; i < sortedKeys.length; i++)` で走査するだけで済み、**呼び出しごとの `search.sort()` と `for...in` が不要**になる。
  2. **遅延インスタンス化 / 早期リターン**:
     有効な値（`value !== undefined` かつ空配列でない）が最初に見つかるまで `URLSearchParams` の生成（または文字列結合の開始）を遅らせることで、空クエリ時のコストをほぼゼロにする。

```ts
// 例: 有効な値があるときだけ URLSearchParams を生成する
const stringifyQuery = (query: Record<string, QueryValue> | undefined) => {
  if (query == null) return ''
  let search: URLSearchParams | undefined
  for (const key in query) {
    const value = query[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      search ??= new URLSearchParams()
      for (let i = 0; i < value.length; i++) search.append(key, value[i] as string)
    } else {
      search ??= new URLSearchParams()
      search.append(key, value as string)
    }
  }
  if (search === undefined) return ''
  search.sort()
  return `?${search.toString().replaceAll('+', '%20')}`
}
```

---

### 1-2. 【実行時】引数なし（`type.empty`）ルートの特化関数化
現在、`src/define-routes.ts` ではすべてのルートに対して以下のラッパー関数を生成している。

```ts
const fn = (a) => url(a?.params ?? a?.p, a?.query ?? a?.q, a?.hash ?? a?.h)
```

- **課題**:
  - `/health: type.empty` のような引数を一切取らない静的ルートでも、呼び出しごとに `a?.params ?? a?.p` などの評価（6回のオプショナルチェイニングと Nullish Coalescing）と、内部の `compileUrl` 関数呼び出し + `stringifyQuery(undefined)` + `stringifyHash(undefined)` が走っている。
- **改善案**:
  - `def.kind === 'empty'`（かつパスに `[` を含まない）場合は、定義時に確定した文字列 `fixedUrl` を直接返す関数 `() => fixedUrl` を割り当てる。
  - クロージャのネストが2段から1段に減り、呼び出し時の分岐もゼロになる。

---

### 1-3. 【実行時】`compileUrl` における単一パスパラメータの特化とループ最適化
`src/compile-url.ts` のパスパラメータ置換ループ：

```ts
let url = parts[0]
for (let i = 1; i < parts.length; i += 2) {
  url += encodeURIComponent(params?.[parts[i]] as ParamValue) + parts[i + 1]
}
```

- **改善案**:
  - ループ内で毎回 `params?.[...]` とオプショナルチェイニングを行う代わりに、必要時のみ参照するか、最も頻出する「パラメータ1つ（`parts.length === 3`、例: `/users/[id]`）」のケースを三項演算子等で直接連結するとループオーバーヘッドが消える。

---

### 1-4. 【型チェック】`SortKeys` と `IsSafeKey` の Instantiations 削減
`src/types.ts` のクエリ型推論における型計算コスト（現在 `check:type-perf` で約 24.1万 instantiations）のさらなる削減。

- **改善案**:
  1. **単一キー時のソートスキップ**:
     クエリキーが0個または1個の場合は `SortKeys` や `IsSafeKey` の再帰に入り込む前に早期分岐させる。
  2. **`EncodedParam` の簡略化**:
     ```ts
     // 現在
     type EncodedParam<S extends Schema<ParamValue>> =
       Infer<S> extends infer V ? (V extends string ? string : V extends number ? number : never) : never
     ```
     条件型のネストを減らし、ユニオン分配を最小限に抑える。

---

## 2. 軽量化（Bundle Size Optimization）

現在のバンドルサイズ（usage: 1,208 B minified / 713 B gzip）からさらに削減するための施策。

### 2-1. `type.empty` / `type.route` のランタイム構造のフラット化（約 40〜80 B 削減）
現在、`src/type.ts` と `src/define-routes.ts` では判別用タグ `kind` を持つオブジェクトを生成している。

```ts
// 現在 (src/type.ts)
export const empty: Empty = { kind: 'empty' }
export function route(methods?: MethodsDef): Route | Empty {
  return methods === undefined ? empty : { kind: 'route', methods }
}

// 現在 (src/define-routes.ts)
const methods = def.kind === 'route' ? def.methods : { get: def }
```

- **課題**:
  - プロパティ名 `kind`、`methods`、文字列 `'empty'`、`'route'` はバンドラで minify しても名前が短縮されない（または文字列リテラルとして残る）。
  - ルートごとに `{ kind: 'route', methods }` のラッパーオブジェクトが生成されるため、メモリと `defineRoutes` の初期化速度にも影響する。
- **改善案**:
  - 型定義上はファントムプロパティ（unique symbol）で `Empty` と `Route<M>` を区別しつつ、**実行時は `empty = { get: SCHEMA }`、`route = (methods = empty) => methods` のようにメソッド辞書そのものを返す**構造にする。
  - これにより `defineRoutes` 側の `def.kind === 'route' ? def.methods : { get: def }` という分岐自体が丸ごと不要になり（常に `for (const method in def)` で回せる）、**サイズ削減とルート定義（100ルート）の高速化を同時に達成**できる。

---

### 2-2. `compileUrl` 内の微細なコードゴルフ（約 15〜30 B 削減）
可読性とルールを維持した範囲で、生成される JS トークンを減らす。

- **`stringifyHash` の条件式**:
  ```ts
  // 現在
  const stringifyHash = (hash: ParamValue | undefined) =>
    hash === undefined || hash === '' ? '' : `#${encodeURIComponent(hash)}`

  // 改善案（ParamValue は string | number なので 0 以外の falsy は '' と undefined のみ）
  const stringifyHash = (hash: ParamValue | undefined) =>
    hash || hash === 0 ? `#${encodeURIComponent(hash)}` : ''
  ```
- **`base` URL の末尾スラッシュ処理**:
  ```ts
  // 現在
  const base = baseUrl?.endsWith('/') && path.startsWith('/') ? baseUrl.slice(0, -1) : (baseUrl ?? '')
  ```
  `baseUrl` の正規化を `defineRoutes` のループ外で1回だけ行う（`baseUrl?.endsWith('/')` の判定を100ルートなら100回やるのを1回にする）ことで、**100ルート定義ベンチマークの高速化**にも寄与する。

---

## 3. 追加したら良さそうな機能提案

「依存ゼロ・1.5KB未満・ランタイム検証なし・型安全なURLビルダー」という設計思想を崩さずに導入できる機能。

### 3-1. `PATCH` メソッドのサポート（ランタイム増加: 0 B）
- **内容**: `src/types.ts` の `Method` 型に `'patch'` を追加する（`export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'`）。
- **メリット**: REST API で部分更新に `PATCH` を使うケースは非常に多い。`defineRoutes` の実装は `for (const method in methods)` で動的キーを処理しているため、**ランタイムのバンドルサイズ増加は 0 バイト**で対応可能。

### 3-2. パスパラメータへのリテラル型推論の反映（ランタイム増加: 0 B）
- **内容**: 現在 `params: { version: type.literal(['v1', 'v2']) }` としても、返り値の型は `` `/${string}/users` `` にワイドニングされる。これを `` `/${'v1' | 'v2'}/users` ``（さらに呼び出し時に `{ p: { id: 123 } }` と渡した場合は `` `/users/123` ``）のように推論させる。
- **メリット**: ランタイムコスト 0 で、Template Literal 型の強みをさらに活かせる。

### 3-3. ルートパターン文字列の参照プロパティ（例: `.path` または `.pattern`）
- **内容**: 生成された各ルート関数に、パラメータ置換前のテンプレート文字列（例: `'https://api.example.com/users/[id]'` または `'/users/[id]'`）を持たせる。
- **メリット**:
  - TanStack Query / SWR のキャッシュ無効化キーや、MSW（Mock Service Worker）、ロギング・計測基盤で「どのルート定義か」を参照したいケースで役立つ。
  - 実装は `fn.path = path` の1行のみで数バイトで収まる。

### 3-4. ルート定義の分割・マージ / プレフィックス付与ユーティリティ
- **内容**: 大規模開発で機能単位にルート定義を分割したり、`/api/v1` のような共通パスプレフィックスを型安全に付与できる仕組み。
- **メリット**: ルート数が数十〜数百になった際のファイル分割・モジュール化が容易になる。

### 3-5. Catch-all パスパラメータ（`[...slug]`）の軽量サポート
- **内容**: `/docs/[...slug]` のようなパスに対し、`params: { slug: type.array(type.string) }` を許容し、`encodeURIComponent` を `/` で繋いで展開する。
- **メリット**: Next.js / Astro / SvelteKit などのファイルベースルーティングと同じ感覚で内部リンクを管理できるようになる。
