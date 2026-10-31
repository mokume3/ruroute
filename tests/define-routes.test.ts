import { describe, expect, test } from 'vitest'
import { defineRoutes, type } from '../src'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: { query: { page: type.optional(type.number) } },
      post: type.empty,
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number }, hash: type.optional(type.string) },
      delete: { params: { id: type.number } },
    }),
    '/delete-only': type.route({ delete: type.empty }),
  },
})

describe('defineRoutes', () => {
  test('直接呼び出しは get の URL', () => {
    expect(routes['/health']()).toBe('https://api.example.com/health')
    expect(routes['/health'].get()).toBe('https://api.example.com/health')
  })

  test('メソッドごとに呼び出せる', () => {
    expect(routes['/users'].post()).toBe('https://api.example.com/users')
    expect(routes['/users/[id]'].delete({ params: { id: 1 } })).toBe('https://api.example.com/users/1')
    expect(routes['/delete-only'].delete()).toBe('https://api.example.com/delete-only')
  })

  test('短縮形 p / q / h を正式名に揃える', () => {
    expect(routes['/users']({ q: { page: 2 } })).toBe('https://api.example.com/users?page=2')
    expect(routes['/users/[id]']({ p: { id: 1 }, h: 'top' })).toBe('https://api.example.com/users/1#top')
    expect(routes['/users/[id]']({ params: { id: 1 }, hash: 'top' })).toBe('https://api.example.com/users/1#top')
  })

  test('定義したメソッドだけを持つ', () => {
    expect(Object.keys(routes['/users']).sort()).toEqual(['get', 'post'])
    expect(Object.keys(routes['/health'])).toEqual(['get'])
    expect(Object.keys(routes['/delete-only'])).toEqual(['delete'])
  })

  test('メソッドは定義した順に付く', () => {
    const r = defineRoutes({
      routes: {
        '/x': type.route({ delete: type.empty, get: type.empty }),
      },
    })
    expect(Object.keys(r['/x'])).toEqual(['delete', 'get'])
  })

  test('baseUrl 未指定なら相対パス', () => {
    const r = defineRoutes({ routes: { '/a': type.empty } })
    expect(r['/a']()).toBe('/a')
  })
})

describe('put メソッド', () => {
  test('put も URL を返し、メソッドとして付く', () => {
    const r = defineRoutes({
      routes: {
        '/items/[id]': type.route({
          put: { params: { id: type.number }, query: { force: type.boolean } },
        }),
      },
    })
    expect(r['/items/[id]'].put({ p: { id: 1 }, q: { force: false } })).toBe('/items/1?force=false')
    expect(Object.keys(r['/items/[id]'])).toEqual(['put'])
  })
})

describe('絶対 URL のキー', () => {
  test('baseUrl なしならキーに別ホストの URL を書ける', () => {
    const r = defineRoutes({
      routes: {
        'https://api.example1.com/health': type.empty,
        'https://api.example2.com/users': type.route({
          get: { query: { page: type.optional(type.number) } },
          post: type.empty,
        }),
        'https://api.example3.com/users/[id]': type.route({
          get: {
            params: { id: type.number },
            hash: type.optional(type.string),
          },
        }),
      },
    })
    expect(r['https://api.example1.com/health']()).toBe('https://api.example1.com/health')
    expect(r['https://api.example2.com/users']({ q: { page: 2 } })).toBe('https://api.example2.com/users?page=2')
    expect(r['https://api.example2.com/users'].post()).toBe('https://api.example2.com/users')
    expect(r['https://api.example3.com/users/[id]']({ p: { id: 1 }, h: 'top' })).toBe(
      'https://api.example3.com/users/1#top',
    )
  })

  test('baseUrl が独自スキームでも // を保つ', () => {
    const r = defineRoutes({
      baseUrl: 'myapp://',
      routes: {
        '/items/[id]': type.route({ get: { params: { id: type.number } } }),
      },
    })
    expect(r['/items/[id]']({ p: { id: 1 } })).toBe('myapp://items/1')
  })
})
