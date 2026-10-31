import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'tsdown'

// 利用者が一部の type.* だけを使ったとき、使っていないマーカーが
// dist からバンドルに残らないことを確認する
const ENTRY = 'bench/size/ruroute-treeshake.ts'
const OUT_DIR = 'node_modules/.cache/treeshake'
const UNUSED_EXPORTS = ['boolean', 'literal', 'union', 'custom', 'array', 'optional']

rmSync(OUT_DIR, { recursive: true, force: true })
await build({
  config: false,
  entry: { index: ENTRY },
  outDir: OUT_DIR,
  format: 'esm',
  platform: 'neutral',
  minify: true,
  dts: false,
  fixedExtension: true,
  deps: { alwaysBundle: [/./] },
  logLevel: 'silent',
})

const code = readFileSync(join(OUT_DIR, 'index.mjs'), 'utf8')
// 残っていれば名前空間オブジェクトのキーとして名前が出る(minify でもプロパティ名は変わらない)
const remaining = UNUSED_EXPORTS.filter((name) => new RegExp(`\\b${name}\\b`).test(code))
if (remaining.length > 0) {
  console.error(`tree-shaking failed: ${remaining.join(', ')} が残っている`)
  process.exit(1)
}
console.log(`tree-shaking OK (${code.length} B minified)`)
