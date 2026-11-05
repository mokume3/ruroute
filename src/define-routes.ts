import { compileUrl } from './compile-url'
import type { Method, ParamValue, QueryValue, RouteDef, Routes, RoutesConfig } from './types'

type Params = Record<string, ParamValue>
type Query = Record<string, QueryValue>

interface CallArgs {
  params?: Params
  /** params shorthand */
  p?: Params
  query?: Query
  /** query shorthand */
  q?: Query
  hash?: ParamValue
  /** hash shorthand */
  h?: ParamValue
}

type UrlFn = (args?: CallArgs) => string

export function defineRoutes<R extends Record<string, RouteDef>, const B extends string | undefined = undefined>(
  config: RoutesConfig<R, B>,
): Routes<R, NoInfer<B>> {
  const result: Record<string, unknown> = {}
  const routes: Record<string, RouteDef> = config.routes
  for (const path in routes) {
    const def = routes[path]
    const url = compileUrl(config.baseUrl, path)
    const methods = def.kind === 'route' ? def.methods : { get: def }
    const fn: UrlFn & { [M in Method]?: UrlFn } = (a) => url(a?.params ?? a?.p, a?.query ?? a?.q, a?.hash ?? a?.h)
    for (const method in methods) fn[method as Method] = fn
    result[path] = fn
  }
  return result as Routes<R, B>
}
