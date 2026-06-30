export type QueryValue = string | number | boolean;

export type RurouteFactory = <Template extends string>(
  template: Template,
) => RurouteTemplate<Template>;

export interface CreateRurouteOptions {
  prefix?: string;
}

export interface RouteMeta {
  pathSegments: string[];
  queryKeys: string[];
  hashKey: string | undefined;
  hashBeforeQuery: boolean;
}

export interface RurouteTemplate<Template> {
  types(): HasParams<Template> extends false ? () => string : never;
  types<
    Params extends RouteParamsOf<Template> &
      Record<Exclude<keyof RouteParamsOf<Template>, keyof Params>, never> &
      Record<Exclude<keyof Params, keyof RouteParamsOf<Template>>, never>,
  >(): (params: Params) => string;
}

type RouteParamsOf<Template> =
  Section<Template> extends {
    path: infer Path extends string;
    query: infer Query extends string;
    hash: infer Hash extends string;
  }
    ? { [Key in PathParamKeys<Path> & string]: QueryValue } & {
        [Key in QueryParamKeys<Query> & string]?: QueryValue;
      } & { [Key in HashParamKey<Hash> & string]: QueryValue }
    : never;

type RemoveScheme<Template> = Template extends `${string}://${infer Rest}` ? Rest : Template;

type Section<Template> =
  RemoveScheme<Template> extends `${infer Before}#${infer After}`
    ? After extends `${infer Hash}?${infer Query}`
      ? { path: Before; query: Query; hash: Hash }
      : Before extends `${infer Path}?${infer Query}`
        ? { path: Path; query: Query; hash: After }
        : { path: Before; query: ""; hash: After }
    : RemoveScheme<Template> extends `${infer Before}?${infer Query}`
      ? { path: Before; query: Query; hash: "" }
      : { path: RemoveScheme<Template>; query: ""; hash: "" };

type PathParamKeys<Path> = Path extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer After}`
    ? Trim<Name> | PathParamKeys<After>
    : Trim<Rest>
  : never;

type QueryParamKeys<Query extends string> = Query extends ""
  ? never
  : Query extends `${infer Key}&${infer Rest}`
    ? Trim<Key> | QueryParamKeys<Rest>
    : Trim<Query>;

type HashParamKey<Hash extends string> = Trim<Hash> extends "" ? never : Trim<Hash>;

type Whitespace = " " | "\n" | "\r" | "\t";

type TrimLeft<Value extends string> = Value extends `${Whitespace}${infer Rest}`
  ? TrimLeft<Rest>
  : Value;

type TrimRight<Value extends string> = Value extends `${infer Rest}${Whitespace}`
  ? TrimRight<Rest>
  : Value;

type Trim<Value extends string> = TrimRight<TrimLeft<Value>>;

type HasParams<Template> = keyof RouteParamsOf<Template> extends never ? false : true;
