# ruroute 性能改善・独自スキーム対応・公開整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-10-30-ruroute-perf-and-publish-design.md` の内容を実装する。具体的には次のとおり。
- URL 組み立てを定義時の前処理で速くする
- 独自 URL スキームに対応する
- baseUrl とキーの整合を型で検査する
- routopia 互換テストを追加する
- カバレッジ・knip・lefthook を導入する
- npm 公開の準備をする
- ベンチマークを拡充する

**Architecture:** URL の組み立ては `compileUrl(baseUrl, path)` に移す。この関数は、baseUrl との結合とパスの分割を定義時に1回だけ行い、params・query・hash を個別の引数で受け取る関数を返す。`defineRoutes` は `p`/`q`/`h` を正式名に揃えてこの関数を呼ぶだけで、オブジェクトは作らない。baseUrl とキーの整合は `ValidRoutes<R, B>` 型で検査し、wrapper 関数でも使えるよう公開する。

**Tech Stack:** TypeScript 7.0(`tsc`)、tsdown 0.23、vitest 5.0.5(+ `@vitest/coverage-v8`)、Biome 2.6、knip 6、lefthook 2、pnpm 12、Node 26

## Global Constraints

- 実行時の依存パッケージは追加しない(`dependencies` は空のまま)。
- devDependencies に追加してよいのは、次の3つだけ。
  - `@vitest/coverage-v8@5.0.5`(バージョン固定)
  - `knip@^6.44.0`
  - `lefthook@^2.2.2`
  - ユーザーは追加を承認済み。
- 実行時バリデーションは実装しない。値はすべて `String()` で文字列化する。
- URL の出力を変えてよいのは、spec の2章にある4点だけ。それ以外の出力は変更前と同じにする。
  1. baseUrl とキーの結合
  2. クエリの空白を `%20` にする
  3. 空文字の hash を省略する
  4. 配列要素の扱いを明記する
- コードスタイルは Biome の設定に従う(シングルクォート、セミコロンなし、2スペース、行幅 80)。各タスクのコミット前に `pnpm lint` を通す。`pnpm lint:fix` で自動修正できる。
- `pnpm lint:fix` で型テスト(`*.test-d.ts`)の行が折り返されると、`@ts-expect-error` が対象の行を指さなくなることがある。lint:fix の後は必ず `pnpm typecheck` を実行し直す。`Unused '@ts-expect-error' directive` が出たら、コメントを、エラーが報告される行の直前に移す。
- 型テスト(`tests/**/*.test-d.ts`)は `pnpm typecheck`(`tsc --noEmit -p tsconfig.test.json`)で検証する。`vitest --typecheck` は使わない(TS 7 では `@ts-expect-error` の未使用を検出できないため)。
- 実行時テストは `pnpm exec vitest run` で実行する(`pnpm test` は watch モードになる)。
- `.npmrc` に関する `Failed to replace env in config: ${GITHUB_PACKAGES_TOKEN}` という警告は、利用者の環境によるもの。無視してよい。
- 作業ブランチは現在のブランチ(`chore/refactoring-opportunities`)。push しない。
- コミットメッセージの末尾には次の行を付ける。
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- lefthook のフック(Task 6 以降)は、git の共通ディレクトリにある `hooks/` に入る。そのため、このリポジトリの他の worktree にも適用される。

## File Structure

| ファイル | 役割 | タスク |
|---|---|---|
| `vitest.config.ts` | テスト対象とカバレッジの設定 | Task 1 で作成 |
| `src/compile-url.ts` | `compileUrl`(URL 組み立て。`src/build-url.ts` を置き換える) | Task 2 で作成 |
| `src/define-routes.ts` | `defineRoutes` 本体 | Task 2・3 で変更 |
| `src/types.ts` | `ValidRoutes` / `RoutesConfig` を追加する。内部でしか使わない型の export を外す | Task 3・5 で変更 |
| `src/index.ts` | 公開型を追加する | Task 3 で変更 |
| `tests/compile-url.test.ts` | `compileUrl` の実行時テスト(`tests/build-url.test.ts` を置き換える) | Task 2 |
| `tests/define-routes.test.ts` | 絶対 URL のキーの例を追加する | Task 2 |
| `tests/base-url.test-d.ts` | baseUrl とキーの整合の型テスト | Task 3 |
| `tests/utilities.test-d.ts` | wrapper の型テストを追加する | Task 3 |
| `tests/compat/routopia.test.ts` / `.test-d.ts` | routopia 互換テスト | Task 4 |
| `knip.json` | knip の設定 | Task 5 |
| `tsconfig.json` / `biome.json` | `src/sample.ts` の記述を削除する | Task 5 |
| `lefthook.yml` | Git フック | Task 6 |
| `package.json` | スクリプト(Task 1・5・6)、公開用メタ情報(Task 7) | 複数 |
| `README.md` / `README.JP.md` / `LICENSE` | 公開用ドキュメント | Task 7 |
| `bench/url.bench.ts` | 複合ケースと絶対 URL のキーのケースを追加する | Task 8 |
| `docs/benchmark.md` | 計測し直した結果 | Task 8 |
| `docs/superpowers/specs/2026-10-29-ruroute-design.md` | 元の仕様書を、各タスクの内容に合わせて更新する | Task 2・3・5・8 |

削除するファイル: `src/build-url.ts` と `tests/build-url.test.ts`(Task 2)。

---

### Task 1: カバレッジを導入する

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`(devDependencies と scripts)、`pnpm-lock.yaml`、`.gitignore`

**Interfaces:**
- Consumes: なし
- Produces: `pnpm test:coverage` コマンド(`vitest run --coverage`)。しきい値は 100%。後続のタスクはすべて、このコマンドが通る状態を保つ。

- [ ] **Step 1: パッケージを追加する**

```bash
pnpm add -D -E @vitest/coverage-v8@5.0.5
```

Expected: `package.json` の devDependencies に `"@vitest/coverage-v8": "5.0.5"` が入る。

- [ ] **Step 2: 設定ファイルを作る**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // 型だけのファイル
      exclude: ['src/types.ts'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})
```

`package.json` の `scripts` で、`"test": "vitest",` の次の行に追加する:

```json
    "test:coverage": "vitest run --coverage",
```

`.gitignore` の末尾に追加する:

```
coverage
```

- [ ] **Step 3: 実行して確認する**

Run: `pnpm test:coverage`
Expected: すべてのテストが PASS する。カバレッジ表では `src/build-url.ts`、`src/define-routes.ts`、`src/index.ts`、`src/type.ts` の4指標がすべて 100 で、しきい値エラーは出ない。

100 未満の行が出た場合: 表の `Uncovered Line #s` に出た行を通るテストを、該当する `tests/*.test.ts` に追加し、100 にする。

- [ ] **Step 4: lint を確認してコミットする**

Run: `pnpm lint`
Expected: エラーなし

```bash
git add vitest.config.ts package.json pnpm-lock.yaml .gitignore
git commit -m "chore: add coverage with 100% thresholds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: compileUrl に置き換える(性能改善と結合規則の修正)

**Files:**
- Create: `src/compile-url.ts`
- Create: `tests/compile-url.test.ts`
- Delete: `src/build-url.ts`、`tests/build-url.test.ts`
- Modify: `src/define-routes.ts`、`tests/define-routes.test.ts`
- Modify: `docs/superpowers/specs/2026-10-29-ruroute-design.md`

**Interfaces:**
- Consumes: `src/types.ts` の `ParamValue`、`QueryValue`、`Method`、`RouteDef`、`Routes`、`ValidateRoutes`
- Produces:
  - `src/compile-url.ts`: `export function compileUrl(baseUrl: string | undefined, path: string): UrlBuilder`
  - `type UrlBuilder = (params?: Record<string, ParamValue>, query?: Record<string, QueryValue>, hash?: ParamValue) => string`
  - `src/define-routes.ts`: シグネチャは変更前のまま `defineRoutes<R>(config: RoutesConfig<R>): Routes<R>`。`RoutesConfig` は Task 3 で types.ts に移す。

- [ ] **Step 1: 失敗するテストを書く**

`tests/compile-url.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { compileUrl } from '../src/compile-url'

describe('compileUrl: baseUrl とパス', () => {
  test('baseUrl なしはパスのみ', () => {
    expect(compileUrl(undefined, '/users')()).toBe('/users')
  })

  test('baseUrl とキーの境目の / を1つにする', () => {
    expect(compileUrl('https://api.example.com', '/users')()).toBe(
      'https://api.example.com/users',
    )
    expect(compileUrl('https://api.example.com/', '/users')()).toBe(
      'https://api.example.com/users',
    )
    expect(compileUrl('/users', '/[id]')({ id: 1 })).toBe('/users/1')
  })

  test('独自スキームの baseUrl でも // を保つ', () => {
    expect(compileUrl('myapp://', '/items/[id]')({ id: 1 })).toBe(
      'myapp://items/1',
    )
    expect(compileUrl('file:///', '/x')()).toBe('file:///x')
    expect(compileUrl('myapp://host', '/items')()).toBe('myapp://host/items')
  })

  test('キーが / で始まらなければ baseUrl をそのまま連結する', () => {
    expect(compileUrl('https://a.example.com/', 'users')()).toBe(
      'https://a.example.com/users',
    )
  })

  test('絶対 URL・独自スキームのキー', () => {
    expect(
      compileUrl(undefined, 'https://api.example3.com/users/[id]')({ id: 1 }),
    ).toBe('https://api.example3.com/users/1')
    expect(compileUrl(undefined, 'myapp://path/to/[id]')({ id: 1 })).toBe(
      'myapp://path/to/1',
    )
  })

  test('baseUrl の [ ] はパラメータとして扱わない', () => {
    expect(compileUrl('http://[::1]:8080', '/users/[id]')({ id: 1 })).toBe(
      'http://[::1]:8080/users/1',
    )
  })
})

describe('compileUrl: params', () => {
  test('params を置換しエンコードする', () => {
    expect(
      compileUrl(undefined, '/users/[id]/posts/[postId]')({
        id: 1,
        postId: 'a/b c',
      }),
    ).toBe('/users/1/posts/a%2Fb%20c')
  })

  test('パラメータの位置: 先頭・末尾・連続・同じ名前が2回', () => {
    expect(compileUrl(undefined, '[a]/x')({ a: 1 })).toBe('1/x')
    expect(compileUrl(undefined, '/x/[a]')({ a: 1 })).toBe('/x/1')
    expect(compileUrl(undefined, '/[a][b]')({ a: 1, b: 2 })).toBe('/12')
    expect(compileUrl(undefined, '/[a]/[a]')({ a: 'z' })).toBe('/z/z')
  })

  test('params を渡さなければ "undefined" になる(検証しない)', () => {
    expect(compileUrl(undefined, '/users/[id]')()).toBe('/users/undefined')
  })
})

describe('compileUrl: query', () => {
  test('undefined は省略、配列は同じキーを繰り返す', () => {
    expect(
      compileUrl(undefined, '/users')(undefined, {
        page: undefined,
        tag: ['a', 'b c'],
        active: true,
        n: 0,
      }),
    ).toBe('/users?tag=a&tag=b%20c&active=true&n=0')
  })

  test('空白は %20、+ は %2B', () => {
    expect(compileUrl(undefined, '/s')(undefined, { q: 'a b+c' })).toBe(
      '/s?q=a%20b%2Bc',
    )
  })

  test('出力するクエリがなければ ? を付けない', () => {
    expect(compileUrl(undefined, '/users')(undefined, {})).toBe('/users')
    expect(compileUrl(undefined, '/users')(undefined, { a: undefined })).toBe(
      '/users',
    )
  })

  test('null は検証せず "null" として出力する', () => {
    const query = { a: null } as unknown as Record<string, string>
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe('/x?a=null')
  })

  test('query に null を渡しても例外にせず ? を付けない(検証しない)', () => {
    const query = null as unknown as Record<string, string>
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe('/x')
  })

  test('配列の要素は検証せず String() で文字列化する', () => {
    const query = { tag: ['a', undefined] } as unknown as Record<
      string,
      string[]
    >
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe(
      '/x?tag=a&tag=undefined',
    )
  })

  test('boolean の false と空配列', () => {
    expect(
      compileUrl(undefined, '/x')(undefined, { a: false, tag: [] }),
    ).toBe('/x?a=false')
  })
})

describe('compileUrl: hash', () => {
  test('hash はクエリの後ろにエンコードして付ける', () => {
    expect(compileUrl(undefined, '/docs')(undefined, { a: 'x' }, 'sec 1')).toBe(
      '/docs?a=x#sec%201',
    )
    expect(compileUrl(undefined, '/docs')(undefined, undefined, 0)).toBe(
      '/docs#0',
    )
  })

  test('undefined と空文字は # を付けない', () => {
    expect(compileUrl(undefined, '/docs')(undefined, undefined, undefined)).toBe(
      '/docs',
    )
    expect(compileUrl(undefined, '/docs')(undefined, undefined, '')).toBe(
      '/docs',
    )
  })
})

describe('compileUrl: 繰り返し呼び出し', () => {
  test('同じ関数を繰り返し呼んでも結果が混ざらない', () => {
    const user = compileUrl('https://a.example.com', '/u/[id]')
    expect(user({ id: 1 }, { q: 'x' }, 'h')).toBe(
      'https://a.example.com/u/1?q=x#h',
    )
    expect(user({ id: 2 })).toBe('https://a.example.com/u/2')

    const search = compileUrl(undefined, '/s')
    expect(search(undefined, { a: '1' }, 'h')).toBe('/s?a=1#h')
    expect(search()).toBe('/s')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run tests/compile-url.test.ts`
Expected: FAIL(`Failed to resolve import "../src/compile-url"`)

- [ ] **Step 3: compileUrl を実装する**

`src/compile-url.ts`:

```ts
import type { ParamValue, QueryValue } from './types'

export type UrlBuilder = (
  params?: Record<string, ParamValue>,
  query?: Record<string, QueryValue>,
  hash?: ParamValue,
) => string

const PARAM = /\[([^\]]+)\]/

/** baseUrl とパスを前処理し、URL を組み立てる関数を返す。値の検証はしない */
export function compileUrl(
  baseUrl: string | undefined,
  path: string,
): UrlBuilder {
  const base =
    baseUrl?.endsWith('/') && path.startsWith('/')
      ? baseUrl.slice(0, -1)
      : (baseUrl ?? '')
  // [静的, 名前, 静的, 名前, …, 静的]。baseUrl の [ ] は分割しない
  const parts = path.split(PARAM)
  parts[0] = base + parts[0]

  if (parts.length === 1) {
    const url = parts[0]
    return (_params, query, hash) =>
      url + stringifyQuery(query) + stringifyHash(hash)
  }
  return (params, query, hash) => {
    let url = parts[0]
    for (let i = 1; i < parts.length; i += 2) {
      url += encodeURIComponent(String(params?.[parts[i]])) + parts[i + 1]
    }
    return url + stringifyQuery(query) + stringifyHash(hash)
  }
}

function stringifyQuery(query: Record<string, QueryValue> | undefined) {
  if (query == null) return ''
  const search = new URLSearchParams()
  for (const key of Object.keys(query)) {
    const value = query[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v))
    } else {
      search.append(key, String(value))
    }
  }
  const s = search.toString()
  // URLSearchParams は空白を + にする。+ という文字自体は %2B になるので置き換えてよい
  return s && `?${s.replaceAll('+', '%20')}`
}

const stringifyHash = (hash: ParamValue | undefined) =>
  hash === undefined || hash === ''
    ? ''
    : `#${encodeURIComponent(String(hash))}`
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run tests/compile-url.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: defineRoutes を compileUrl に切り替える**

`src/define-routes.ts` を次の内容で置き換える:

```ts
import { compileUrl } from './compile-url'
import type {
  Method,
  ParamValue,
  QueryValue,
  RouteDef,
  Routes,
  ValidateRoutes,
} from './types'

const METHODS = [
  'get',
  'post',
  'put',
  'delete',
] as const satisfies readonly Method[]

type Params = Record<string, ParamValue>
type Query = Record<string, QueryValue>

interface CallArgs {
  params?: Params
  p?: Params
  query?: Query
  q?: Query
  hash?: ParamValue
  h?: ParamValue
}

type UrlFn = (args?: CallArgs) => string

export interface RoutesConfig<R> {
  baseUrl?: string
  routes: R & ValidateRoutes<R>
}

export function defineRoutes<R extends Record<string, RouteDef>>(
  config: RoutesConfig<R>,
): Routes<R> {
  const result: Record<string, unknown> = {}
  const routes: Record<string, RouteDef> = config.routes
  for (const [path, def] of Object.entries(routes)) {
    const url = compileUrl(config.baseUrl, path)
    const toUrl: UrlFn = (a) =>
      url(a?.params ?? a?.p, a?.query ?? a?.q, a?.hash ?? a?.h)
    const methods = def.kind === 'route' ? def.methods : { get: def }
    const fn: UrlFn & { [M in Method]?: UrlFn } = (a) => toUrl(a)
    for (const method of METHODS) {
      if (method in methods) fn[method] = toUrl
    }
    result[path] = fn
  }
  return result as Routes<R>
}
```

旧ファイルを削除する:

```bash
git rm src/build-url.ts tests/build-url.test.ts
```

- [ ] **Step 6: 絶対 URL のキーの実行時テストを追加する**

`tests/define-routes.test.ts` の末尾に追加する:

```ts
describe('絶対 URL のキー', () => {
  test('baseUrl なしならキーに別ホストの URL を書ける', () => {
    const r = defineRoutes({
      routes: {
        'https://api.example1.com/health': type.empty,
        'https://api.example2.com/users': type.route({
          get: { query: { page: type.optional(type.number) } },
          post: type.empty,
        }),
        'https://api.example3.com/users/[id]': type.route({
          get: {
            params: { id: type.number },
            hash: type.optional(type.string),
          },
        }),
      },
    })
    expect(r['https://api.example1.com/health']()).toBe(
      'https://api.example1.com/health',
    )
    expect(r['https://api.example2.com/users']({ q: { page: 2 } })).toBe(
      'https://api.example2.com/users?page=2',
    )
    expect(r['https://api.example2.com/users'].post()).toBe(
      'https://api.example2.com/users',
    )
    expect(
      r['https://api.example3.com/users/[id]']({ p: { id: 1 }, h: 'top' }),
    ).toBe('https://api.example3.com/users/1#top')
  })

  test('baseUrl が独自スキームでも // を保つ', () => {
    const r = defineRoutes({
      baseUrl: 'myapp://',
      routes: {
        '/items/[id]': type.route({ get: { params: { id: type.number } } }),
      },
    })
    expect(r['/items/[id]']({ p: { id: 1 } })).toBe('myapp://items/1')
  })
})
```

- [ ] **Step 7: すべてのテストを確認する**

Run: `pnpm test:coverage`
Expected:
- 全テストが PASS する。
- カバレッジは `src/compile-url.ts`、`src/define-routes.ts`、`src/index.ts`、`src/type.ts` がすべて 100%。

Run: `pnpm typecheck`
Expected: エラーなし

Run: `pnpm check:treeshake`
Expected: `tree-shaking OK (… B minified)`

Run: `pnpm bench`
Expected(参考値。正式な計測は Task 8 で行う):
- 「パラメータなし」と「パスパラメータ + hash」の ruroute の値が、ベースライン(8.29M / 3.10M ops/s)より大きい。
- 「クエリ(配列を含む)」の ruroute の値が 2.33M 以上。

- [ ] **Step 8: 元の仕様書を更新する**

`docs/superpowers/specs/2026-10-29-ruroute-design.md` を次のように変更する。

「URL の組み立て規則」の表で、baseUrl・query・hash の3行を次に置き換える:

```markdown
| baseUrl | baseUrl が `/` で終わり、かつキーが `/` で始まるとき、baseUrl 末尾の `/` を1つだけ除いて連結する。それ以外はそのまま連結する(`myapp://` + `/items` → `myapp://items`)。未指定ならキーのみを返す。 |
| query | `URLSearchParams` で組み立て、空白(`+`)を `%20` に置き換える(`+` という文字自体は `%2B`)。`undefined` のキーは出力しない。配列は `arr=a&arr=b` のように同じキーを繰り返し、要素は検証せず `String()` で文字列化する。boolean は `true` / `false`、number は `String()` で変換する。 |
| hash | `undefined` または `''` なら `#` を付けない。それ以外は `#` + `encodeURIComponent(String(値))`(`0` は `#0`)。 |
```

例の出力 `// → https://api.example.com/users?tag=a&tag=b+c` を `// → https://api.example.com/users?tag=a&tag=b%20c` にする。

例のコードブロックの直後に、次の段落を追加する:

```markdown
baseUrl を指定しなければ、キーに絶対 URL や独自スキームの URL(`https://api.example1.com/health`、`myapp://path/to/[id]`)を書ける。この場合はキーがそのまま URL の先頭になる。
```

「### build-url.ts」節の全体を次に置き換える:

```markdown
### compile-url.ts

- `compileUrl(baseUrl: string | undefined, path: string): (params?, query?, hash?) => string`
- baseUrl との結合とパスの分割を定義時に1回だけ行い、呼び出しのたびに値を埋め込む関数を返す。パラメータがないパスは URL を定数として持つ。
- 「URL の組み立て規則」をすべて担当する。ルートやメソッドの概念を持たない。
```

「### define-routes.ts」節の `- 引数の `p` / `q` / `h` を正式名に正規化してから `buildUrl` に渡す。` を次に置き換える:

```markdown
- ルートごとに `compileUrl` を1回呼ぶ。呼び出し時は引数の `p` / `q` / `h` を正式名に揃え、params・query・hash を個別に渡す(オブジェクトを作らない)。
```

「ファイル構成」の `build-url.ts      URL 組み立て(純粋関数)` を `compile-url.ts    URL 組み立て(定義時に前処理し、組み立て関数を返す)` にする。`build-url.test.ts       URL 組み立ての実行時テスト` を `compile-url.test.ts     URL 組み立ての実行時テスト` にする。

- [ ] **Step 9: lint を確認してコミットする**

Run: `pnpm lint:fix && pnpm lint && pnpm typecheck`
Expected: エラーなし

```bash
git add src/compile-url.ts src/define-routes.ts tests/compile-url.test.ts tests/define-routes.test.ts docs/superpowers/specs/2026-10-29-ruroute-design.md
git commit -m "perf: precompile URLs at definition time and fix custom scheme baseUrl

- replace buildUrl with compileUrl (base join and path split done once)
- join baseUrl and key with a single slash so myapp:// keeps its //
- encode query spaces as %20 and omit empty hash

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: baseUrl とキーの型チェック、ValidRoutes の公開

**Files:**
- Create: `tests/base-url.test-d.ts`
- Modify: `src/types.ts`(「定義の検証」節の末尾に追記)、`src/define-routes.ts`、`src/index.ts`、`tests/utilities.test-d.ts`
- Modify: `docs/superpowers/specs/2026-10-29-ruroute-design.md`

**Interfaces:**
- Consumes: `src/types.ts` の `ValidateRoutes<R>`、`RouteDef`、`Routes`
- Produces:
  - `src/types.ts`:
    - `export type ValidRoutes<R, B = undefined> = R & ValidateRoutes<R> & ValidateBaseUrl<R, B>`
    - `export interface RoutesConfig<R, B = undefined> { baseUrl?: B; routes: ValidRoutes<R, B> }`
  - `src/define-routes.ts`: `export function defineRoutes<R extends Record<string, RouteDef>, const B extends string | undefined = undefined>(config: RoutesConfig<R, B>): Routes<R>`
  - `src/index.ts`: 型 `RoutesConfig`、`ValidRoutes` を export する
  - エラーメッセージ型: `'baseUrl を指定したときはキーを / で始まるパスにしてください'`

- [ ] **Step 1: 失敗する型テストを書く**

`tests/base-url.test-d.ts`:

```ts
import { expectTypeOf, test } from 'vitest'
import { defineRoutes, type Empty, type ValidRoutes, type } from '../src'

declare const envBase: string
declare const maybeBase: string | undefined

type KeyError = 'baseUrl を指定したときはキーを / で始まるパスにしてください'

test('baseUrl なしなら絶対 URL・独自スキームのキーを書ける', () => {
  defineRoutes({
    routes: {
      'https://a.example.com/x': type.empty,
      'myapp://items/[id]': type.route({
        get: { params: { id: type.number } },
      }),
    },
  })
})

test('baseUrl ありならパスのキーは通る', () => {
  defineRoutes({
    baseUrl: 'https://a.example.com',
    routes: {
      '/x': type.empty,
      '/u/[id]': type.route({ get: { params: { id: type.number } } }),
    },
  })
  defineRoutes({ baseUrl: envBase, routes: { '/x': type.empty } })
  defineRoutes({ baseUrl: 'myapp://', routes: { '/items': type.empty } })
})

test('baseUrl ありで / で始まらないキーはエラー', () => {
  defineRoutes({
    baseUrl: 'https://a.example.com',
    routes: {
      // @ts-expect-error 絶対 URL
      'https://b.example.com/x': type.empty,
    },
  })
  defineRoutes({
    baseUrl: envBase,
    routes: {
      // @ts-expect-error プロトコル相対
      '//b.example.com/x': type.empty,
    },
  })
  defineRoutes({
    baseUrl: envBase,
    routes: {
      // @ts-expect-error 先頭の / がない
      users: type.empty,
    },
  })
})

test('baseUrl が string | undefined でも検査する', () => {
  defineRoutes({
    baseUrl: maybeBase,
    routes: {
      // @ts-expect-error baseUrl が設定されうる
      'https://b.example.com/x': type.empty,
    },
  })
})

test('エラーにはメッセージ型が付く', () => {
  type Bad = ValidRoutes<{ users: Empty }, 'https://a.example.com'>['users']
  expectTypeOf<Bad extends KeyError ? true : false>().toEqualTypeOf<true>()

  type Good = ValidRoutes<{ '/users': Empty }, 'https://a.example.com'>['/users']
  expectTypeOf<Good extends KeyError ? true : false>().toEqualTypeOf<false>()

  type NoBase = ValidRoutes<{ users: Empty }>['users']
  expectTypeOf<NoBase extends KeyError ? true : false>().toEqualTypeOf<false>()

  type MaybeBase = ValidRoutes<{ users: Empty }, string | undefined>['users']
  expectTypeOf<
    MaybeBase extends KeyError ? true : false
  >().toEqualTypeOf<true>()
})
```

`tests/utilities.test-d.ts` の import 行を次に置き換える:

```ts
import {
  defineRoutes,
  type RouteArgs,
  type RouteDef,
  type RoutePath,
  type ValidRoutes,
  type,
} from '../src'
```

同じファイルの末尾に追加する:

```ts
const BASE = 'https://api.example.com'

// routopia の README「Best Practice」と同じく、baseUrl を固定した wrapper
function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}

test('ValidRoutes で baseUrl を固定した wrapper を書ける', () => {
  const api = createApi({
    '/users': type.empty,
    '/users/[id]': type.route({ get: { params: { id: type.number } } }),
  })
  expectTypeOf<RoutePath<typeof api>>().toEqualTypeOf<
    '/users' | '/users/[id]'
  >()
  expectTypeOf(api['/users/[id]']({ p: { id: 1 } })).toEqualTypeOf<string>()

  // @ts-expect-error params の書き漏れ
  createApi({ '/users/[id]': type.empty })
  createApi({
    // @ts-expect-error baseUrl を固定した wrapper に絶対 URL
    'https://x.example.com/a': type.empty,
  })
  // @ts-expect-error 定義していないパス
  void api['/nope']
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm typecheck`
Expected: FAIL。次のエラーが出る。
- `Module '"../src"' has no exported member 'ValidRoutes'`
- `tests/base-url.test-d.ts` の `@ts-expect-error` が `Unused '@ts-expect-error' directive` になる

- [ ] **Step 3: 型を実装する**

`src/types.ts` で、`export type ValidateRoutes<R> = { … }` の定義の直後(「// ---- 公開型ユーティリティ ----」の前)に追加する:

```ts
/** baseUrl を指定したとき、/ で始まらないキーに付けるエラーメッセージ */
type BaseUrlKeyError =
  'baseUrl を指定したときはキーを / で始まるパスにしてください'

/** baseUrl があるとき、キーが / で始まるパス(// で始まるものを除く)か検証する */
type ValidateBaseUrl<R, B> = [B] extends [undefined]
  ? unknown
  : {
      [P in keyof R]: P extends `//${string}`
        ? BaseUrlKeyError
        : P extends `/${string}`
          ? unknown
          : BaseUrlKeyError
    }

/** ルート定義の検証(パスと params の一致 + baseUrl とキーの整合)。wrapper 関数の引数型に使う */
export type ValidRoutes<R, B = undefined> = R &
  ValidateRoutes<R> &
  ValidateBaseUrl<R, B>

/** defineRoutes の引数 */
export interface RoutesConfig<R, B = undefined> {
  baseUrl?: B
  routes: ValidRoutes<R, B>
}
```

`src/define-routes.ts` で、型の import と `RoutesConfig` の定義、`defineRoutes` のシグネチャを変える。

import を次に置き換える:

```ts
import type {
  Method,
  ParamValue,
  QueryValue,
  RouteDef,
  Routes,
  RoutesConfig,
} from './types'
```

`export interface RoutesConfig<R> { … }` の4行を削除する。

`defineRoutes` のシグネチャを次に置き換える(本体は変えない):

```ts
export function defineRoutes<
  R extends Record<string, RouteDef>,
  const B extends string | undefined = undefined,
>(config: RoutesConfig<R, B>): Routes<R> {
```

`src/index.ts` の型 export を次に置き換える:

```ts
export type {
  Empty,
  Infer,
  Route,
  RouteArgs,
  RouteDef,
  RoutePath,
  Routes,
  RoutesConfig,
  Schema,
  ValidRoutes,
} from './types'
```

- [ ] **Step 4: テストとビルドを確認する**

Run: `pnpm typecheck`
Expected: エラーなし。既存の `validate.test-d.ts`、`define-routes.test-d.ts`、`utilities.test-d.ts` も通る。

Run: `pnpm test:coverage`
Expected: 全テストが PASS し、カバレッジは 100%。

Run: `pnpm build && rg -n 'ValidRoutes|RoutesConfig' dist/index.d.mts`
Expected: `ValidRoutes` と `RoutesConfig` が export に含まれる。

- [ ] **Step 5: 元の仕様書を更新する**

`docs/superpowers/specs/2026-10-29-ruroute-design.md` を次のように変更する。

「### 呼び出し」節の直後(「### type」の前)に追加する:

```markdown
### baseUrl とキー

- baseUrl を指定したときは、キーを `/` で始まるパスにしなければならない。`//` で始まるキー(プロトコル相対)、絶対 URL、`/` で始まらないキーは型エラーになる。エラーメッセージは `'baseUrl を指定したときはキーを / で始まるパスにしてください'`。
- baseUrl の型が `string | undefined` の場合も検査する。
- baseUrl を指定しなければ、キーに絶対 URL や独自スキームの URL を書ける。
```

「### 型ユーティリティ」節の最後の箇条書きの後に追加する:

````markdown
- `ValidRoutes<R, B>`: ルート定義の検証型(パスと params の一致 + baseUrl とキーの整合)。baseUrl を固定した wrapper 関数の引数型に使う。`RoutesConfig<R, B>` は `defineRoutes` の引数の型。

```ts
const BASE = 'https://api.example.com'
export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}
```
````

「### 対象外(最初の版)」の末尾に追加する:

```markdown
- baseUrl を指定し、ルートのキーが `string` に広がった定義。キーがパスかどうか判定できないため、型エラーになる。
- ホストに `[...]` を含む URL(IPv6 リテラル `http://[::1]/`)をキーに書くこと。`[::1]` がパスパラメータとして解釈される。baseUrl に書いた場合は動く。
```

「### types.ts」節の `- パスと params キーの一致を検証し、不一致なら定義時に型エラーにする型。` の次の行に追加する:

```markdown
- baseUrl を指定したとき、キーが `/` で始まるパスかを検証する型。この型とパスの検証をまとめた `ValidRoutes`、および `RoutesConfig`。
```

- [ ] **Step 6: lint を確認してコミットする**

Run: `pnpm lint:fix && pnpm lint && pnpm typecheck`
Expected: エラーなし

```bash
git add src/types.ts src/define-routes.ts src/index.ts tests/base-url.test-d.ts tests/utilities.test-d.ts docs/superpowers/specs/2026-10-29-ruroute-design.md
git commit -m "feat: require path keys when baseUrl is set and export ValidRoutes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: routopia 互換テスト

routopia 1.2.3 のテスト(`src/definitions.test.ts`、`src/definitions.test-d.ts`、`src/utilities.test.ts`)から、ruroute が実装している機能に当てはまり、かつ既存のテストにないものを翻訳する。

次のものは対象外とする: mock、catch-all(`[...x]` / `[[...x]]`)、クエリキーのソート、返り値のテンプレートリテラル推論、実行時のエラー。

このタスクは、テストだけで実装は変えない。Task 2・3 の後なら全テストが通るはずなので、「失敗するテスト」の手順はない。テストが失敗した場合は、実装のバグか翻訳の誤りのどちらかなので、調べてから報告する。

**Files:**
- Create: `tests/compat/routopia.test.ts`
- Create: `tests/compat/routopia.test-d.ts`

**Interfaces:**
- Consumes: `defineRoutes`、`type`(`../../src`)
- Produces: なし

- [ ] **Step 1: 実行時の互換テストを書く**

`tests/compat/routopia.test.ts`:

```ts
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
    expect(Object.keys(routes['/methods'])).toEqual([
      'get',
      'post',
      'put',
      'delete',
    ])
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
    expect(routes['/params/[param]']({ p: { param: 'あ' } })).toBe(
      '/params/%E3%81%82',
    )
    expect(routes['/params/[param]']({ p: { param: '1 2' } })).toBe(
      '/params/1%202',
    )
  })

  // routes > クエリパラメータが宣言されている場合 > ソートされたクエリパラメータ付きの URL を生成できること
  // ruroute はキーをソートしない(定義した順で出力する)
  test('必須クエリをすべて指定する', () => {
    expect(
      routes['/queries/required']({
        q: { string: 'string', number: 1, boolean: true, array: ['string'] },
      }),
    ).toBe('/queries/required?string=string&number=1&boolean=true&array=string')
  })

  // routes > クエリパラメータが宣言されている場合 > オプショナルなクエリパラメータは省略して URL を生成できること
  test('省略可能なクエリは省略できる', () => {
    expect(
      routes['/queries/both']({ q: { string: 'string', number: 1 } }),
    ).toBe('/queries/both?string=string&number=1')
  })

  // routes > クエリパラメータが宣言されている場合 > パラメータが全て省略可能な場合は、引数なしで URL を生成できること
  test('クエリがすべて省略可能なら引数なしで呼べる', () => {
    expect(routes['/queries/optional']()).toBe('/queries/optional')
  })

  // routes > クエリパラメータが宣言されている場合 > エンコードされること
  // stringifyQueries > クエリパラメータが設定されている場合 > クエリパラメータがエンコードされること
  test('クエリの空白は %20、マルチバイト文字と予約文字はエンコードする', () => {
    const q = routes['/queries/optional']
    expect(q({ q: { string: 'string with space' } })).toBe(
      '/queries/optional?string=string%20with%20space',
    )
    expect(q({ q: { string: 'りんご' } })).toBe(
      '/queries/optional?string=%E3%82%8A%E3%82%93%E3%81%94',
    )
    expect(q({ q: { string: 'a&b=c/d?e#f+g' } })).toBe(
      '/queries/optional?string=a%26b%3Dc%2Fd%3Fe%23f%2Bg',
    )
  })

  // stringifyQueries(空文字の値)
  test('クエリの空文字は値なしで出力する', () => {
    expect(routes['/queries/optional']({ q: { string: '' } })).toBe(
      '/queries/optional?string=',
    )
  })

  // stringifyQueries(null の値)
  // routopia は null のキーを省略する。ruroute は型で null を禁止しており、実行時は "null" を出力する
  test('クエリの null は "null" として出力する(routopia との違い)', () => {
    const query = { string: null } as unknown as { string: string }
    expect(routes['/queries/optional']({ q: query })).toBe(
      '/queries/optional?string=null',
    )
  })

  // stringifyQueries > クエリパラメータが設定されている場合 > クエリパラメータの値が配列の場合、キーを繰り返して返すこと
  test('配列は同じキーを繰り返し、空配列は出力しない', () => {
    const both = routes['/queries/both']
    expect(both({ q: { string: 's', number: 1, array: ['a', 'b'] } })).toBe(
      '/queries/both?string=s&number=1&array=a&array=b',
    )
    expect(both({ q: { string: 's', number: 1, array: [] } })).toBe(
      '/queries/both?string=s&number=1',
    )
  })

  // stringifyQueries > … > クエリパラメータの値が混在した配列の場合、null/undefinedを除外してキーを繰り返して返すこと
  // routopia は要素の null/undefined を除外する。ruroute は検証せず String() で文字列化する
  test('配列要素の null / undefined は文字列化する(routopia との違い)', () => {
    const array = ['a', null, 'b', undefined, 'c'] as unknown as string[]
    expect(routes['/queries/both']({ q: { string: 's', number: 1, array } })).toBe(
      '/queries/both?string=s&number=1&array=a&array=null&array=b&array=undefined&array=c',
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
    expect(all({ p: { param: '1' }, q: { optional: 'optional' }, h: 'hash' })).toBe(
      '/all/1?optional=optional#hash',
    )
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
    expect(r['schema://params/[param]']({ p: { param: '1' } })).toBe(
      'schema://params/1',
    )
    expect(
      r['schema://https://example.com/path/[param]']({ p: { param: '1' } }),
    ).toBe('schema://https://example.com/path/1')
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
    expect(r['/params/[param]']({ p: { param: '1' } })).toBe(
      'schema://params/1',
    )
  })
})
```

- [ ] **Step 2: 型の互換テストを書く**

`tests/compat/routopia.test-d.ts`:

```ts
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
  expectTypeOf(all({ p: { param: '1' } })).toEqualTypeOf<string>()
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
```

- [ ] **Step 3: テストを実行する**

Run: `pnpm exec vitest run tests/compat`
Expected: PASS(全テスト)

Run: `pnpm typecheck`
Expected: エラーなし。`Unused '@ts-expect-error' directive` も出ない。

どちらかが失敗した場合: 実装は変えず、そのテストと出力(または型エラー)を記録して報告する。ruroute の仕様との食い違いの可能性があるため、修正方針はユーザーが判断する。

- [ ] **Step 4: lint を確認してコミットする**

Run: `pnpm lint:fix && pnpm lint && pnpm typecheck && pnpm test:coverage`
Expected: すべてエラーなし。カバレッジは 100%。

```bash
git add tests/compat
git commit -m "test: add routopia compatibility tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: knip を導入し、不要な記述を整理する

**Files:**
- Create: `knip.json`
- Modify: `package.json`(devDependencies と scripts)、`pnpm-lock.yaml`
- Modify: `src/types.ts`、`src/compile-url.ts`(内部でしか使わない型の `export` を外す)
- Modify: `tsconfig.json`、`biome.json`(`src/sample.ts` の記述を削除する)
- Modify: `docs/superpowers/specs/2026-10-29-ruroute-design.md`(「後片付け」節)

**Interfaces:**
- Consumes: Task 3 までの `src/*`
- Produces: `pnpm knip` コマンド(エラーなしで終わる状態)

- [ ] **Step 1: パッケージと設定を追加する**

```bash
pnpm add -D knip@^6.44.0
```

`knip.json`:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "src/index.ts",
    "src/type.ts",
    "scripts/*.ts",
    "bench/**/*.ts",
    "tests/**/*.{test,test-d}.ts"
  ],
  "project": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "scripts/**/*.ts",
    "bench/**/*.ts"
  ],
  "ignoreUnresolved": ["../dist/index.mjs", "../../dist/index.mjs"]
}
```

補足:
- `bench/size/*.ts` は `scripts/size.ts` の中に文字列として書かれているだけで、import されていない。そのため knip が自動では見つけられないので、`entry` に明示している。
- bench は、ビルド前には存在しない `dist/index.mjs` を import する。この import を未解決として報告させないために `ignoreUnresolved` を設定している。

`package.json` の `scripts` で、`"lint": "biome check .",` の前の行に追加する:

```json
    "knip": "knip",
```

- [ ] **Step 2: 実行して指摘を確認する**

Run: `pnpm knip`
Expected: 「Unused exported types」として、少なくとも次が報告される(終了コードは 1)。
- `src/types.ts`: `ParamsDef`、`QueryDef`、`HashDef`、`MethodDef`、`MethodArgs`、`MethodFn`、`RouteObject`、`PathParams`、`ValidateRoutes`
- `src/compile-url.ts`: `UrlBuilder`

- [ ] **Step 3: 指摘に対処する**

上の10個の型は、定義しているファイルの中でしか使っていない。`export` を外す。

例: `export type ParamsDef = …` は `type ParamsDef = …` に、`export type UrlBuilder = (` は `type UrlBuilder = (` にする。

Step 2 で上の10個以外の指摘が出た場合は、次の方針で対処する。
- 内部でしか使っていない export: export を外す。
- 型テストから import しているもの、`index.ts` から公開しているもの: 残す。
- devDependencies が未使用と報告された場合: 削除せず、`knip.json` に `"ignoreDependencies": ["<名前>"]` を追加する。その上の行にはコメントを書けないので、理由をコミットメッセージに書く。
- 設定ファイルに関するヒント(Configuration hints)は、終了コードに影響しなければ対応不要。

- [ ] **Step 4: src/sample.ts の残骸を削除する**

`tsconfig.json` から次の行を削除する(直前の行 `"include": ["src"],` の末尾のカンマも削除する):

```json
  "exclude": ["src/sample.ts"]
```

`biome.json` の `files.includes` を次に置き換える:

```json
    "includes": ["**", "!.sc", "!**/*.md"]
```

`docs/superpowers/specs/2026-10-29-ruroute-design.md` の「## 後片付け」節で、`src/sample.ts` に関する箇条書き(「`src/sample.ts` は設計メモとして残す。…」)を次に置き換える:

```markdown
- `src/sample.ts`(設計メモ)は削除済み。`tsconfig.json` と `biome.json` に残っていた除外設定も削除した。
```

- [ ] **Step 5: 確認する**

Run: `pnpm knip`
Expected: 何も報告されず、終了コード 0

Run: `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build && pnpm check:treeshake`
Expected: すべてエラーなし。`dist/index.d.mts` に `ValidRoutes`・`RoutesConfig`・`Routes` などの公開型が残っている(`rg -n 'export' dist/index.d.mts` で確認する)。

- [ ] **Step 6: コミットする**

```bash
git add knip.json package.json pnpm-lock.yaml src/types.ts src/compile-url.ts tsconfig.json biome.json docs/superpowers/specs/2026-10-29-ruroute-design.md
git commit -m "chore: add knip and drop unused exports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: lefthook を導入する

**Files:**
- Create: `lefthook.yml`
- Modify: `package.json`(devDependencies と scripts)、`pnpm-lock.yaml`

**Interfaces:**
- Consumes:
  - `pnpm typecheck`
  - `pnpm test:coverage`(Task 1)
  - `pnpm knip`(Task 5)
  - `pnpm check:treeshake`
- Produces: pre-commit フックと pre-push フック

- [ ] **Step 1: パッケージと設定を追加する**

```bash
pnpm add -D lefthook@^2.2.2
```

`lefthook.yml`:

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
    - name: test
      run: pnpm test:coverage
    - name: knip
      run: pnpm knip
    - name: treeshake
      run: pnpm check:treeshake
```

`package.json` の `scripts` の末尾(`"format"` の行の後ろ。前の行にカンマを付ける)に追加する:

```json
    "prepare": "lefthook install"
```

`prepare` を使う理由:
- pnpm は依存パッケージの postinstall をブロックするので、lefthook 自体の postinstall には頼れない。
- `prepare` は、利用者がパッケージをインストールしたときには実行されない。

- [ ] **Step 2: フックを登録して確認する**

Run: `pnpm install`
Expected: `prepare` が実行され、lefthook が `pre-commit` と `pre-push` のフックを登録したことを表示する。

Run: `pnpm exec lefthook run pre-commit --all-files`
Expected: `biome` と `typecheck` の両方が成功する(✔️)。

Run: `pnpm exec lefthook run pre-push`
Expected: `test`、`knip`、`treeshake` のすべてが成功する(✔️)。

- [ ] **Step 3: コミットする**

コミットするとフックが実行される。これでフックが動くことも確認できる。

```bash
git add lefthook.yml package.json pnpm-lock.yaml
git commit -m "chore: add lefthook pre-commit and pre-push hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: コミット時に `biome` と `typecheck` が実行されて成功し、コミットが作られる。

---

### Task 7: 公開整備(package.json・README・LICENSE)

**Files:**
- Modify: `package.json`(メタ情報と `files`)
- Modify: `README.md`(全体を置き換える)
- Create: `README.JP.md`、`LICENSE`

**Interfaces:**
- Consumes: Task 1〜3 で確定した公開 API(`defineRoutes`、`type.*`、`RoutePath`、`RouteArgs`、`ValidRoutes`)と URL の組み立て規則
- Produces: `npm pack --dry-run` で正しいファイル一覧になるパッケージ

- [ ] **Step 1: package.json のメタ情報を書き換える**

`package.json` の `"name"` から `"bugs"` までのブロック(`"name": "tsdown-starter",` から `"bugs": { … },` まで)を次に置き換える:

```json
  "name": "ruroute",
  "type": "module",
  "version": "0.4.0",
  "description": "Type-safe route definitions and URL builder",
  "author": "mokume3 <mokume.dev@gmail.com>",
  "license": "MIT",
  "homepage": "https://github.com/mokume3/ruroute#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mokume3/ruroute.git"
  },
  "bugs": {
    "url": "https://github.com/mokume3/ruroute/issues"
  },
  "keywords": [
    "typescript",
    "url",
    "route",
    "builder",
    "routing",
    "type-safe"
  ],
  "sideEffects": false,
```

`"files": ["dist"]` を次に置き換える:

```json
  "files": ["dist", "README.JP.md"],
```

- [ ] **Step 2: LICENSE を作る**

`LICENSE`:

```
MIT License

Copyright (c) 2026 mokume3

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: README.md(英語)を書く**

`README.md` の全体を次で置き換える:

````markdown
# ruroute

Type-safe route definitions and URL builder for TypeScript.

Japanese README: [README.JP.md](./README.JP.md)

- Define routes once, get typed URL builders for each HTTP method
- Path params are inferred from the path (`/users/[id]`) and checked at definition time
- Query, hash, absolute URLs and custom schemes (`myapp://…`)
- No runtime validation, no dependencies; unused `type.*` markers are tree-shaken

## Installation

```bash
pnpm add ruroute
```

## Quick Start

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com', // optional
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

- Calling a route directly builds the `get` URL. `.get` / `.post` / `.put` / `.delete` exist only for defined methods.
- Arguments accept `params` / `query` / `hash` or the short forms `p` / `q` / `h` (not both for the same item).
- The argument object can be omitted when nothing is required.
- Every `[name]` in the path must be defined in `params` of every method. Missing or extra keys are type errors.

## type

| type | TS type | params | query | hash |
|---|---|---|---|---|
| `type.empty` | (no arguments) | – | – | – |
| `type.string` | `string` | ✓ | ✓ | ✓ |
| `type.number` | `number` | ✓ | ✓ | ✓ |
| `type.boolean` | `boolean` | – | ✓ | – |
| `type.literal([...])` | union of the values | ✓ | ✓ | ✓ |
| `type.union([...])` | union of the schemas | ✓ | ✓ | ✓ |
| `type.custom<T>()` | `T` | ✓ | ✓ | ✓ |
| `type.array(T)` | `readonly T[]` | – | ✓ | – |
| `type.optional(T)` | `T \| undefined` (key can be omitted) | – | ✓ | ✓ |

`type.custom<T>()` lets you use branded types or existing unions. `T` must extend `string | number` (params / hash) or `string | number | boolean` (query).

## URL rules

| part | rule |
|---|---|
| baseUrl | Joined with the key. If baseUrl ends with `/` and the key starts with `/`, one `/` is removed (`myapp://` + `/items` → `myapp://items`). |
| params | `[name]` is replaced with `encodeURIComponent(String(value))`. |
| query | Built with `URLSearchParams`, spaces encoded as `%20`. `undefined` keys are skipped; arrays repeat the key (`tag=a&tag=b`). No `?` when empty. |
| hash | `#` + `encodeURIComponent(String(value))`. Skipped when `undefined` or `''`. |

Values are not validated at runtime.

## baseUrl, absolute URLs and custom schemes

Without `baseUrl`, keys can be absolute URLs or custom-scheme URLs:

```ts
const routes = defineRoutes({
  routes: {
    'https://api.example1.com/health': type.empty,
    'myapp://items/[id]': type.route({ get: { params: { id: type.number } } }),
  },
})
routes['myapp://items/[id]']({ p: { id: 1 } }) // myapp://items/1
```

With `baseUrl`, keys must be paths starting with `/` (otherwise a type error: `'baseUrl を指定したときはキーを / で始まるパスにしてください'`).

## Type utilities

```ts
import type { RouteArgs, RoutePath, RouteDef, ValidRoutes } from 'ruroute'

type Path = RoutePath<typeof routes> // '/health' | '/users' | '/users/[id]'
type Args = RouteArgs<typeof routes, '/users', 'get'> // argument type of the call
```

`ValidRoutes<R, B>` lets you write a wrapper with a fixed `baseUrl`:

```ts
const BASE = 'https://api.example.com'

export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}
```

`Schema`, `Infer`, `Empty`, `Route`, `RouteDef`, `Routes` and `RoutesConfig` are also exported.

## Not supported

- Catch-all params (`[...slug]` / `[[...slug]]`) and optional params
- Sorting query keys
- URL parsing and runtime validation
- IPv6 literal hosts in keys (`http://[::1]/…`); put them in `baseUrl` instead

## Benchmark

See [docs/benchmark.md](./docs/benchmark.md) for a comparison with [routopia](https://github.com/yKicchan/routopia).

## Migrating from 0.4

The API was rewritten. Template strings and `.types<>()` are replaced by `defineRoutes` and `type.*`.

```ts
// 0.4
const userRoute = ruroute('/users/:id?tab#section').types<{
  id: string
  tab?: string
  section: string
}>()
userRoute({ id: '42', tab: 'profile', section: 'overview' })

// now
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
- Query keys and hash are declared in the route definition instead of the template
- Arguments are grouped into `p` / `q` / `h`

## License

MIT
````

- [ ] **Step 4: README.JP.md(日本語)を書く**

`README.JP.md`:

````markdown
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
| baseUrl | キーと連結する。baseUrl が `/` で終わり、キーが `/` で始まるときは `/` を1つにする(`myapp://` + `/items` → `myapp://items`)。 |
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

baseUrl を指定したときは、キーを `/` で始まるパスにする。そうでなければ型エラー(`'baseUrl を指定したときはキーを / で始まるパスにしてください'`)になる。

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

- 可変長パラメータ(`[...slug]` / `[[...slug]]`)、任意のパスパラメータ
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

## ライセンス

MIT
````

- [ ] **Step 5: README のコード例を型検査する**

README の Quick Start と wrapper の例が、実際に型エラーなく通ることを確かめる。一時的なファイルで型検査し、確認したら削除する:

```bash
mkdir -p node_modules/.cache/readme-check
cat > node_modules/.cache/readme-check/readme.ts <<'EOF'
import { defineRoutes, type RouteDef, type ValidRoutes, type } from '../../../src'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
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
routes['/health']()
routes['/users']({ q: { page: 2 } })
routes['/users'].post()
routes['/users/[id]']({ p: { id: 1 }, h: 'top' })
routes['/users/[id]'].delete({ params: { id: 1 } })

const abs = defineRoutes({
  routes: {
    'https://api.example1.com/health': type.empty,
    'myapp://items/[id]': type.route({ get: { params: { id: type.number } } }),
  },
})
abs['myapp://items/[id]']({ p: { id: 1 } })

const BASE = 'https://api.example.com'
export function createApi<R extends Record<string, RouteDef>>(
  routes: ValidRoutes<R, typeof BASE>,
) {
  return defineRoutes({ baseUrl: BASE, routes })
}

const migrated = defineRoutes({
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
migrated['/users/[id]']({ p: { id: '42' }, q: { tab: 'profile' }, h: 'overview' })
EOF
echo '{"extends":"../../../tsconfig.json","include":["readme.ts"],"compilerOptions":{"noEmit":true}}' > node_modules/.cache/readme-check/tsconfig.json
npx tsc -p node_modules/.cache/readme-check
rm -rf node_modules/.cache/readme-check
```

Expected: tsc の出力なし(エラーなし)

- [ ] **Step 6: パッケージの中身を確認する**

Run: `pnpm build && npm pack --dry-run 2>&1 | rg -v WARN`
Expected:
- `Tarball Contents` に、`LICENSE`、`README.JP.md`、`README.md`、`dist/` 以下のファイル、`package.json` だけが並ぶ。
- `src/`、`tests/`、`docs/`、`bench/` は含まれない。
- `name: ruroute`、`version: 0.4.0` と表示される。

- [ ] **Step 7: lint を確認してコミットする**

Run: `pnpm lint:fix && pnpm lint`
Expected: エラーなし(package.json の配列の書式は lint:fix で Biome の形式に揃う)

```bash
git add package.json README.md README.JP.md LICENSE
git commit -m "docs: prepare ruroute for publishing with README and LICENSE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ベンチマークを拡充し、計測し直す

**Files:**
- Modify: `bench/url.bench.ts`
- Modify: `docs/benchmark.md`(全体を書き直す)
- Modify: `docs/superpowers/specs/2026-10-29-ruroute-design.md`(「ファイル構成」と「テスト」)
- Modify: `docs/superpowers/specs/2026-10-30-ruroute-perf-and-publish-design.md`(7章の1行)

**Interfaces:**
- Consumes: Task 2 の `dist` 出力(`pnpm bench` が先にビルドする)
- Produces: なし

- [ ] **Step 1: ベンチマークのケースを追加する**

`bench/url.bench.ts` の `ru` の `routes` で、`'/users/[id]'` の定義の後ろに追加する:

```ts
    '/users/[id]/posts/[postId]': type.route({
      get: {
        params: { id: type.number, postId: type.string },
        query: {
          page: type.optional(type.number),
          tag: type.optional(type.array(type.string)),
        },
        hash: type.optional(type.string),
      },
    }),
```

`ro` の定義で、`'/users/[id]'` の後ろに追加する:

```ts
  '/users/[id]/posts/[postId]': {
    get: {
      params: {
        id: routopia.type as number,
        postId: routopia.type as string,
      },
      queries: {
        page: routopia.type as number | undefined,
        tag: routopia.type as string[] | undefined,
      },
      hash: routopia.type as string,
    },
  },
```

`test('クエリ(配列を含む)', …)` の後ろに追加する:

```ts
test('params + query + hash', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ru['/users/[id]/posts/[postId]']({
        p: { id: 1, postId: 'a b' },
        q: { page: 2, tag: ['x', 'y'] },
        h: 'top',
      })
    }),
    bench('routopia', () => {
      ro['/users/[id]/posts/[postId]'].get({
        params: { id: 1, postId: 'a b' },
        queries: { page: 2, tag: ['x', 'y'] },
        hash: 'top',
      })
    }),
  )
})

const ruAbs = defineRoutes({
  routes: {
    'https://api.example3.com/users/[id]': type.route({
      get: { params: { id: type.number } },
    }),
  },
})

const roAbs = routopia.routes({
  'https://api.example3.com/users/[id]': {
    get: { params: { id: routopia.type as number } },
  },
})

test('絶対 URL のキー', async ({ bench }) => {
  await bench.compare(
    bench('ruroute', () => {
      ruAbs['https://api.example3.com/users/[id]']({ p: { id: 1 } })
    }),
    bench('routopia', () => {
      roAbs['https://api.example3.com/users/[id]'].get({ params: { id: 1 } })
    }),
  )
})
```

routopia も絶対 URL のキーに対応していることは、spec の作成後に確認した。そのため spec 7章の「絶対 URL のキー(ruroute のみ。routopia の比較対象には同じ形がないため)」は、`docs/superpowers/specs/2026-10-30-ruroute-perf-and-publish-design.md` で「絶対 URL のキー(routopia と比較)」に直す。

- [ ] **Step 2: 計測する**

Run: `pnpm bench 2>&1 | rg -v '^\s*$' | tail -40`
Expected:
- 6ケースすべてで、ruroute と routopia の行が出る。
- ruroute の値が、次の変更前の値以上である。
  - パラメータなし: 8,294,422
  - パスパラメータ + hash: 3,098,050
  - クエリ(配列を含む): 2,334,649
- ルート定義(100 ルート)は、変更前の 44,032 の 90% 以上(39,629 以上)である。

基準を満たさないケースがある場合は、もう一度 `pnpm bench` を実行する(計測のばらつきを除くため)。それでも満たさない場合は、数値を添えて報告する。

Run: `pnpm size`
Expected: 4行の表が出る。

Run: `pnpm check:treeshake`
Expected: `tree-shaking OK (… B minified)`

- [ ] **Step 3: docs/benchmark.md を書き直す**

`docs/benchmark.md` を次の構成で書き直す。表の数値は Step 2 の出力から写す。変更前の列には、下に示した値をそのまま使う。

````markdown
# ruroute と routopia の比較

計測日: <実行日 YYYY-MM-DD> / Node <`node --version` の出力> / Darwin arm64 / routopia 1.2.3

## 性能(`pnpm bench`)

ruroute はビルド済みの `dist/index.mjs` を計測している(vitest のモジュールランナーの負荷を両者で揃えるため)。

| ケース | ruroute (ops/s) | routopia (ops/s) | 比 (ruroute / routopia) |
|---|---:|---:|---:|
| パラメータなし | … | … | …x |
| パスパラメータ + hash | … | … | …x |
| クエリ(配列を含む) | … | … | …x |
| params + query + hash | … | … | …x |
| 絶対 URL のキー | … | … | …x |
| ルート定義(100 ルート) | … | … | …x |

### 変更前との比較(ruroute)

定義時に URL を前処理する方式(`compileUrl`)に変えた前後の比較。

| ケース | 変更前 (ops/s) | 変更後 (ops/s) | 倍率 |
|---|---:|---:|---:|
| パラメータなし | 8,294,422 | … | …x |
| パスパラメータ + hash | 3,098,050 | … | …x |
| クエリ(配列を含む) | 2,334,649 | … | …x |
| ルート定義(100 ルート) | 44,032 | … | …x |

## バンドルサイズ(`pnpm size`)

minify 後、依存をすべて同梱して計測した。ruroute はビルド済みの `dist/index.mjs` を計測している(利用者が受け取る成果物と同じ)。

| bundle | minified (B) | gzip (B) | brotli (B) |
|---|---:|---:|---:|
| ruroute (all exports) | … | … | … |
| routopia (all exports) | … | … | … |
| ruroute (usage) | … | … | … |
| routopia (usage) | … | … | … |

変更前の ruroute は、all exports が 1356 / 753 / 657 B、usage が 1171 / 675 / 600 B だった。増えた場合は、その理由(定義時の前処理、`%20` の置き換えなど)をここに書く。

- all exports: ライブラリ全体を export したときのサイズ(ツリーシェイキングなし)
- usage: 3ルートを定義して4回呼び出したときのサイズ

## ツリーシェイキング

`pnpm check:treeshake` で、配布物から未使用のマーカーが除去されることを確認できる。`type.empty` / `type.route` / `type.number` だけを使った場合に、`boolean` / `literal` / `union` / `custom` / `array` / `optional` のマーカーがバンドルに残らないことを検証する。今回の出力は `<Step 2 の出力>`。

## 機能差の注意

- routopia は可変長パラメータ(`[...slug]` / `[[...slug]]`)と、クエリのキーのソートに対応している。ruroute は対応していない。
- routopia はクエリのキーをソートしてから組み立てる。そのため、クエリを含むケースの速度差には、この処理の有無も含まれる。
- ruroute は `type.*` のマーカーを実行時オブジェクトとして持つ。
- 性能は1回分の計測値なので、数 % 程度の差は計測のばらつきの範囲に入りうる。
````

`…` と `<…>` は、すべて Step 2 の実測値で埋める。埋め残しがないことを確認する:

Run: `rg -n '…|<' docs/benchmark.md`
Expected: 一致なし

- [ ] **Step 4: 元の仕様書のファイル構成とテストを更新する**

`docs/superpowers/specs/2026-10-29-ruroute-design.md` の「## ファイル構成」にあるコードブロック全体を次に置き換える:

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

「## テスト」節の「実行時(vitest):」の箇条書きの末尾に追加する:

```markdown
- baseUrl とキーの結合(境目の `/`、独自スキーム)、絶対 URL のキー、クエリの空白の `%20`、空文字の hash。
- routopia 互換(`tests/compat/routopia.test.ts`)。routopia との違い(null、配列要素、キーのソート)はコメントで明記する。
- カバレッジは `pnpm test:coverage` で 100% を保つ。
```

「型(`expectTypeOf` / `@ts-expect-error`):」の箇条書きの末尾に追加する:

```markdown
- baseUrl を指定したとき、`/` で始まらないキーがエラーになり、エラーにメッセージ型が付く。
- `ValidRoutes` を使い、baseUrl を固定した wrapper を書ける。
- routopia 互換(`tests/compat/routopia.test-d.ts`)。
```

- [ ] **Step 5: 全体を確認してコミットする**

Run: `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm knip`
Expected: すべてエラーなし。カバレッジは 100%。

```bash
git add bench/url.bench.ts docs/benchmark.md docs/superpowers/specs/2026-10-29-ruroute-design.md docs/superpowers/specs/2026-10-30-ruroute-perf-and-publish-design.md
git commit -m "docs: re-measure benchmarks after compileUrl and add new cases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
