# ruroute

ruroute は、テンプレート文字列から型安全なルート関数を生成する TypeScript 向け URL ビルダーです。

English README: [README.md](./README.md)

## 特徴

- テンプレートとパラメータの強力な型チェック
- パス・クエリ・ハッシュ値の自動 URL エンコード
- オプショナルなクエリパラメータに対応
- `?query#hash` と `#hash?query` の両方の順序に対応
- カスタムスキームと通常のパスの両方で利用可能

## インストール

```bash
pnpm add ruroute
```

## クイックスタート

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute();

const userRoute = ruroute("/users/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

const url = userRoute({
  id: "42",
  tab: "profile",
  section: "overview",
});

// /users/42?tab=profile#overview
```

## テンプレート構文

- パスパラメータ: `:name`
- クエリキー: `?key1&key2`
- ハッシュキー: `#hashKey`

例:

- `/users/:id`
- `/search?keyword&page`
- `/docs/:slug#section`
- `app://start/:id?tab#section`
- `app://start#section?tab`

## 使用パターン (TypeScript)

### 1. パス + クエリ + ハッシュ

```ts
import { createRuroute } from "ruroute";

const route = createRuroute()("app://start/:param1/www/:param2?query1&query2#hash").types<{
  param1: string;
  param2: string;
  query1: number;
  query2?: string;
  hash: string;
}>();

const url = route({
  param1: "value1",
  param2: "value2",
  query1: 123,
  hash: "overview",
});

// app://start/value1/www/value2?query1=123#overview
```

### 2. オプショナルクエリ

クエリ値が `undefined` の場合、そのキーは出力に含まれません。

```ts
import { createRuroute } from "ruroute";

const route = createRuroute()("/search?keyword&page").types<{
  keyword: string;
  page?: number;
}>();

route({ keyword: "hello world" });
// /search?keyword=hello%20world
```

### 3. ハッシュ先行 (`#...?...`)

出力順はテンプレートの順序を維持します。

```ts
import { createRuroute } from "ruroute";

const route = createRuroute()("app://start#hash?query1&query2").types<{
  hash: string;
  query1: string;
  query2?: number;
}>();

route({ hash: "section", query1: "tab top" });
// app://start#section?query1=tab%20top
```

### 4. 静的ルート

```ts
import { createRuroute } from "ruroute";

interface EmptyRouteParams {
  [key: string]: never;
}

const route = createRuroute()("/about").types<EmptyRouteParams>();

route({});
// /about
```

### 5. 再利用可能なルート定義

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute();

const routes = {
  user: ruroute("/users/:id").types<{ id: string }>(),
  post: ruroute("/posts/:postId?preview").types<{
    postId: string;
    preview?: boolean;
  }>(),
};

const userUrl = routes.user({ id: "u_1" });
const postUrl = routes.post({ postId: "p_1", preview: true });
```

## 型安全に関する補足

- パスとハッシュのパラメータは必須で、`.types<T>()` 上では `string` である必要があります。
- テンプレート上のクエリキーは `T` に含まれている必要があります。
- 実行時のクエリ値は `string | number | boolean | undefined` を受け付けます。

```ts
import { createRuroute } from "ruroute";

const route = createRuroute()("/users/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

// @ts-expect-error - 必須パスパラメータ不足
route({ tab: "profile", section: "overview" });

// @ts-expect-error - ハッシュパラメータ不足
route({ id: "42", tab: "profile" });
```

## 実行時の挙動

- 必須のパス/ハッシュ値が不足している場合はエラーを throw します。
- テンプレートに重複キーがある場合、非 production 環境で警告を出します。
- ワイルドカードパス (`*`) とオプショナルパス構文 (`:id?`) は非対応です。

## API

### `createRuroute(options?)`

ルートファクトリを作成します。

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute();
```

#### オプション

- `prefix?: string` — 相対パスの先頭に文字列を付与します（スキーム付き URL では無視されます）

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute({ prefix: "/api/v1" });

const userRoute = ruroute("/users/:id").types<{ id: string }>();
userRoute({ id: "42" });
// → "/api/v1/users/42"
```

### `ruroute(template).types<T>()`

テンプレートをコンパイルし、次の関数を返します。

```ts
(params: T) => string
```

## 開発

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check
```
