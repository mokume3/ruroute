import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// 返り値の URL 型(クエリキーのソートなど)の計算量が増えていないかを確かめる。
// 生成した負荷用コードを tsc --extendedDiagnostics で検査し、instantiation 数が上限を超えたら失敗する。
// 2026-11-01 時点で約 22.7 万。型の書き方ひとつで数倍に増えるため、上限は 3 割ほどの余裕に留める
const MAX_INSTANTIATIONS = 300_000
const OUT_DIR = 'node_modules/.cache/type-perf'
const MEASURE_FLAG = '--measure'
const MEASURE_ROUNDS = 3

interface StressOptions {
  routeCount: number
  /** f1, f2, … と増やす省略可能なクエリキーの数。クエリキーは全部で 7 + この数 */
  filterKeyCount: number
  hasLiteralCalls: boolean
  hasRouteArgsCalls: boolean
  hasMethodCalls: boolean
}

interface Diagnostics {
  instantiations: number
  checkSeconds: number
  memoryMegabytes: number
}

const CHECKED_STRESS: StressOptions = {
  routeCount: 40,
  filterKeyCount: 3,
  hasLiteralCalls: true,
  hasRouteArgsCalls: true,
  hasMethodCalls: true,
}

// 各ルート: クエリキー 10 個(うち省略可能 7 個)と hash を持ち、
// リテラルでの呼び出し・RouteArgs 型の変数での呼び出し・別メソッドの呼び出しをする
const generate = (src: string, options: StressOptions) => {
  let filterKeys = ''
  for (let filter = 1; filter <= options.filterKeyCount; filter++) {
    filterKeys += `\n          f${filter}: type.optional(type.string),`
  }
  const routes: string[] = []
  const calls: string[] = []
  for (let i = 0; i < options.routeCount; i++) {
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
          offset: type.optional(type.number),${filterKeys}
        },
        hash: type.optional(type.string),
      },
      delete: { params: { id: type.number } },
    }),`)
    if (options.hasLiteralCalls) {
      calls.push(
        `export const a${i} = routes['/r${i}/[id]']({ p: { id: 1 }, q: { word${i}: 'x', page: 1, active: true, sort: 'name', tags: ['a'] }, h: 'top' })`,
      )
    }
    if (options.hasRouteArgsCalls) {
      calls.push(
        `declare const v${i}: RouteArgs<typeof routes, '/r${i}/[id]', 'get'>`,
        `export const b${i} = routes['/r${i}/[id]'](v${i})`,
      )
    }
    if (options.hasMethodCalls) {
      calls.push(`export const c${i} = routes['/r${i}/[id]'].delete({ p: { id: ${i} } })`)
    }
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

const fail = (message: string, detail?: unknown): never => {
  if (detail !== undefined) console.error(detail)
  console.error(`type-perf failed: ${message}`)
  process.exit(1)
}

const diagnose = (options: StressOptions): Diagnostics => {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  const file = join(OUT_DIR, 'stress.ts')
  writeFileSync(file, generate(resolve('src'), options))

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
    return fail('負荷用コードに型エラーがある', (error as { stdout?: string }).stdout ?? error)
  }

  const read = (label: string) =>
    Number.parseFloat(output.match(new RegExp(`^${label}:\\s+(.+)$`, 'm'))?.[1]?.replaceAll(',', '') ?? '')
  const diagnostics: Diagnostics = {
    instantiations: read('Instantiations'),
    checkSeconds: read('Check time'),
    memoryMegabytes: read('Memory used') / 1024,
  }
  if (!Number.isFinite(diagnostics.instantiations)) return fail('Instantiations を読み取れない', output)
  return diagnostics
}

const check = () => {
  const { instantiations, checkSeconds } = diagnose(CHECKED_STRESS)
  const summary = `${instantiations.toLocaleString('en-US')} instantiations, check ${checkSeconds}s`
  if (instantiations > MAX_INSTANTIATIONS) {
    fail(`${summary} (上限 ${MAX_INSTANTIATIONS.toLocaleString('en-US')})`)
  }
  console.log(`type-perf OK (${summary})`)
}

// 時間は揺れるので中央値を取る。instantiation と memory は毎回ほぼ同じ
const measureRow = (label: string, options: StressOptions) => {
  const rounds: Diagnostics[] = []
  for (let round = 0; round < MEASURE_ROUNDS; round++) rounds.push(diagnose(options))
  rounds.sort((left, right) => left.checkSeconds - right.checkSeconds)
  const median = rounds[MEASURE_ROUNDS >> 1]
  console.log(
    `| ${label} | ${options.routeCount} | ${7 + options.filterKeyCount} | ${median.instantiations.toLocaleString('en-US')} | ${median.checkSeconds.toFixed(3)}s | ${Math.round(median.memoryMegabytes)} MB |`,
  )
}

// ルート数、呼び出しの種類、クエリキーの数を変えて、型チェックの負荷がどう伸びるかを表にする
const measure = () => {
  console.log('| 呼び出し | ルート数 | クエリキー | instantiations | check time | memory |')
  console.log('|---|---:|---:|---:|---:|---:|')
  for (const routeCount of [40, 100, 200, 400, 800]) {
    measureRow('すべて', { ...CHECKED_STRESS, routeCount })
  }
  const noCalls = { hasLiteralCalls: false, hasRouteArgsCalls: false, hasMethodCalls: false }
  const scaled = { ...CHECKED_STRESS, ...noCalls, routeCount: 400 }
  measureRow('定義だけ', scaled)
  measureRow('リテラル', { ...scaled, hasLiteralCalls: true })
  measureRow('RouteArgs 型の変数', { ...scaled, hasRouteArgsCalls: true })
  measureRow('別メソッド', { ...scaled, hasMethodCalls: true })
  for (const filterKeyCount of [13, 23]) {
    measureRow('すべて', { ...CHECKED_STRESS, routeCount: 400, filterKeyCount })
    measureRow('リテラル', { ...scaled, hasLiteralCalls: true, filterKeyCount })
    measureRow('RouteArgs 型の変数', { ...scaled, hasRouteArgsCalls: true, filterKeyCount })
  }
}

if (process.argv.includes(MEASURE_FLAG)) measure()
else check()
