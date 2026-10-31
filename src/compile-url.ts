import type { ParamValue, QueryValue } from './types'

type UrlBuilder = (params?: Record<string, ParamValue>, query?: Record<string, QueryValue>, hash?: ParamValue) => string

const PARAM = /\[([^\]]+)\]/

/** Prepares the base URL and path, then returns a URL builder. Does not validate values. */
export function compileUrl(baseUrl: string | undefined, path: string): UrlBuilder {
  const base = baseUrl?.endsWith('/') && path.startsWith('/') ? baseUrl.slice(0, -1) : (baseUrl ?? '')

  if (!path.includes('[')) {
    const url = base + path
    return (_params, query, hash) => url + stringifyQuery(query) + stringifyHash(hash)
  }

  // パスの分割は最初の呼び出しまで遅らせる(ルート定義を軽くするため)。
  // [静的, 名前, 静的, 名前, …, 静的]。baseUrl の [ ] は分割しない
  let parts: string[] | undefined
  return (params, query, hash) => {
    if (parts === undefined) {
      parts = path.split(PARAM)
      parts[0] = base + parts[0]
    }
    let url = parts[0]
    for (let i = 1; i < parts.length; i += 2) {
      // encodeURIComponent は値を自分で文字列化する(String() と同じ結果)
      url += encodeURIComponent(params?.[parts[i]] as ParamValue) + parts[i + 1]
    }
    return url + stringifyQuery(query) + stringifyHash(hash)
  }
}

function stringifyQuery(query: Record<string, QueryValue> | undefined) {
  if (query == null) return ''
  const search = new URLSearchParams()
  for (const key of Object.keys(query)) {
    const value = query[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      // append は値を自分で文字列化する(String() と同じ結果)
      for (const v of value) search.append(key, v as string)
    } else {
      search.append(key, value as string)
    }
  }
  // キー順を揃えて同じクエリなら同じ URL にする(型の返り値もキー順)。sort は安定なので配列の順は保たれる
  search.sort()
  const s = search.toString()
  // URLSearchParams は空白を + にする。+ という文字自体は %2B になるので置き換えてよい
  return s && `?${s.replaceAll('+', '%20')}`
}

const stringifyHash = (hash: ParamValue | undefined) =>
  hash === undefined || hash === '' ? '' : `#${encodeURIComponent(hash)}`
