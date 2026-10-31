import type { Empty, Infer, MethodsDef, Route, Scalar, Schema, StrictMethods } from './types'

// スキーマは型だけの情報なので、実行時はすべて同じ空オブジェクトを返す(検証もしない)
const SCHEMA = {} as Schema<never>

/** A route or method with no parameters. */
export const empty: Empty = { kind: 'empty' }

export const string: Schema<string> = SCHEMA
export const number: Schema<number> = SCHEMA
export const boolean: Schema<boolean> = SCHEMA

/** One of the listed values. */
export const literal = <const T extends readonly (string | number)[]>(_values: T): Schema<T[number]> => SCHEMA

/** One of the element types. */
export const union = <const S extends readonly Schema<Scalar>[]>(_schemas: S): Schema<Infer<S[number]>> => SCHEMA

/** An arbitrary TypeScript type, converted to a string with String() at runtime. */
export const custom = <T extends Scalar>(): Schema<T> => SCHEMA

/** An array for query parameters. */
export const array = <S extends Schema<Scalar>>(_item: S): Schema<readonly Infer<S>[]> => SCHEMA

/** An optional value. */
export const optional = <S extends Schema<Scalar | readonly Scalar[]>>(_inner: S): Schema<Infer<S> | undefined> =>
  SCHEMA

/** Defines a route. Calling without arguments is equivalent to type.empty. */
export function route(): Empty
export function route<const M extends MethodsDef>(methods: M & StrictMethods<M>): Route<M>
export function route(methods?: MethodsDef): Route | Empty {
  return methods === undefined ? empty : { kind: 'route', methods }
}
