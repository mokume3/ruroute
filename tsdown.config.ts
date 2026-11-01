import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/type.ts'],
  dts: {
    generator: 'tsgo',
  },
  exports: true,
  platform: 'neutral',
  fixedExtension: true,
  target: 'es2022',
  publint: true,
  attw: { profile: 'esm-only' },
  failOnWarn: 'ci-only',
  suppressWarnings: 'TypeScript Go is experimental',
  plugins: [
    {
      // type.* を利用者のバンドラでツリーシェイクできるよう、
      // index から type への参照を静的な名前空間 re-export のまま残す
      name: 'ruroute:external-type-namespace',
      resolveId(id, importer) {
        if (id === './type' && importer?.endsWith('/src/index.ts')) {
          return { id: './type.mjs', external: true }
        }
      },
    },
  ],
})
