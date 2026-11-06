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

> A TypeScript library that builds type-safe URLs from route definitions

## ✨ Features

- 🔒 Type-safe route definitions, down to path params, query and hash
- 🎯 The returned URL is inferred as a template literal type
- 🪶 No dependencies. Unused `type.*` markers are removed by tree shaking
- ⚡ Low runtime cost ([benchmark](#-benchmark))
- 📝 JSDoc written in the definitions shows up on call arguments
- 🌐 Supports a base URL, absolute URLs and custom schemes (`myapp://…`)

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
> The return value is inferred as a template literal type.  
> For example, the type of `routes['/users/[id]']({ params: { id: 123 } })` is `` `/users/${number}` ``.  
> To receive it as `string`, add a type annotation: `const url: string = routes['/users/[id]']({ params: { id: 123 } })`

## 📘 Why ruroute?

A library focused on declaring routes in one place and getting typed URL builders from them. Its main characteristics:

- Schemas are written as values such as `type.number`, so no type assertions are needed
- Calling a route directly returns the GET URL, and argument keys can be shortened to `p` / `q` / `h`
- JSDoc written in the definitions carries over to call arguments
- Runtime work is kept light, making URL building and route definition fast

It fits cases like:

- Managing endpoints of third-party APIs without an SDK, or links to external sites
- Managing custom scheme URLs (e.g. `myapp://items/1`)
- Managing API URLs in projects that don't use code generation such as OpenAPI Generator
- Making internal links type-safe in a simple way

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

- Use `type.empty` for methods that take no parameters
- Methods are `get` / `post` / `put` / `delete`. Any other key is a type error
- Only the defined methods are available as `.get` / `.post` / `.put` / `.delete`
- `'/path': type.empty` makes a GET-only route ([Shorthand](#shorthand))

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
// => all '/items'
```

### Path Parameters

- Wrap a segment in `[]`, like `[name]`
- Define the values in `params`. Any type that satisfies `string` / `number` can be used ([Schema Types](#schema-types))
- `[name]` in the path and the `params` keys are checked against each other at definition time. Missing or extra keys are type errors
- Define the path params in every method of the route
- Values are encoded with `encodeURIComponent`

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
// Error: string is not assignable to number

routes['/orgs/[org]/repos/[repo]']({ params: { org: 'mokume3', repo: 'my repo' } })
// => '/orgs/mokume3/repos/my%20repo'

routes['/users/[id]']()
//                   ^^
// Error: path params cannot be omitted
```

```ts
defineRoutes({
  routes: {
    // Error: no params for [id] in the path
    '/users/[id]': type.route({
      get: { params: { userId: type.number } },
    }),
  },
})
```

### Query Parameters

- Define the values in `query`. `string` / `number` / `boolean` and arrays of them can be used
- Keys wrapped in `type.optional(...)` can be omitted when calling
- If there are no required keys, the argument itself can be omitted
- Passing a key that isn't defined is a type error
- Arrays repeat the key (`tags=a&tags=b`). `undefined` keys and empty arrays are not output

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
// Error: cannot be omitted because the query q is required

routes['/search']({ query: { q: 'url', sort: 'new' } })
//                                     ^^^^
// Error: sort is not defined

routes['/posts']()
// => '/posts'
```

> [!TIP]
> Query keys are sorted in the output, so the same values always produce the same URL. This works as-is with SWR or TanStack Query, which use URLs as cache keys. The return type follows the sorted order too.

### Hash

- Define the value in `hash`. Any type that satisfies `string` / `number` can be used
- Narrowing the candidates with a union of literal types is safer, but `type.string` accepts anything
- Unless wrapped in `type.optional(...)`, it cannot be omitted when calling
- No `#` is added for `undefined` or an empty string

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
// Error: 'unknown' is not assignable to 'install' | 'usage'

routes['/docs']()
// => '/docs'

routes['/faq']()
//            ^^
// Error: hash cannot be omitted
```

### Schema Types

| Type | TS type | params | query | hash |
|---|---|:---:|:---:|:---:|
| `type.string` | `string` | ✅ | ✅ | ✅ |
| `type.number` | `number` | ✅ | ✅ | ✅ |
| `type.boolean` | `boolean` | – | ✅ | – |
| `type.literal([...])` | union of the values | ✅ | ✅ | ✅ |
| `type.union([...])` | union of the element types | ✅ | ✅ | ✅ |
| `type.custom<T>()` | `T` | ✅ | ✅ | ✅ |
| `type.array(T)` | `readonly T[]` | – | ✅ | – |
| `type.optional(T)` | `T \| undefined` (the key can be omitted) | – | ✅ | ✅ |

- `type.custom<T>()` lets you use branded types or existing union types as they are. `T` must be a subtype of `string | number` for params / hash, and of `string | number | boolean` for query
- Values are not validated at runtime. `type.*` are markers for types only, and at runtime they are all the same empty object

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

- When `baseUrl` is set, it is prepended to each route key
- When `baseUrl` ends with `/` and the key starts with `/`, one trailing `/` is removed from `baseUrl`
- When `baseUrl` is set, keys must be paths starting with `/` (but not `//`). Otherwise it is a type error
- Without `baseUrl`, keys can be absolute URLs or custom scheme URLs as they are

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
    // Error: 'baseUrl を指定したときはキーを / で始まるパスにしてください'
    // (when baseUrl is set, keys must be paths starting with /)
    users: type.empty,
  },
})
```

### Shorthand

- `'/path': type.empty` makes a GET-only route. Calling `type.route()` with no arguments is the same
- Calling a route directly returns the same URL as `.get`. Routes without GET cannot be called directly
- Argument keys can be written as `p` / `q` / `h` instead of `params` / `query` / `hash`. Passing the same item both ways is a type error

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
// Error: params and p cannot be passed together
```

### JSDoc

- JSDoc written on `params` / `query` keys and on `hash` also shows up on call arguments
- It shows up with the shorthand `p` / `q` too. It shows up on `h` only in TypeScript 7.1 and later

```ts
import { defineRoutes, type } from 'ruroute'

const routes = defineRoutes({
  routes: {
    '/users': type.route({
      get: {
        query: {
          /** 1-based page number */
          page: type.optional(type.number),
        },
      },
    }),
  },
})

routes['/users']({ query: { page: 2 } })
//                          ^^^^
// Hovering shows "1-based page number"
```

### Type Utilities

- `RoutePath<T>`: a union of the route paths
- `RouteArgs<T, P, M>`: the call argument type for path `P` and method `M`. `never` for methods with no arguments
- `ValidRoutes<R, B>`: validates route definitions. Use it for the argument of a function that wraps `defineRoutes`
- `Schema` / `Infer` / `Empty` / `Route` / `RouteDef` / `Routes` / `RoutesConfig` are also exported

```ts
import type { RouteArgs, RoutePath } from 'ruroute'

type Path = RoutePath<typeof routes>
// => '/users' | '/users/[id]'

type Args = RouteArgs<typeof routes, '/users/[id]', 'get'>
// => the call argument type, such as { params: { id: number } } | { p: { id: number } }
```

### URL Encoding

| Part | Rule |
|---|---|
| baseUrl | Joined with the key. When baseUrl ends with `/` and the key starts with `/`, one trailing `/` is removed from baseUrl (`myapp://` + `/items` → `myapp://items`) |
| params | `[name]` is replaced with `encodeURIComponent(String(value))` |
| query | Built with `URLSearchParams`, with keys sorted and spaces as `%20`. `undefined` keys and empty arrays are not output. Arrays repeat the key. No `?` when empty |
| hash | `#` + `encodeURIComponent(String(value))`. Not added for `undefined` or an empty string |

## 🚫 Unsupported

- Catch-all path params (`[...slug]` / `[[...slug]]`) and optional path params. `[...slug]` gets no special treatment and is handled as a regular path param named `...slug`
- Methods other than `get` / `post` / `put` / `delete` (such as `patch`)
- A `mock` method for tests
- URL parsing and runtime value validation
- IPv6 literal hosts in keys (`http://[::1]/…`). They work in baseUrl

If you need catch-all path params or a `mock` method for tests, [routopia](https://github.com/yKicchan/routopia) is a better fit.

## 📊 Benchmark

Compared with [routopia](https://github.com/yKicchan/routopia) 1.2.3 (measured on 2026-11-06). See [docs/benchmark.md](./docs/benchmark.md) (in Japanese) for the method and details.

| Case | ruroute / routopia |
|---|---:|
| No parameters | 5.27x |
| Path params + hash | 5.00x |
| Query (with arrays) | 2.38x |
| params + query + hash | 2.49x |
| Absolute URL keys | 5.76x |
| Route definition (100 routes) | 4.09x |

| Bundle (define 3 routes and call them 4 times) | minified | gzip | brotli |
|---|---:|---:|---:|
| ruroute | 1,208 B | 713 B | 636 B |
| routopia | 1,975 B | 821 B | 725 B |

## 📝 License

[MIT](./LICENSE)
