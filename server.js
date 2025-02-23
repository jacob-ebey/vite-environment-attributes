import * as http from "http";

import { listener } from "./dist/http.js";

const server = http.createServer(listener);

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
