import { RequestListener } from "http";

// @ts-expect-error - no types
import * as RSD from "@jacob-ebey/react-server-dom-vite/client";
import ReactDOM from "react-dom/server";
import { test } from "#env-specific";

import { reactServer } from "./react-server" with { env: "react_server" };

export const listener: RequestListener = async (req, res) => {
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
