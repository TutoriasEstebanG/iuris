import assert from "node:assert/strict";
import { sanitizarAdjunto } from "../netlify/functions/lib/sanitizador.js";
import { MODOS, PROMPT_ANALISIS_DOCUMENTO } from "../netlify/functions/lib/prompts.js";
import endpointDocumento from "../netlify/functions/documento.js";

console.log("▶ Iniciando pruebas de Fase 3: RAG Multimodal y Documentos...");

// 1. Sanitización de adjuntos válidos
{
  const b64Valido = Buffer.from("%PDF-1.4 fallo judicial de prueba").toString("base64");
  const res = sanitizarAdjunto({
    nombre: "cedula_notificacion_causa1234.pdf",
    tipo: "application/pdf",
    base64: b64Valido,
  });

  assert.ok(res, "Debe aceptar un PDF válido");
  assert.equal(res.tipo, "application/pdf");
  assert.equal(res.nombre, "cedula_notificacion_causa1234.pdf");
  assert.equal(res.base64, b64Valido);
  assert.equal(res._sanitizado, true);
}

// 2. Limpieza de prefijo Data URI
{
  const b64Raw = Buffer.from("imagen de prueba").toString("base64");
  const conDataUri = `data:image/png;base64,${b64Raw}`;
  const res = sanitizarAdjunto({
    nombre: "acta_audiencia.png",
    tipo: "image/png",
    base64: conDataUri,
  });

  assert.ok(res);
  assert.equal(res.base64, b64Raw, "Debe despojar el prefijo data URI");
  assert.equal(res.tipo, "image/png");
}

// 3. Sanitización de nombres con caracteres peligrosos o path traversal
{
  const b64 = Buffer.from("test").toString("base64");
  const res = sanitizarAdjunto({
    nombre: "../../../etc/resolucion<script>.pdf",
    tipo: "application/pdf",
    base64: b64,
  });

  assert.ok(res);
  assert.ok(!res.nombre.includes(".."), "No debe permitir path traversal");
  assert.ok(!res.nombre.includes("<script>"), "No debe contener etiquetas");
}

// 4. Rechazo de tipos no soportados o maliciosos
{
  const b64 = Buffer.from("malware").toString("base64");
  const resExe = sanitizarAdjunto({
    nombre: "sentencia.exe",
    tipo: "application/x-msdownload",
    base64: b64,
  });
  assert.equal(resExe, null, "Debe rechazar ejecutables");

  const resHtml = sanitizarAdjunto({
    nombre: "expediente.html",
    tipo: "text/html",
    base64: b64,
  });
  assert.equal(resHtml, null, "Debe rechazar archivos HTML");
}

// 5. Rechazo de cadenas base64 inválidas o con sobretamaño
{
  const corrupto = sanitizarAdjunto({
    nombre: "fallo.pdf",
    tipo: "application/pdf",
    base64: "esto!no!es!base64!",
  });
  assert.equal(corrupto, null, "Debe rechazar caracteres ajenos a base64");

  const enorme = sanitizarAdjunto({
    nombre: "expediente_gigante.pdf",
    tipo: "application/pdf",
    base64: "A".repeat(15 * 1024 * 1024),
  });
  assert.equal(enorme, null, "Debe rechazar archivos que excedan el límite de tamaño");
}

// 6. Verificación de prompts y modos pedagógicos multimodales
{
  assert.ok(MODOS.documento, "Debe estar registrado el modo 'documento'");
  assert.equal(MODOS.documento.nombre, "Análisis de Pieza Judicial");
  assert.ok(PROMPT_ANALISIS_DOCUMENTO.includes("PROTOCOLO DE ANÁLISIS MULTIMODAL"));
}

// 7. Verificación del endpoint /api/documento (CORS y validación)
{
  const reqOptions = new Request("http://localhost/api/documento", { method: "OPTIONS" });
  const resOptions = await endpointDocumento(reqOptions);
  assert.equal(resOptions.status, 204);
  assert.equal(resOptions.headers.get("Access-Control-Allow-Origin"), "*");

  const reqGet = new Request("http://localhost/api/documento", { method: "GET" });
  const resGet = await endpointDocumento(reqGet);
  assert.equal(resGet.status, 405);

  const reqSinDoc = new Request("http://localhost/api/documento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const resSinDoc = await endpointDocumento(reqSinDoc);
  assert.equal(resSinDoc.status, 400);
}

console.log("✔ Todas las pruebas de Fase 3 pasaron exitosamente.");
