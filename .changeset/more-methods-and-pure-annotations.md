---
'ruroute': minor
---

- Added the `patch`, `head`, and `options` methods to `type.route()`.
- `defineRoutes` and the `type.*` functions are now marked with `@__NO_SIDE_EFFECTS__`, so bundlers can drop route definitions that are never used.
