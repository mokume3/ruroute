# Changelog

Notable changes to this project are documented in this file.

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
