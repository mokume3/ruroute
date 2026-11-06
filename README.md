# ruroute

[![GitHub Release](https://img.shields.io/github/v/release/mokume3/ruroute)](https://github.com/mokume3/ruroute/releases)
[![license](https://img.shields.io/github/license/mokume3/ruroute)](https://github.com/mokume3/ruroute/blob/main/LICENSE)
[![minzip](https://badgen.net/bundlephobia/minzip/ruroute)](https://bundlephobia.com/package/ruroute)
[![dependencies](https://badgen.net/bundlephobia/dependency-count/ruroute)](https://bundlephobia.com/package/ruroute)
[![CI](https://github.com/mokume3/ruroute/actions/workflows/ci.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/ci.yml)
[![Publish](https://github.com/mokume3/ruroute/actions/workflows/publish.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/publish.yml)
[![Deploy](https://github.com/mokume3/ruroute/actions/workflows/deploy.yml/badge.svg)](https://github.com/mokume3/ruroute/actions/workflows/deploy.yml)
[![Coverage](https://mokume3.github.io/ruroute/coverage/badge.svg)](https://mokume3.github.io/ruroute/coverage)

Type-safe route definitions and URL builder for TypeScript.

Japanese README: [README.ja.md](./README.ja.md)

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
| query | Built with `URLSearchParams`, spaces encoded as `%20`, keys sorted (`URLSearchParams.sort()`). `undefined` keys are skipped; arrays repeat the key (`tag=a&tag=b`). No `?` when empty. |
| hash | `#` + `encodeURIComponent(String(value))`. Skipped when `undefined` or `''`. |

Values are not validated at runtime.

The return type reflects the arguments you pass: `routes['/users']({ q: { page: 1 } })` is `` `…/users?page=${string}` ``, and `#${string}` is added only when a non-empty hash is passed.

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

With `baseUrl`, keys must be paths starting with `/` (not `//`) (otherwise a type error: `'baseUrl を指定したときはキーを / で始まるパスにしてください'`).

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

- Catch-all params (`[...slug]` / `[[...slug]]`) and optional params. `[...slug]` has no special handling and is treated as a regular param named `...slug`.
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

## Releasing

1. Run `pnpm changeset` to record the changes and bump type.
2. Run `pnpm version-packages` to update the version and CHANGELOG.md, then commit the changes.
3. Run `pnpm release` to build and publish the package to npm (`prepublishOnly` runs the build). After publishing, push the generated tags with `git push --follow-tags`.

## License

MIT
