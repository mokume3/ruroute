import { expect, test } from 'vitest'
import * as type from '../src/type'

test('type.empty は kind を持つ', () => {
  expect(type.empty).toEqual({ kind: 'empty' })
})

test('スキーマは実行時に同じ値を返す(型だけの情報)', () => {
  const schemas = [
    type.string,
    type.number,
    type.boolean,
    type.literal(['a', 1]),
    type.union([type.string, type.number]),
    type.custom<string>(),
    type.array(type.string),
    type.optional(type.string),
  ]
  for (const s of schemas) expect(s).toBe(type.string)
})

test('type.route() は type.empty と同じ', () => {
  expect(type.route()).toBe(type.empty)
})

test('type.route(methods) はメソッド定義を保持する', () => {
  const methods = { get: type.empty, post: { query: { a: type.string } } }
  expect(type.route(methods)).toEqual({ kind: 'route', methods })
})
