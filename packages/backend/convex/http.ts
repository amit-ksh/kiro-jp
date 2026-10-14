import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { upload } from "./speechUpload";
const http = httpRouter(); auth.addHttpRoutes(http);
http.route({ path: "/speech/upload", method: "POST", handler: upload });
export default http;
