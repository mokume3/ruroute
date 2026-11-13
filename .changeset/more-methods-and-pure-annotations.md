---
'ruroute': minor
---

- Added the `patch`, `head`, and `options` methods to `type.route()`.
- Added the `RouteParams`, `RouteQuery`, `RouteHash`, and `RouteUrl` type utilities.
- Fixed a type error when passing a variable whose type has `readonly` optional keys (identical to the query definition) as `query`.
- `defineRoutes` and the `type.*` functions are now marked with `@__NO_SIDE_EFFECTS__`, so bundlers can drop route definitions that are never used.
