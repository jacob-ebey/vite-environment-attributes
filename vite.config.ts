import * as vite from "vite";
import {
  createRunnableDevEnvironment,
  defineConfig,
  type RunnableDevEnvironment,
} from "vite";

import environmentAttributes from "./vite-environment-attributes";

const optimizeDeps: vite.UserConfig["optimizeDeps"] = {
  include: [
    "react",
    "react/jsx-dev-runtime",
    "react/jsx-runtime",
    "react-dom",
    "react-dom/server",
    "@jacob-ebey/react-server-dom-vite/client",
    "@jacob-ebey/react-server-dom-vite/server",
  ],
};

export default defineConfig({
  builder: {
    sharedConfigBuild: true,
    sharedPlugins: true,
    async buildApp(builder) {
      await Promise.all([
        builder.build(builder.environments.ssr),
        builder.build(builder.environments.react_server),
      ]);
    },
  },
  build: {
    sourcemap: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production",
    ),
  },
  environments: {
    client: {
      optimizeDeps,
    },
    ssr: {
      consumer: "server",
      build: {
        target: "es2022",
        rollupOptions: {
          input: "src/http.ts",
        },
      },
      dev: {
        createEnvironment: (name, config) =>
          createRunnableDevEnvironment(name, config),
      },
      resolve: {
        noExternal: true,
      },
      optimizeDeps,
    },
    react_server: {
      consumer: "server",
      build: {
        rollupOptions: {
          input: "noop.js",
        },
      },
      dev: {
        createEnvironment: (name, config) =>
          createRunnableDevEnvironment(name, config),
      },
      resolve: {
        conditions: ["react-server"],
        externalConditions: ["react-server"],
        noExternal: true,
      },
      optimizeDeps,
    },
  },
  plugins: [
    environmentAttributes(),
    {
      name: "dev-server",
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              const reactEnv = server.environments
                .react_server as RunnableDevEnvironment;
              const ssrEnv = server.environments.ssr as RunnableDevEnvironment;
              const [reactMod, ssrMod] = await Promise.all([
                reactEnv.runner.import("src/react-server.tsx"),
                ssrEnv.runner.import("src/server.tsx"),
              ]);
              await ssrMod.prerenderHandler(reactMod.reactServer)(req, res);
            } catch (reason) {
              next(reason);
            }
          });
        };
      },
    },
  ],
});
