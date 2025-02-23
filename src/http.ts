import { prerenderHandler } from "./server";
import { reactServer } from "./react-server" with { env: "react_server" };

export const listener = prerenderHandler(reactServer);
