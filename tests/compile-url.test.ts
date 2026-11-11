import { describe, expect, test } from 'vitest'
import { compileUrl } from '../src/compile-url'

describe('compileUrl: baseUrl とパス', () => {
  test('baseUrl なしはパスのみ', () => {
    expect(compileUrl(undefined, '/users')()).toBe('/users')
  })

  test('baseUrl とキーの境目の / を1つにする', () => {
    expect(compileUrl('https://api.example.com', '/users')()).toBe('https://api.example.com/users')
    expect(compileUrl('https://api.example.com/', '/users')()).toBe('https://api.example.com/users')
    expect(compileUrl('/users', '/[id]')({ id: 1 })).toBe('/users/1')
  })

  test('独自スキームの baseUrl でも // を保つ', () => {
    expect(compileUrl('myapp://', '/items/[id]')({ id: 1 })).toBe('myapp://items/1')
    expect(compileUrl('file:///', '/x')()).toBe('file:///x')
    expect(compileUrl('myapp://host', '/items')()).toBe('myapp://host/items')
  })

  test('キーが / で始まらなければ baseUrl をそのまま連結する', () => {
    expect(compileUrl('https://a.example.com/', 'users')()).toBe('https://a.example.com/users')
  })

  test('絶対 URL・独自スキームのキー', () => {
    expect(compileUrl(undefined, 'https://api.example3.com/users/[id]')({ id: 1 })).toBe(
      'https://api.example3.com/users/1',
    )
    expect(compileUrl(undefined, 'myapp://path/to/[id]')({ id: 1 })).toBe('myapp://path/to/1')
  })

  test('baseUrl の [ ] はパラメータとして扱わない', () => {
    expect(compileUrl('http://[::1]:8080', '/users/[id]')({ id: 1 })).toBe('http://[::1]:8080/users/1')
  })
})

describe('compileUrl: params', () => {
  test('[ ] が空・閉じていないパスはそのまま出力する', () => {
    expect(compileUrl(undefined, '/x/[]')()).toBe('/x/[]')
    expect(compileUrl(undefined, '/x/[a')()).toBe('/x/[a')
  })

  test('params を置換しエンコードする', () => {
    expect(
      compileUrl(
        undefined,
        '/users/[id]/posts/[postId]',
      )({
        id: 1,
        postId: 'a/b c',
      }),
    ).toBe('/users/1/posts/a%2Fb%20c')
  })

  test('パラメータの位置: 先頭・末尾・連続・同じ名前が2回', () => {
    expect(compileUrl(undefined, '[a]/x')({ a: 1 })).toBe('1/x')
    expect(compileUrl(undefined, '/x/[a]')({ a: 1 })).toBe('/x/1')
    expect(compileUrl(undefined, '/[a][b]')({ a: 1, b: 2 })).toBe('/12')
    expect(compileUrl(undefined, '/[a]/[a]')({ a: 'z' })).toBe('/z/z')
  })

  test('encodeURIComponent が変換しない文字だけの値はそのまま出力する', () => {
    expect(compileUrl(undefined, '/x/[a]')({ a: "aZ09-_.~!*'()" })).toBe("/x/aZ09-_.~!*'()")
    expect(compileUrl(undefined, '/x/[a]')({ a: -1.5 })).toBe('/x/-1.5')
  })

  test('変換が要る文字を含む値は encodeURIComponent と同じ出力にする', () => {
    expect(compileUrl(undefined, '/x/[a]')({ a: 'あ' })).toBe('/x/%E3%81%82')
    expect(compileUrl(undefined, '/x/[a]')({ a: 'a+b&c=d?e#f' })).toBe('/x/a%2Bb%26c%3Dd%3Fe%23f')
    expect(compileUrl(undefined, '/x/[a]')({ a: 1e21 })).toBe('/x/1e%2B21')
  })

  test('params を渡さなければ "undefined" になる(検証しない)', () => {
    expect(compileUrl(undefined, '/users/[id]')()).toBe('/users/undefined')
  })
})

describe('compileUrl: query', () => {
  test('undefined は省略、配列は同じキーを繰り返す', () => {
    expect(
      compileUrl(undefined, '/users')(undefined, {
        page: undefined,
        tag: ['a', 'b c'],
        active: true,
        n: 0,
      }),
    ).toBe('/users?active=true&n=0&tag=a&tag=b%20c')
  })

  test('キー順に並べ、同じキーの値の順は保つ', () => {
    expect(compileUrl(undefined, '/x')(undefined, { b: '1', a: ['y', 'x'], B: '2' })).toBe('/x?B=2&a=y&a=x&b=1')
  })

  test('空白は %20、+ は %2B', () => {
    expect(compileUrl(undefined, '/s')(undefined, { q: 'a b+c' })).toBe('/s?q=a%20b%2Bc')
  })

  test('出力するクエリがなければ ? を付けない', () => {
    expect(compileUrl(undefined, '/users')(undefined, {})).toBe('/users')
    expect(compileUrl(undefined, '/users')(undefined, { a: undefined })).toBe('/users')
  })

  test('null は検証せず "null" として出力する', () => {
    const query = { a: null } as unknown as Record<string, string>
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe('/x?a=null')
  })

  test('query に null を渡しても例外にせず ? を付けない(検証しない)', () => {
    const query = null as unknown as Record<string, string>
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe('/x')
  })

  test('配列の要素は検証せず String() で文字列化する', () => {
    const query = { tag: ['a', undefined] } as unknown as Record<string, string[]>
    expect(compileUrl(undefined, '/x')(undefined, query)).toBe('/x?tag=a&tag=undefined')
  })

  test('boolean の false と空配列', () => {
    expect(compileUrl(undefined, '/x')(undefined, { a: false, tag: [] })).toBe('/x?a=false')
  })
})

describe('compileUrl: hash', () => {
  test('hash はクエリの後ろにエンコードして付ける', () => {
    expect(compileUrl(undefined, '/docs')(undefined, { a: 'x' }, 'sec 1')).toBe('/docs?a=x#sec%201')
    expect(compileUrl(undefined, '/docs')(undefined, undefined, 0)).toBe('/docs#0')
  })

  test('undefined と空文字は # を付けない', () => {
    expect(compileUrl(undefined, '/docs')(undefined, undefined, undefined)).toBe('/docs')
    expect(compileUrl(undefined, '/docs')(undefined, undefined, '')).toBe('/docs')
  })

  test('変換しない文字だけの hash はそのまま、それ以外はエンコードする', () => {
    expect(compileUrl(undefined, '/docs')(undefined, undefined, "a-_.~!*'()")).toBe("/docs#a-_.~!*'()")
    expect(compileUrl(undefined, '/docs')(undefined, undefined, 'あ/b')).toBe('/docs#%E3%81%82%2Fb')
    expect(compileUrl(undefined, '/docs')(undefined, undefined, Number.NaN)).toBe('/docs#NaN')
  })

  test('hash に null を渡しても # を付けない(検証しない)', () => {
    const hash = null as unknown as string
    expect(compileUrl(undefined, '/docs')(undefined, undefined, hash)).toBe('/docs')
  })
})

describe('compileUrl: 繰り返し呼び出し', () => {
  test('同じ関数を繰り返し呼んでも結果が混ざらない', () => {
    const user = compileUrl('https://a.example.com', '/u/[id]')
    expect(user({ id: 1 }, { q: 'x' }, 'h')).toBe('https://a.example.com/u/1?q=x#h')
    expect(user({ id: 2 })).toBe('https://a.example.com/u/2')

    const search = compileUrl(undefined, '/s')
    expect(search(undefined, { a: '1' }, 'h')).toBe('/s?a=1#h')
    expect(search()).toBe('/s')
  })
})
