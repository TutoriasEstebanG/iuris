/**
 * Iuris — Endpoint de herramientas forenses y procesales
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {
  DEFINICIONES_HERRAMIENTAS,
  ejecutarHerramienta,
  generarCasoDocente
} from "./lib/herramientas.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS });

  if (request.method === "GET") {
    return json({
      herramientas: DEFINICIONES_HERRAMIENTAS.map(t => ({
        nombre: t.name,
        descripcion: t.description,
        parametros: t.input_schema,
      })),
    });
  }

  if (request.method !== "POST")
    return json({ error: "Metodo no permitido" }, 405);

  try {
    const body = await request.json();
    const { herramienta, parametros = {}, accion } = body;

    if (accion === "generar_caso") {
      const caso = generarCasoDocente(parametros);
      return json({ ok: true, caso });
    }

    if (!herramienta) {
      return json({ error: "Falta el campo 'herramienta'" }, 400);
    }

    const resultado = await ejecutarHerramienta(herramienta, parametros);
    return json({ ok: true, herramienta, resultado });

  } catch (e) {
    console.error("[herramientas]", e);
    return json({ error: "error_herramienta", mensaje: e.message }, 400);
  }
};
