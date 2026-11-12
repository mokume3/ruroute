declare const OUTPUT: unique symbol

/** A value allowed in path parameters and hashes. */
export type ParamValue = string | number
/** A scalar value allowed in query parameters. */
export type Scalar = string | number | boolean
/** A value allowed in query parameters. */
export type QueryValue = Scalar | readonly Scalar[] | undefined

/** A marker returned by type.*. T is a phantom type with no runtime representation. */
export interface Schema<T = unknown> {
  readonly [OUTPUT]: T
}

/** Extracts the TypeScript type from a Schema. */
export type Infer<S> = S extends Schema<infer T> ? T : never

/** The marker returned by type.empty. */
export interface Empty {
  readonly kind: 'empty'
}

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

type ParamsDef = Record<string, Schema<ParamValue>>
type QueryDef = Record<string, Schema<QueryValue>>
type HashDef = Schema<ParamValue | undefined>

interface MethodDef {
  readonly params?: ParamsDef
  readonly query?: QueryDef
  readonly hash?: HashDef
}

export type MethodsDef = { readonly [M in Method]?: MethodDef | Empty }

/** The marker returned by type.route({...}). */
export interface Route<M extends MethodsDef = MethodsDef> {
  readonly kind: 'route'
  readonly methods: M
}

export type RouteDef = Route | Empty

/** Rejects unknown methods and misspelled MethodDef keys in type.route() arguments. */
export type StrictMethods<M> = {
  [K in keyof M]: K extends Method
    ? M[K] extends Empty
      ? M[K]
      : M[K] & { [P in Exclude<keyof M[K], keyof MethodDef>]: never }
    : never
}

// ---- 呼び出し引数 ----

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type QueryArgs<Q extends QueryDef> = Simplify<
  {
    [K in keyof Q as undefined extends Infer<Q[K]> ? never : K]: Infer<Q[K]>
  } & {
    [K in keyof Q as undefined extends Infer<Q[K]> ? K : never]?: Infer<Q[K]>
  }
>

type HasRequiredKey<T> = Partial<T> extends T ? false : true

/** Accepts either the full name or its shorthand, but not both. */
type Alias<Long extends string, Short extends string, V, Required extends boolean> = Required extends true
  ? ({ [K in Long]: V } & { [K in Short]?: never }) | ({ [K in Short]: V } & { [K in Long]?: never })
  : ({ [K in Long]?: V } & { [K in Short]?: never }) | ({ [K in Short]?: V } & { [K in Long]?: never })

type ParamsPart<D> = D extends { readonly params: infer P extends ParamsDef }
  ? Alias<'params', 'p', { [K in keyof P]: Infer<P[K]> }, true>
  : unknown

/** The query definition's argument type. */
type QueryInput<D> = D extends { readonly query: infer Q extends QueryDef } ? QueryArgs<Q> : never

/**
 * Q inferred from the call, with keys outside the definition rejected.
 * QueryInput<D> does not narrow Q, but without it the keys point only at the call site and lose the definition's JSDoc.
 */
type ExactQuery<D, Q> = Q & QueryInput<D> & { [K in Exclude<keyof Q, keyof QueryInput<D>>]: never }

type QueryPart<D, Q> = D extends { readonly query: QueryDef }
  ? Alias<'query', 'q', ExactQuery<D, Q>, HasRequiredKey<QueryInput<D>>>
  : unknown

/** The hash definition's argument type. */
type HashInput<D> = D extends { readonly hash: infer H extends HashDef } ? Infer<H> : never

/**
 * Adds no type, only the JSDoc of definition key K, by mapping it like Pick.
 * Kept as its own alias because TypeScript 7.0 drops the JSDoc when this is inlined into an intersection.
 */
type KeyDoc<D, K extends keyof D> = { [P in K]?: unknown }

/** KeyDoc renamed to Name. Only TypeScript 7.1 and later show the JSDoc of a renamed key. */
type RenamedKeyDoc<D, K extends keyof D, Name extends string> = {
  [P in keyof D as P extends K ? Name : never]?: unknown
}

type HashPart<D, H> = D extends { readonly hash: HashDef }
  ? Alias<'hash', 'h', H, undefined extends HashInput<D> ? false : true> &
      KeyDoc<D, 'hash'> &
      RenamedKeyDoc<D, 'hash', 'h'>
  : unknown

/** Call arguments for method definition D, supporting full and shorthand names. */
type MethodArgs<D, Q = QueryInput<D>, H = HashInput<D>> = ParamsPart<D> & QueryPart<D, Q> & HashPart<D, H>

type HasAnyArg<D> = D extends { readonly params: ParamsDef } | { readonly query: QueryDef } | { readonly hash: HashDef }
  ? true
  : false

/** The call signature for method definition D. Arguments are optional when no values are required. */
type MethodFn<D, B, P extends string> =
  HasAnyArg<D> extends false
    ? () => UrlResult<B, P, D, never, never>
    : HasRequiredKey<MethodArgs<D>> extends true
      ? <const Q extends QueryInput<D> = never, const H extends HashInput<D> = never>(
          args: MethodArgs<D, Q, H>,
        ) => UrlResult<B, P, D, Q, H>
      : <const Q extends QueryInput<D> = never, const H extends HashInput<D> = never>(
          args?: MethodArgs<D, Q, H>,
        ) => UrlResult<B, P, D, Q, H>

// ---- ルートオブジェクト ----

type MethodsOf<R> = R extends Route<infer M> ? M : { readonly get: Empty }

type EncodedParam<S extends Schema<ParamValue>> =
  Infer<S> extends infer V ? (V extends string ? string : V extends number ? number : never) : never

type ReplacePathParams<P extends string, D> = P extends `${infer Before}[${infer Name}]${infer After}`
  ? D extends { readonly params: infer Ps extends ParamsDef }
    ? Name extends keyof Ps
      ? `${Before}${EncodedParam<Ps[Name]>}${ReplacePathParams<After, D>}`
      : never
    : never
  : P

type JoinBase<B, P extends string> = B extends string
  ? B extends `${infer Before}/`
    ? P extends `/${string}`
      ? `${Before}${P}`
      : `${B}${P}`
    : `${B}${P}`
  : P

// ---- クエリ文字列 ----

/** Characters URLSearchParams leaves unencoded in keys, in code unit order (the order of URLSearchParams.sort()). */
type KeyChars = '*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'

type IsSafeKey<K extends string> = K extends `${infer C}${infer Rest}`
  ? KeyChars extends `${string}${C}${string}`
    ? IsSafeKey<Rest>
    : false
  : true

type CharLess<A extends string, B extends string> = KeyChars extends `${string}${A}${string}${B}${string}`
  ? true
  : false

type KeyLess<A extends string, B extends string> = A extends `${infer A1}${infer AR}`
  ? B extends `${infer B1}${infer BR}`
    ? A1 extends B1
      ? KeyLess<AR, BR>
      : CharLess<A1, B1>
    : false
  : B extends ''
    ? false
    : true

/** One member of union U. Which one is unspecified, which is fine because the result is sorted. */
type AnyOf<U> = (U extends U ? (x: (u: U) => void) => void : never) extends (x: infer I) => void
  ? I extends (u: infer M) => void
    ? M
    : never
  : never

type InsertKey<K extends string, Sorted extends string[]> = Sorted extends [
  infer H extends string,
  ...infer Rest extends string[],
]
  ? KeyLess<K, H> extends true
    ? [K, ...Sorted]
    : [H, ...InsertKey<K, Rest>]
  : [K]

/** Insertion sort over the union. */
type SortKeys<U extends string, Sorted extends string[] = []> = [U] extends [never]
  ? Sorted
  : AnyOf<U> extends infer K extends string
    ? SortKeys<Exclude<U, K>, InsertKey<K, Sorted>>
    : Sorted

/** Keys that always appear in the query string. */
type PresentKeys<Q> = {
  [K in keyof Q & string]-?: HasRequiredKey<Pick<Q, K>> extends false
    ? never
    : undefined extends Q[K]
      ? never
      : Q[K] extends readonly unknown[]
        ? Q[K] extends readonly [unknown, ...unknown[]]
          ? K
          : never
        : K
}[keyof Q & string]

/** Keys that never appear: undefined values and empty arrays. */
type AbsentKeys<Q> = {
  [K in keyof Q & string]-?: [Exclude<Q[K], undefined>] extends [never]
    ? K
    : Exclude<Q[K], undefined> extends readonly []
      ? K
      : never
}[keyof Q & string]

/** Numbers and booleans keep their form. Strings are encoded and arrays repeat the key, so both are `${string}`. */
type QueryValueString<V> = [Exclude<V, undefined>] extends [number]
  ? `${number}`
  : [Exclude<V, undefined>] extends [boolean]
    ? `${boolean}`
    : string

/** Pairs in key order. Each optional key doubles the union, so after 4 optional keys the rest is `${string}`. */
type QueryPairs<Q, Keys, Present, Optional extends unknown[] = []> = Keys extends [
  infer K extends keyof Q & string,
  ...infer Rest,
]
  ? K extends Present
    ? `&${K}=${QueryValueString<Q[K]>}${QueryPairs<Q, Rest, Present, Optional>}`
    : Optional['length'] extends 4
      ? [Present & Rest[number]] extends [never]
        ? '' | `&${string}`
        : `&${string}`
      : `${'' | `&${K}=${QueryValueString<Q[K]>}`}${QueryPairs<Q, Rest, Present, [...Optional, unknown]>}`
  : ''

type QueryFromPairs<S> = S extends `&${infer Rest}` ? `?${Rest}` : ''

type QueryString<Q> = [Q] extends [never]
  ? ''
  : false extends IsSafeKey<keyof Q & string>
    ? '' | `?${string}`
    : QueryFromPairs<QueryPairs<Q, SortKeys<Exclude<keyof Q & string, AbsentKeys<Q>>>, PresentKeys<Q>>>

/** Empty strings and undefined add no hash. */
type HashString<H> = [H] extends [never]
  ? ''
  : H extends undefined | ''
    ? ''
    : H extends number
      ? `#${string}`
      : '' extends H
        ? '' | `#${string}`
        : `#${string}`

type QuerySuffix<D, Q> = D extends { readonly query: QueryDef } ? QueryString<Q> : ''
type HashSuffix<D, H> = D extends { readonly hash: HashDef } ? HashString<H> : ''

type UrlResult<
  B,
  P extends string,
  D,
  Q,
  H,
> = `${JoinBase<B, ReplacePathParams<P, D>>}${QuerySuffix<D, Q>}${HashSuffix<D, H>}`

type RouteObject<P extends string, R, B> = {
  readonly [K in keyof MethodsOf<R> & Method]: MethodFn<MethodsOf<R>[K], B, P>
} & (MethodsOf<R> extends { readonly get: infer G } ? MethodFn<G, B, P> : unknown)

export type Routes<R, B = string | undefined> = {
  readonly [P in keyof R]: P extends string ? RouteObject<P, R[P], B> : never
}

// ---- パス解析 ----

/** '/users/[id]/posts/[postId]' → 'id' | 'postId' */
type PathParams<P extends string> = P extends `${string}[${infer Name}]${infer Rest}` ? Name | PathParams<Rest> : never

// ---- 定義の検証 ----

type ExpectedParams<P extends string> = {
  [K in PathParams<P>]: Schema<ParamValue>
}

type ValidateMethod<P extends string, D> = [PathParams<P>] extends [never]
  ? D extends Empty
    ? D
    : D & { readonly params?: undefined }
  : D extends Empty
    ? { readonly params: ExpectedParams<P> }
    : D extends { readonly params: infer Ps }
      ? D & {
          readonly params: {
            [K in keyof Ps]: K extends PathParams<P> ? unknown : never
          } & ExpectedParams<P>
        }
      : D & { readonly params: ExpectedParams<P> }

type ValidateRoute<P extends string, R> =
  R extends Route<infer M> ? Route<{ [K in keyof M]: ValidateMethod<P, M[K]> }> : ValidateMethod<P, R>

/** Checks that paths and params keys match. Mismatches cause type errors. */
type ValidateRoutes<R> = {
  [P in keyof R]: P extends string ? ValidateRoute<P, R[P]> : never
}

/** Error message for a key that does not start with / when baseUrl is set. */
type BaseUrlKeyError = 'baseUrl を指定したときはキーを / で始まるパスにしてください'

/** Checks that keys start with /, but not //, when baseUrl is set. */
type ValidateBaseUrl<R, B> = [B] extends [undefined]
  ? unknown
  : {
      [P in keyof R]: P extends `//${string}` ? BaseUrlKeyError : P extends `/${string}` ? unknown : BaseUrlKeyError
    }

/** Validates route definitions against path params and baseUrl. Used for wrapper function arguments. */
export type ValidRoutes<R, B = undefined> = R & ValidateRoutes<R> & ValidateBaseUrl<R, B>

/** The arguments to defineRoutes. */
export interface RoutesConfig<R, B = undefined> {
  baseUrl?: B
  routes: ValidRoutes<R, B>
}

// ---- 公開型ユーティリティ ----

/** A union of route paths. */
export type RoutePath<T> = keyof T & string

/** Call arguments for path P and method M. Returns never for methods with no arguments; distributes over unions of M. */
export type RouteArgs<T, P extends RoutePath<T>, M extends keyof T[P] & Method> = M extends M
  ? T[P][M] extends (...args: infer A) => string
    ? Exclude<A[0], undefined>
    : never
  : never
