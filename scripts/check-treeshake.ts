import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'tsdown'

const OUT_DIR = 'node_modules/.cache/treeshake'
// 利用者が一部の type.* だけを使ったとき、使っていないマーカーが
// dist からバンドルに残らないことを確認する
const PARTIAL_USE_ENTRY = 'bench/size/ruroute-treeshake.ts'
const UNUSED_EXPORTS = ['boolean', 'literal', 'union', 'custom', 'array', 'optional']
// 利用者がルート定義を export したが使わなかったとき、定義ごと消えることを確認する。
// 残るのは使った側の数十 B だけで、ruroute の実行時コード(約 1 KB)が入れば超える
const UNUSED_ROUTES_ENTRY = 'bench/size/ruroute-unused-routes.ts'
const MAX_UNUSED_ROUTES_BYTES = 100

const bundle = async (entry: string) => {
  rmSync(OUT_DIR, { recursive: true, force: true })
  await build({
    config: false,
    entry: { index: entry },
    outDir: OUT_DIR,
    format: 'esm',
    platform: 'neutral',
    minify: true,
    dts: false,
    fixedExtension: true,
    deps: { alwaysBundle: [/./] },
    logLevel: 'silent',
  })
  return readFileSync(join(OUT_DIR, 'index.mjs'), 'utf8')
}

const partialUseCode = await bundle(PARTIAL_USE_ENTRY)
// 残っていれば名前空間オブジェクトのキーとして名前が出る(minify でもプロパティ名は変わらない)
const remaining = UNUSED_EXPORTS.filter((name) => new RegExp(`\\b${name}\\b`).test(partialUseCode))
if (remaining.length > 0) {
  console.error(`tree-shaking failed: ${remaining.join(', ')} が残っている`)
  process.exit(1)
}

const unusedRoutesCode = await bundle(UNUSED_ROUTES_ENTRY)
if (unusedRoutesCode.length >= MAX_UNUSED_ROUTES_BYTES) {
  console.error(
    `tree-shaking failed: 使っていないルート定義が残っている (${unusedRoutesCode.length} B minified, 上限 ${MAX_UNUSED_ROUTES_BYTES} B 未満)`,
  )
  process.exit(1)
}
console.log(
  `tree-shaking OK (一部の type.* だけを使う: ${partialUseCode.length} B, 使わないルート定義: ${unusedRoutesCode.length} B minified)`,
)
