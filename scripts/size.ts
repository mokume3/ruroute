import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { build } from 'tsdown'

const ENTRIES = {
  'ruroute (all exports)': 'bench/size/ruroute-all.ts',
  'routopia (all exports)': 'bench/size/routopia-all.ts',
  'ruroute (usage)': 'bench/size/ruroute-usage.ts',
  'routopia (usage)': 'bench/size/routopia-usage.ts',
}
const OUT_DIR = 'node_modules/.cache/size'
// all exports は名前空間オブジェクトのヘルパを含み、バンドラの更新だけで数十 B 動く。
// このヘルパは利用者のバンドルには入らないため、上限は usage で判定する
const LIMITED_LABEL = 'ruroute (usage)'
const MAX_MINIFIED_BYTES = 1500

async function bundle(entry: string, outDir: string, minify: boolean) {
  rmSync(outDir, { recursive: true, force: true })
  await build({
    config: false,
    entry: { index: entry },
    outDir,
    format: 'esm',
    platform: 'neutral',
    minify,
    dts: false,
    fixedExtension: true,
    deps: { alwaysBundle: [/./] },
    logLevel: 'silent',
    // @__PURE__ などの注釈は利用者の最終バンドルでは役目を終えている(esbuild や terser は消す)。
    // rolldown は minify しても残すので、コードの大きさだけを測るために出力しない
    outputOptions: { comments: { annotation: false } },
  })
  return readFileSync(join(outDir, 'index.mjs'))
}

const rows: string[] = []
let limitedMinifiedBytes = Number.NaN
for (const [label, entry] of Object.entries(ENTRIES)) {
  const outDir = join(OUT_DIR, label.replace(/\W+/g, '-'))
  const raw = await bundle(entry, join(outDir, 'raw'), false)
  const code = await bundle(entry, join(outDir, 'min'), true)
  if (label === LIMITED_LABEL) limitedMinifiedBytes = code.length
  rows.push(
    `| ${label} | ${raw.length} | ${code.length} | ${gzipSync(code, { level: 9 }).length} | ${brotliCompressSync(code).length} |`,
  )
}

console.log('| bundle | unminified (B) | minified (B) | gzip (B) | brotli (B) |')
console.log('|---|---:|---:|---:|---:|')
for (const row of rows) console.log(row)

// NaN(対象の行が見つからない)も失敗にするため、否定形で比べる
if (!(limitedMinifiedBytes < MAX_MINIFIED_BYTES)) {
  console.error(
    `size failed: ${LIMITED_LABEL} が ${limitedMinifiedBytes} B minified (上限 ${MAX_MINIFIED_BYTES} B 未満)`,
  )
  process.exit(1)
}
console.log(`size OK (${LIMITED_LABEL}: ${limitedMinifiedBytes} B minified, 上限 ${MAX_MINIFIED_BYTES} B 未満)`)
