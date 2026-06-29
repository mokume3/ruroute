# ruroute

ruroute is a TypeScript-first URL builder that turns template strings into strongly typed route functions.

Japanese README: [README.JP.md](./README.JP.md)

## Features

- Strong template-to-params type checking
- Automatic URL encoding for path, query, and hash values
- Optional query parameters supported
- Supports both `?query#hash` and `#hash?query` template order
- Works with custom schemes and regular paths

## Installation

```bash
pnpm add ruroute
```

## Quick Start

```ts
import { ruroute } from "ruroute";

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

## Template Syntax

- Path parameter: `:name`
- Query keys: `?key1&key2`
- Hash key: `#hashKey`

Examples:

- `/users/:id`
- `/search?keyword&page`
- `/docs/:slug#section`
- `app://start/:id?tab#section`
- `app://start#section?tab`

## Usage Patterns (TypeScript)

### 1. Path + Query + Hash

```ts
import { ruroute } from "ruroute";

const route = ruroute("app://start/:param1/www/:param2?query1&query2#hash").types<{
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

### 2. Optional Query Parameters

If a query value is `undefined`, the key is omitted.

```ts
import { ruroute } from "ruroute";

const route = ruroute("/search?keyword&page").types<{
  keyword: string;
  page?: number;
}>();

route({ keyword: "hello world" });
// /search?keyword=hello%20world
```

### 3. Hash Before Query (`#...?...`)

The output preserves the template order. This also supports SPA-style routes where the hash comes before the query string.

```ts
import { ruroute } from "ruroute";

const route = ruroute("app://start#hash?query1&query2").types<{
  hash: string;
  query1: string;
  query2?: number;
}>();

route({ hash: "section", query1: "tab top" });
// app://start#section?query1=tab%20top
```

### 4. Static Routes

```ts
import { ruroute } from "ruroute";

const route = ruroute("/about").types();

route();
// /about
```

### 5. Reusable Route Collection

```ts
import { ruroute } from "ruroute";

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

## Type Safety Notes

- Path and hash parameters must be present and typed as `string` in `.types<T>()`.
- Query keys in the template must exist in `T`.
- Query values can be `string | number | boolean | undefined` at runtime.

```ts
import { ruroute } from "ruroute";

const route = ruroute("/users/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

// @ts-expect-error - Missing required path parameter
route({ tab: "profile", section: "overview" });

// @ts-expect-error - Missing hash parameter
route({ id: "42", tab: "profile" });
```

## Runtime Behavior

- Missing required path/hash values throw an error.
- Duplicate template keys print a warning in non-production environments.
- Wildcard path (`*`) and optional path syntax (`:id?`) are not supported.

## API

### `createRuroute(options?)`

Creates a route factory.

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute();
```

#### Options

- `prefix?: string` — Prepends a string to all relative paths (ignored for scheme-based URLs)

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute({ prefix: "/api/v1" });

const userRoute = ruroute("/users/:id").types<{ id: string }>();
userRoute({ id: "42" });
// → "/api/v1/users/42"
```

### `ruroute`

This is the default `createRuroute()` instance. Import it directly when you do not need options.

```ts
import { ruroute } from "ruroute";

const userRoute = ruroute("/users/:id").types<{ id: string }>();
```

### `ruroute(template).types<T>()`

Compiles a template and returns a function:

```ts
(params: T) => string
```

## Development

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check
```
