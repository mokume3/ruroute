import { describe, expect, test } from 'vitest'
import { defineRoutes, type } from '../src'

// 実行時の URL が推論した返り値の型に収まることを確かめる。
// expected は url の型に代入できなければ型エラーになり(tsc で検査)、実行時は url と一致しなければ失敗する
function check<U extends string>(url: U, expected: NoInfer<U>) {
  expect(url).toBe(expected)
}

const routes = defineRoutes({
  baseUrl: 'https://api.example.com/',
  routes: {
    '/order': type.route({
      get: {
        query: {
          a: type.string,
          _b: type.optional(type.string),
          Z: type.optional(type.string),
          '9': type.optional(type.string),
          '-x': type.optional(type.string),
        },
      },
    }),
    '/values': type.route({
      get: {
        query: {
          n: type.optional(type.number),
          b: type.optional(type.boolean),
          s: type.optional(type.string),
          tags: type.optional(type.array(type.string)),
          ids: type.optional(type.array(type.number)),
        },
      },
    }),
    '/users/[id]': type.route({
      get: {
        params: { id: type.number },
        query: { tab: type.optional(type.literal(['posts', 'likes'])) },
        hash: type.optional(type.union([type.string, type.number])),
      },
    }),
    '/many': type.route({
      get: {
        query: {
          a: type.optional(type.string),
          b: type.optional(type.string),
          c: type.optional(type.string),
          d: type.optional(type.string),
          e: type.optional(type.string),
          f: type.optional(type.string),
          g: type.string,
        },
      },
    }),
  },
})

describe('実行時の URL と型の一致', () => {
  test('キー順は型と URLSearchParams.sort() で同じ(記号 < 数字 < 大文字 < _ < 小文字)', () => {
    check(
      routes['/order']({ q: { a: '1', _b: '2', Z: '3', '9': '4', '-x': '5' } }),
      'https://api.example.com/order?-x=5&9=4&Z=3&_b=2&a=1',
    )
    check(routes['/order']({ q: { a: '1', Z: '3' } }), 'https://api.example.com/order?Z=3&a=1')
  })

  test('型で順序を間違えた URL は弾く', () => {
    const url = routes['/order']({ q: { a: '1', Z: '3' } })
    // @ts-expect-error a は Z より後
    const wrong: typeof url = 'https://api.example.com/order?a=1&Z=3'
    expect(wrong).not.toBe(url)
  })

  test('数値・真偽値・文字列・配列の値', () => {
    check(
      routes['/values']({ q: { n: -1.5, b: false, s: 'a b&c', tags: ['x', 'y'], ids: [1, 2] } }),
      'https://api.example.com/values?b=false&ids=1&ids=2&n=-1.5&s=a%20b%26c&tags=x&tags=y',
    )
    check(routes['/values']({ q: { n: 0, b: true } }), 'https://api.example.com/values?b=true&n=0')
  })

  test('undefined・空配列・空のクエリは出力しない', () => {
    check(routes['/values']({ q: { n: undefined, tags: [] } }), 'https://api.example.com/values')
    check(routes['/values']({ q: {} }), 'https://api.example.com/values')
    check(routes['/values'](), 'https://api.example.com/values')
  })

  test('型付き変数の省略可能なキー', () => {
    const query: { n?: number; s?: string } = { s: 'x' }
    check(routes['/values']({ q: query }), 'https://api.example.com/values?s=x')
  })

  test('params・query・hash の組み合わせ', () => {
    check(routes['/users/[id]']({ p: { id: 42 } }), 'https://api.example.com/users/42')
    check(
      routes['/users/[id]']({ p: { id: 42 }, q: { tab: 'likes' }, h: 'top' }),
      'https://api.example.com/users/42?tab=likes#top',
    )
    check(routes['/users/[id]']({ params: { id: 1 }, hash: 2 }), 'https://api.example.com/users/1#2')
    check(routes['/users/[id]']({ p: { id: 1 }, h: '' }), 'https://api.example.com/users/1')
  })
})

describe('省略可能なキーが 5 つ以上', () => {
  const all = { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6', g: '7' }

  test('リテラルで渡せば 1 通りの型になる', () => {
    check(routes['/many']({ q: all }), 'https://api.example.com/many?a=1&b=2&c=3&d=4&e=5&f=6&g=7')
  })

  test('型付き変数では 5 つ目以降を任意の文字列にまとめ、どの組み合わせも型に収まる', () => {
    const query = (q: { a?: string; b?: string; c?: string; d?: string; e?: string; f?: string; g: string }) =>
      routes['/many']({ q })
    check(query(all), 'https://api.example.com/many?a=1&b=2&c=3&d=4&e=5&f=6&g=7')
    check(query({ g: '7' }), 'https://api.example.com/many?g=7')
    check(query({ e: '5', f: '6', g: '7' }), 'https://api.example.com/many?e=5&f=6&g=7')
    check(query({ a: '1', d: '4', f: '6', g: '7' }), 'https://api.example.com/many?a=1&d=4&f=6&g=7')
  })
})
