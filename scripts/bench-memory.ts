import { defineRoutes, type } from '../dist/index.mjs'

// ルート数を増やしたときに、defineRoutes の結果が保持するヒープの大きさを測る。
// 設定オブジェクト(パスの文字列とルート定義)は計測の前に作っておき、差分に含めない

type ParamPath = `/resource${number}/[id]`
type StaticPath = `/static${number}`

const ROUTE_COUNTS = [100, 1_000, 10_000]
const WARM_UP_ROUTE_COUNT = 1_000

const paramRoute = type.route({ get: { params: { id: type.number } } })

let isWarmedUp = false
// 計測の途中で設定オブジェクトや defineRoutes の結果が回収されると差分が狂うので、最後まで生かしておく
const retained: unknown[] = []

const measureHeapUsed = () => {
  if (globalThis.gc === undefined) throw new Error('node --expose-gc で実行してください(pnpm bench:memory)')
  globalThis.gc()
  return process.memoryUsage().heapUsed
}

const printRow = (label: string, routeCount: number, definedBytes: number, calledBytes: number) => {
  if (!isWarmedUp) return
  console.log(
    `| ${label} | ${routeCount.toLocaleString('en-US')} | ${Math.round(definedBytes / routeCount)} B | ${Math.round(calledBytes / routeCount)} B |`,
  )
}

const measureStaticRoutes = (routeCount: number) => {
  const paths = Array.from({ length: routeCount }, (_, index): StaticPath => `/static${index}`)
  const routes: Record<StaticPath, typeof type.empty> = {}
  for (const path of paths) routes[path] = type.empty

  retained.push(paths, routes)
  const heapBefore = measureHeapUsed()
  const defined = defineRoutes({ routes })
  retained.push(defined)
  const heapDefined = measureHeapUsed()
  for (const path of paths) defined[path]()
  const heapCalled = measureHeapUsed()
  printRow('パスパラメータなし', routeCount, heapDefined - heapBefore, heapCalled - heapBefore)
}

const measureParamRoutes = (routeCount: number) => {
  const paths = Array.from({ length: routeCount }, (_, index): ParamPath => `/resource${index}/[id]`)
  const routes: Record<ParamPath, typeof paramRoute> = {}
  for (const path of paths) routes[path] = paramRoute

  retained.push(paths, routes)
  const heapBefore = measureHeapUsed()
  const defined = defineRoutes({ routes })
  retained.push(defined)
  const heapDefined = measureHeapUsed()
  for (const path of paths) defined[path]({ p: { id: 1 } })
  const heapCalled = measureHeapUsed()
  printRow('パスパラメータあり', routeCount, heapDefined - heapBefore, heapCalled - heapBefore)
}

// 初回は JIT のコードや内部キャッシュの確保が差分に混ざるので、一度流してから測る
measureStaticRoutes(WARM_UP_ROUTE_COUNT)
measureParamRoutes(WARM_UP_ROUTE_COUNT)
isWarmedUp = true

console.log('| ルート | ルート数 | 定義直後(1 ルートあたり) | 全ルートを 1 回呼んだ後(1 ルートあたり) |')
console.log('|---|---:|---:|---:|')
for (const routeCount of ROUTE_COUNTS) {
  measureStaticRoutes(routeCount)
  measureParamRoutes(routeCount)
}
