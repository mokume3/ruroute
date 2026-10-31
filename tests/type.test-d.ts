import { expectTypeOf, test } from 'vitest'
import * as type from '../src/type'
import type { Infer } from '../src/types'

test('各マーカーの TS 型', () => {
  expectTypeOf<Infer<typeof type.string>>().toEqualTypeOf<string>()
  expectTypeOf<Infer<typeof type.number>>().toEqualTypeOf<number>()
  expectTypeOf<Infer<typeof type.boolean>>().toEqualTypeOf<boolean>()

  const lit = type.literal(['a', 1])
  expectTypeOf<Infer<typeof lit>>().toEqualTypeOf<'a' | 1>()

  const uni = type.union([type.string, type.literal([1, 2])])
  expectTypeOf<Infer<typeof uni>>().toEqualTypeOf<string | 1 | 2>()

  const cus = type.custom<'x' | 'y'>()
  expectTypeOf<Infer<typeof cus>>().toEqualTypeOf<'x' | 'y'>()

  const arr = type.array(type.number)
  expectTypeOf<Infer<typeof arr>>().toEqualTypeOf<readonly number[]>()

  const opt = type.optional(type.array(type.string))
  expectTypeOf<Infer<typeof opt>>().toEqualTypeOf<readonly string[] | undefined>()
})

test('組み合わせの制約', () => {
  // @ts-expect-error union に optional
  type.union([type.string, type.optional(type.number)])
  // @ts-expect-error union に array
  type.union([type.string, type.array(type.number)])
  // @ts-expect-error optional の入れ子
  type.optional(type.optional(type.string))
  // @ts-expect-error array の要素に array
  type.array(type.array(type.string))
  // @ts-expect-error custom に object
  type.custom<{ a: 1 }>()
  // @ts-expect-error custom に undefined を含む型
  type.custom<string | undefined>()
})

test('置ける位置の制約', () => {
  // @ts-expect-error params に boolean
  type.route({ get: { params: { id: type.boolean } } })
  // @ts-expect-error params に optional
  type.route({ get: { params: { id: type.optional(type.string) } } })
  // @ts-expect-error params に array
  type.route({ get: { params: { id: type.array(type.string) } } })
  // @ts-expect-error params に boolean の custom
  type.route({ get: { params: { id: type.custom<boolean>() } } })
  // @ts-expect-error hash に array
  type.route({ get: { hash: type.array(type.string) } })
  // @ts-expect-error hash に boolean
  type.route({ get: { hash: type.boolean } })
  // @ts-expect-error hash に optional(array)
  type.route({ get: { hash: type.optional(type.array(type.string)) } })
  // @ts-expect-error 未知のメソッド
  type.route({ patch: type.empty })
  // @ts-expect-error 既知のメソッドと並んだ未知のメソッド
  type.route({ get: type.empty, patch: type.empty })
  // @ts-expect-error メソッド定義内の未知のキー(params の typo)
  type.route({ get: { query: { a: type.string }, parms: { id: type.number } } })

  type.route({
    get: {
      params: { id: type.union([type.string, type.number]) },
      query: {
        a: type.boolean,
        b: type.array(type.literal(['x'])),
        c: type.optional(type.array(type.custom<`${number}px`>())),
      },
      hash: type.optional(type.number),
    },
    post: type.empty,
  })
})
