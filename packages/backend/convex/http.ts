import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { upload, modelAudio } from "./speechUpload";
const http = httpRouter(); auth.addHttpRoutes(http);
http.route({ path: "/speech/upload", method: "POST", handler: upload });
http.route({ path: "/speech/model", method: "GET", handler: modelAudio });
export default http;
