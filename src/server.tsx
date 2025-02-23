import type { RequestListener } from "node:http";
import type { Readable } from "node:stream";

// @ts-expect-error - no types
import * as RSD from "@jacob-ebey/react-server-dom-vite/client";
import ReactDOM from "react-dom/server";
import { test } from "#env-specific";

export const prerenderHandler: (
  reactServer: () => Readable,
) => RequestListener = (reactServer) => async (req, res) => {
  const root = await RSD.createFromNodeStream(reactServer());
  ReactDOM.renderToPipeableStream(
    <html lang="en">
      <head></head>
      <body>
        {root}
        <footer>Env {test}</footer>
      </body>
    </html>,
  ).pipe(res);
};
