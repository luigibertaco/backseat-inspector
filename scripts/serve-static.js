import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PORT = Number.parseInt(process.env.PORT ?? "4173", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolveRequestPath(url) {
  const pathname = new URL(url, `http://localhost:${PORT}`).pathname;
  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const normalizedPath = normalize(decodeURIComponent(requestedPath));

  if (normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return null;
  }

  return join(ROOT, normalizedPath);
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");

  if (!filePath) {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(500);
    response.end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Backseat Inspector is available at http://localhost:${PORT}`);
});
