import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// 返り値の URL 型(クエリキーのソートなど)の計算量が増えていないかを確かめる。
// 生成した負荷用コードを tsc --extendedDiagnostics で検査し、instantiation 数が上限を超えたら失敗する。
// 2026-11-01 時点で約 22.7 万。型の書き方ひとつで数倍に増えるため、上限は 3 割ほどの余裕に留める
const MAX_INSTANTIATIONS = 300_000
const ROUTES = 40
const OUT_DIR = 'node_modules/.cache/type-perf'

// 各ルート: クエリキー 10 個(うち省略可能 7 個)と hash を持ち、
// リテラルでの呼び出し・RouteArgs 型の変数での呼び出し・別メソッドの呼び出しをする
function generate(src: string) {
  const routes: string[] = []
  const calls: string[] = []
  for (let i = 0; i < ROUTES; i++) {
    routes.push(`    '/r${i}/[id]': type.route({
      get: {
        params: { id: type.number },
        query: {
          word${i}: type.string,
          page: type.number,
          active: type.boolean,
          sort: type.optional(type.literal(['name', 'date'])),
          tags: type.optional(type.array(type.string)),
          limit: type.optional(type.number),
          offset: type.optional(type.number),
          f1: type.optional(type.string),
          f2: type.optional(type.string),
          f3: type.optional(type.string),
        },
        hash: type.optional(type.string),
      },
      delete: { params: { id: type.number } },
    }),`)
    calls.push(
      `export const a${i} = routes['/r${i}/[id]']({ p: { id: 1 }, q: { word${i}: 'x', page: 1, active: true, sort: 'name', tags: ['a'] }, h: 'top' })`,
      `declare const v${i}: RouteArgs<typeof routes, '/r${i}/[id]', 'get'>`,
      `export const b${i} = routes['/r${i}/[id]'](v${i})`,
      `export const c${i} = routes['/r${i}/[id]'].delete({ p: { id: ${i} } })`,
    )
  }
  return `import { defineRoutes, type, type RouteArgs } from '${src}'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
${routes.join('\n')}
  },
})

${calls.join('\n')}
`
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
const file = join(OUT_DIR, 'stress.ts')
writeFileSync(file, generate(resolve('src')))

let output: string
try {
  output = execFileSync(
    resolve('node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--target',
      'esnext',
      '--module',
      'preserve',
      '--moduleResolution',
      'bundler',
      '--skipLibCheck',
      '--extendedDiagnostics',
      file,
    ],
    { encoding: 'utf8' },
  )
} catch (error) {
  // 型エラーがあると tsc は 0 以外で終わる
  console.error((error as { stdout?: string }).stdout ?? error)
  console.error('type-perf failed: 負荷用コードに型エラーがある')
  process.exit(1)
}

const read = (label: string) => output.match(new RegExp(`^${label}:\\s+(.+)$`, 'm'))?.[1]?.trim()
const instantiations = Number(read('Instantiations')?.replaceAll(',', ''))
if (!Number.isFinite(instantiations)) {
  console.error(output)
  console.error('type-perf failed: Instantiations を読み取れない')
  process.exit(1)
}
const summary = `${instantiations.toLocaleString('en-US')} instantiations, check ${read('Check time')}`
if (instantiations > MAX_INSTANTIATIONS) {
  console.error(`type-perf failed: ${summary} (上限 ${MAX_INSTANTIATIONS.toLocaleString('en-US')})`)
  process.exit(1)
}
console.log(`type-perf OK (${summary})`)
