/**
 * Iuris — Endpoint de salud
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { verificarCorpus } from "./lib/db.js";

function normalizarModelo(nombre, porDefecto) {
  const m = String(nombre || porDefecto || "").trim();
  if (m.includes("3-5-sonnet") || m.includes("sonnet-4-5")) return "claude-sonnet-5";
  if (m.includes("3-5-haiku") || m.includes("haiku-4-5")) return "claude-haiku-5-5";
  return m || porDefecto;
}

export default async () => {
  const t0 = Date.now();
  const estado = {
    ok: true, version: "1.0.0",
    timestamp: new Date().toISOString(),
    servicios: {
      anthropic: {
        configurado: !!process.env.ANTHROPIC_API_KEY,
        modelo: normalizarModelo(process.env.MODELO_PRINCIPAL, "claude-sonnet-5"),
      },
    },
  };

  try {
    const c = await verificarCorpus();
    estado.servicios.corpus = c;
    if (!c.ok) {
      estado.ok = false;
      estado.nota = "Sin corpus: la app funciona pero sin anclaje normativo.";
    }
  } catch (e) {
    estado.servicios.corpus = { ok: false, error: e.message };
    estado.ok = false;
    estado.nota = "Sin corpus: la app funciona pero sin anclaje normativo.";
  }

  estado.latencia_ms = Date.now() - t0;

  return new Response(JSON.stringify(estado, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
};
