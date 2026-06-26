type SplitScheme<Template extends string> = Template extends `${infer Scheme}://${infer Rest}`
  ? { scheme: `${Scheme}://`; rest: Rest }
  : { scheme: ""; rest: Template };

type ExtractParts<Template extends string> =
  Template extends `${infer Path}#${infer Hash}?${infer Query}`
    ? { path: Path; query: Query; hash: Hash }
    : Template extends `${infer Path}?${infer Query}#${infer Hash}`
      ? { path: Path; query: Query; hash: Hash }
      : Template extends `${infer Path}?${infer Query}`
        ? { path: Path; query: Query; hash: never }
        : Template extends `${infer Path}#${infer Hash}`
          ? { path: Path; query: never; hash: Hash }
          : { path: Template; query: never; hash: never };

type ExtractPathParams<Path extends string> =
  Path extends `${string}:${infer Parameter}/${infer Rest}`
    ? Parameter | ExtractPathParams<`/${Rest}`>
    : Path extends `${string}:${infer Parameter}`
      ? Parameter
      : never;

type ExtractQueryParams<Query extends string> = Query extends `${infer Parameter}&${infer Rest}`
  ? Parameter | ExtractQueryParams<Rest>
  : Query extends ""
    ? never
    : Query;

type ValidatePathParams<Path extends string, T> = {
  [ParameterName in ExtractPathParams<Path>]: ParameterName extends keyof T
    ? undefined extends T[ParameterName]
      ? "Error: Path parameters cannot be optional"
      : T[ParameterName] extends string
        ? T[ParameterName]
        : "Error: Path parameter must be string"
    : "Error: Missing path parameter";
};

type ValidateQueryParams<Query extends string, T> = [Query] extends [never]
  ? unknown
  : Exclude<ExtractQueryParams<Query>, keyof T> extends never
    ? unknown
    : {
        [MissingQueryParameter in Exclude<
          ExtractQueryParams<Query>,
          keyof T
        >]: "Error: Missing query parameter";
      };

type ValidateHashParam<Hash, T> = [Hash] extends [never]
  ? unknown
  : {
      [HashName in Hash & string]: HashName extends keyof T
        ? undefined extends T[HashName]
          ? "Error: Hash parameter cannot be optional"
          : T[HashName] extends string
            ? T[HashName]
            : "Error: Hash parameter must be string"
        : "Error: Missing hash parameter";
    };

export type ValidateTypes<Template extends string, T> =
  SplitScheme<Template> extends {
    rest: infer Rest extends string;
  }
    ? ExtractParts<Rest> extends {
        path: infer Path extends string;
        query: infer Query extends string;
        hash: infer Hash;
      }
      ? ValidatePathParams<Path, T> & ValidateQueryParams<Query, T> & ValidateHashParam<Hash, T>
      : never
    : never;
