import * as stream from "node:stream";

// @ts-expect-error - no types
import * as RSD from "@jacob-ebey/react-server-dom-vite/server";
import { test } from "#env-specific";

import "./browser";

async function App() {
  return (
    <div>
      <h1>React Server</h1>
      <p>Env {test}</p>
    </div>
  );
}

export function reactServer() {
  return RSD.renderToPipeableStream(<App />).pipe(new stream.PassThrough());
}
