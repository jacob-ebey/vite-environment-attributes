// @ts-expect-error
import _generate from "@babel/generator";
// @ts-expect-error
import _traverse from "@babel/traverse";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import * as vite from "vite";

const generate = _generate.default;
const traverse = _traverse.default;

export default function environmentAttributes(): vite.Plugin {
  const resolversSet = new Set<string>();
  const resolvers: Map<
    string,
    PromiseWithResolvers<
      (
        source: string,
        importer?: string,
      ) => Promise<vite.Rollup.PartialResolvedId | null>
    >
  > = new Map();

  const getResolver = (env: string) => {
    let resolver = resolvers.get(env);
    if (!resolver) {
      resolver = Promise.withResolvers();
      resolvers.set(env, resolver);
    }
    return resolver.promise;
  };

  return {
    name: "environment-attribute",
    enforce: "pre",
    sharedDuringBuild: true,

    buildStart() {
      if (resolversSet.has(this.environment.name)) return;

      let resolver = resolvers.get(this.environment.name);
      if (!resolver) {
        resolver = Promise.withResolvers();
        resolvers.set(this.environment.name, resolver);
      }
      const resolve = this.resolve.bind(this);
      resolver.resolve((...args) =>
        resolve(args[0], args[1], { skipSelf: true }),
      );
      resolversSet.add(this.environment.name);
    },
    async transform(code, source) {
      const [id, ...restSearch] = source.split("?");
      const info = this.getModuleInfo(source);
      const envFromId =
        new URLSearchParams(restSearch.join("?")).get("env") ?? info?.meta?.env;

      const parsed = parse(code, {
        sourceType: "unambiguous",
        plugins: ["typescript", "jsx"],
        sourceFilename: id,
      });

      let hasImports = false;
      traverse(parsed, {
        CallExpression(path: any) {
          if (
            envFromId &&
            path.node.callee.name === "require" &&
            path.node.arguments.length === 1 &&
            path.node.arguments[0].type === "StringLiteral"
          ) {
            hasImports = true;
            const id = path.node.arguments[0].value;
            if (!id.startsWith("\0")) {
              const [idBase, ...searchRest] = id.split("?");
              const search = new URLSearchParams(searchRest.join("?"));
              search.set("env", envFromId);
              const resolvedId = `${idBase}?${search.toString()}`;
              path.node.arguments[0] = t.stringLiteral(resolvedId);
            }
          }
        },
        ImportDeclaration(path: any) {
          const stmt = path.node;
          hasImports = true;
          const attributes =
            (stmt as unknown as { attributes: any[] }).attributes ?? [];
          let env: string | null = envFromId;
          for (let i = 0; i < attributes.length; i++) {
            let attribute = attributes[i];
            if (attribute.key.name !== "env") continue;
            env = attribute.value.value;
            break;
          }
          if (env) {
            const source = stmt.source.value as string;
            if (!id.startsWith("\0")) {
              const [id, ...restSearch] = source.split("?");
              const search = new URLSearchParams(restSearch.join("?"));
              search.set("env", env);
              const resolvedSource = `${id}?${search.toString()}`;
              stmt.source = t.stringLiteral(resolvedSource);
            }
          }
        },
      });

      if (!hasImports) return;

      const generated = generate(parsed, { importAttributesKeyword: "with" });
      return generated;
    },

    async resolveId(id, importer, options) {
      const [idBase, ...searchRest] = id.split("?");
      const search = new URLSearchParams(searchRest.join("?"));
      let env = search.get("env");

      if (!env && importer) {
        const [, ...searchRest] = importer.split("?");
        const search = new URLSearchParams(searchRest.join("?"));
        env = search.get("env");
        if (!env) {
          env = this.getModuleInfo(importer)?.meta?.env;
        }
      }

      if (!env) return;

      if (env && this.environment.mode !== "build") {
        throw new Error(
          "Environment attributes are not allowed outside of 'build'.",
        );
      }

      let baseId = idBase;
      search.delete("env");
      if (search.size) {
        baseId += `?${search.toString()}`;
      }

      const resolver = await getResolver(env);
      const resolved = await resolver(baseId, importer);
      if (!resolved) throw new Error(`Could not resolve ${baseId} in ${env}`);

      return {
        ...resolved,
        id: resolved.id.startsWith("\0")
          ? resolved.id.slice(1).split("?")[0]
          : resolved.id,
        meta: {
          ...resolved.meta,
          env,
        },
      };
    },
  };
}
