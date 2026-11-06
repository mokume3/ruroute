# Changelog

## 0.6.0

### Minor Changes

- bf02872: JSDoc written on query keys and on `hash` in route definitions now shows up on the call arguments (`query` / `q` keys, `hash` / `h`). Showing it on `params` keys and on `h` requires TypeScript 7.1 or later.

### Patch Changes

- c88ee74: `defineRoutes` is about 20% faster, building URLs with a query is slightly faster, and the bundle is about 35 B smaller.

## [0.5.0] - 2026-11-01

### Breaking Changes
- Redesigned the library interface around route definitions. `ruroute()`, `createRuroute()` and the template string syntax (`:name`, `?key`, `#hash`) have been removed (see "Migrating from 0.4" in the README).
- Path params are now written as `[name]` in route paths.
- Query keys are now sorted in the output URL.

### Added
- `defineRoutes({ baseUrl?, routes })` creates typed URL builders keyed by path.
- `type.*` markers (`empty`, `string`, `number`, `boolean`, `literal`, `union`, `custom`, `array`, `optional`, `route`) describe params, query and hash per HTTP method (`get` / `post` / `put` / `delete`).
- The URL return type is inferred from the passed query and hash (e.g. `` `…/users?page=${string}` ``).
- Custom URL schemes.
- Type errors for mismatches between `[name]` path segments and `params`, for typos in `type.route()`, and for keys that are not paths when `baseUrl` is set.
- Shorthand argument keys `p` / `q` / `h`, and omission of the argument object when nothing is required.
- Array query values that repeat the key (`tag=a&tag=b`).
- Type utilities `RoutePath` and `RouteArgs`, and public types `Schema`, `Infer`, `Empty`, `Route`, `RouteDef` and `Routes`.
- `ruroute/type` subpath export. `type.*` markers are tree-shakable.
- Benchmarks and bundle size comparison with routopia (`docs/benchmark.md`).

### Changed
- Faster URL building.
- Upgraded the toolchain to TypeScript 7, Vitest 5, tsdown 0.23 and Biome 2.6.
- Switched the code style to single quotes without semicolons.

## [0.3.0] - 2026-06-30

### Changed
- Added comprehensive type-check tests for union-typed path and hash parameters.
- Relaxed route parameter typing in `src/types.ts` so path and hash parameters now accept `string | number | boolean`.
- Updated type-level validation expectations in `tests/types.test-d.ts` to match the new parameter flexibility.
- Added this changelog file to the repository and started tracking release notes.

## [0.2.0] - 2026-06-30

### Added
- Added a README example for multiline template literals.
- Added tests for parsing query templates with line breaks and generating URLs.
- Added bundle size verification tests.

### Changed
- Improved parameter trimming behavior in `parser.ts`.
- Strengthened type definitions in `types.ts`.
- Reorganized settings in `tsdown.config.ts`.

## [0.1.0] - 2026-06-30

### Added
- Added type-check tests and introduced `vitest.config.ts`.
- Added test cases that were previously uncovered.

### Changed
- Reorganized the test setup and improved both type-check and runtime test coverage.
- Improved URL building logic in `builder.ts`.
- Added the default `ruroute` instance in `index.ts`.
- Updated `package.json`, `pnpm-lock.yaml`, and AGENTS.md to streamline checks and dependencies.

## [0.0.1] - 2026-06-29

### Added
- Initial release.
- Added the `prefix` option to `createRuroute`.
- Expanded the README with features, installation, usage examples, and API details.

### Changed
- Included initial bug fixes and test improvements.
