// Netlify runs this function for every address that is not a file in public/ (pictures, CSS, JS).
import { handle } from "../../app/server.mjs";

export default (req) => handle(req);

export const config = { path: "/*", preferStatic: true };
