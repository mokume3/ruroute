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
  })
  return readFileSync(join(outDir, 'index.mjs'))
}

const rows: string[] = []
for (const [label, entry] of Object.entries(ENTRIES)) {
  const outDir = join(OUT_DIR, label.replace(/\W+/g, '-'))
  const raw = await bundle(entry, join(outDir, 'raw'), false)
  const code = await bundle(entry, join(outDir, 'min'), true)
  rows.push(
    `| ${label} | ${raw.length} | ${code.length} | ${gzipSync(code, { level: 9 }).length} | ${brotliCompressSync(code).length} |`,
  )
}

console.log('| bundle | unminified (B) | minified (B) | gzip (B) | brotli (B) |')
console.log('|---|---:|---:|---:|---:|')
for (const row of rows) console.log(row)
