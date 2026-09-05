import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PWA = join(__dirname, "pwa");
const PUERTO = process.env.PORT || 8888;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function leerBody(req) {
  return new Promise(function (res) {
    if (req.method === "GET" || req.method === "HEAD") return res(null);
    var datos = "";
    req.on("data", function (c) { datos += c; });
    req.on("end", function () { res(datos || null); });
  });
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname.indexOf("/api/") === 0) {
    const nombre = url.pathname.replace("/api/", "").split("/")[0];
    try {
      const mod = await import("./netlify/functions/" + nombre + ".js?t=" + Date.now());
      const body = await leerBody(req);
      const request = new Request("http://localhost" + req.url, {
        method: req.method,
        headers: req.headers,
        body: body || undefined
      });
      const resp = await mod.default(request);
      res.writeHead(resp.status, Object.fromEntries(resp.headers));
      if (resp.body) {
        const reader = resp.body.getReader();
        while (true) {
          const r = await reader.read();
          if (r.done) break;
          res.write(r.value);
        }
      }
      res.end();
    } catch (e) {
      console.error("[api/" + nombre + "] " + e.message);
      if (e.stack) console.error(e.stack.split("\n").slice(0, 4).join("\n"));
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "error_interno", mensaje: e.message }));
    }
    return;
  }

  let archivo = join(PWA, url.pathname === "/" ? "/index.html" : url.pathname);

  try {
    const info = await stat(archivo);
    if (info.isDirectory()) archivo = join(archivo, "index.html");
    const contenido = await readFile(archivo);
    res.writeHead(200, {
      "Content-Type": MIME[extname(archivo)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(contenido);
  } catch (e) {
    try {
      const html = await readFile(join(PWA, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(html);
    } catch (e2) {
      res.writeHead(404).end("No encontrado");
    }
  }
});

servidor.on("error", function (e) {
  if (e.code === "EADDRINUSE") {
    console.error("\nEl puerto " + PUERTO + " ya esta en uso.");
    console.error('Liberalo con:  pkill -f "node servidor.js"\n');
  } else {
    console.error("\n" + e.message + "\n");
  }
  process.exit(1);
});

servidor.listen(PUERTO, function () {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const keyOk = key.indexOf("sk-ant-") === 0 && key.length > 50;
  const corpus = process.env.LOCAL_DB_PATH || process.env.TURSO_DATABASE_URL;

  console.log("");
  console.log("===================================================");
  console.log("  IURIS - Servidor de desarrollo");
  console.log("===================================================");
  console.log("");
  console.log("  App:    http://localhost:" + PUERTO);
  console.log("  Salud:  http://localhost:" + PUERTO + "/api/salud");
  console.log("");
  console.log("  API key:  " + (keyOk ? "configurada" : "FALTA o invalida"));
  console.log("  Corpus:   " + (corpus ? "configurado" : "sin cargar"));
  console.log("");
  console.log("  Ctrl+C para detener");
  console.log("===================================================");
  console.log("");
});
