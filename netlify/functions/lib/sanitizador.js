/**
 * Iuris — Sanitizacion antes del prompt (Regla 6)
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const INYECCION = [
  { rx: /ignor[aáe]\s+(las?\s+)?(instrucciones?|indicaciones?|reglas?)\s+(anteriores?|previas?)/gi, r: "[filtrado]" },
  { rx: /olvid[aáe]\s+(todo\s+)?lo\s+anterior/gi, r: "[filtrado]" },
  { rx: /disregard\s+(all\s+)?(previous|prior)\s+instructions?/gi, r: "[filtered]" },
  { rx: /^\s*(system|assistant|human|user)\s*:/gim, r: "" },
  { rx: /<\|?(system|assistant|human|endoftext|im_start|im_end)\|?>/gi, r: "" },
  { rx: /╔[═]{10,}╗|╚[═]{10,}╝/g, r: "" },
  { rx: /^\s*\[FUENTE\s+\d+\]/gim, r: "" },
];

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g;

export function sanitizarTexto(t, max = 8000) {
  if (typeof t !== "string") return "";
  let s = t.replace(CONTROL, "");
  for (const { rx, r } of INYECCION) s = s.replace(rx, r);
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, l, c) => {
    if (c.length < 200) return `[tecnico: ${c.trim().slice(0,150)}]`;
    if (/ignor|olvid|system\s*:/i.test(c)) return "[bloque filtrado]";
    return `[texto tecnico: ${c.trim().slice(0,200)}...]`;
  });
  s = s.replace(/[ \t]{4,}/g, "   ").replace(/\n{4,}/g, "\n\n");
  return (s.length > max ? s.slice(0, max) + "\n[truncado]" : s).trim();
}

const enumSeg = (v, ok, def) => ok.includes(v) ? v : def;
const numSeg = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};
const urlSeg = (u) => {
  if (typeof u !== "string") return "";
  const s = u.trim().slice(0, 500);
  if (!/^https?:\/\//i.test(s)) return "";
  if (/javascript:|data:|file:/i.test(s)) return "";
  try { new URL(s); return s; } catch { return ""; }
};

export function sanitizarDocumento(d) {
  if (!d || typeof d !== "object") return null;
  return {
    id: String(d.id || "").replace(/[^\w\-.]/g, "").slice(0, 80),
    sigla: sanitizarTexto(d.sigla, 20),
    cuerpo_legal: sanitizarTexto(d.cuerpo_legal, 150),
    articulo: sanitizarTexto(d.articulo, 30),
    rubrica: sanitizarTexto(d.rubrica, 200),
    texto: sanitizarTexto(d.texto, 8000),
    ubicacion: sanitizarTexto(d.ubicacion, 300),
    estado: enumSeg(d.estado, ["vigente","derogado","reformado"], "vigente"),
    jerarquia: numSeg(d.jerarquia, 1, 5) ?? 3,
    vigente_hasta: typeof d.vigente_hasta === "string"
      ? d.vigente_hasta.slice(0, 10) : null,
    reformas: (Array.isArray(d.reformas) ? d.reformas : []).slice(0, 8)
      .map(r => ({ norma: sanitizarTexto(r.norma, 100),
                   bo: sanitizarTexto(r.bo, 20) })),
    fuente_url: urlSeg(d.fuente_url),
    via: enumSeg(d.via, ["bm25","cita_directa","concordancia",
                         "inyeccion_constitucional"], ""),
    _sanitizado: true,
  };
}

export function sanitizarContexto(ctx) {
  return {
    normas: (ctx.normas || []).map(sanitizarDocumento)
      .filter(Boolean).slice(0, 20),
    advertencias: (ctx.advertencias || []).slice(0, 10).map(a => ({
      nivel: enumSeg(a.nivel, ["baja","media","alta","critica"], "media"),
      texto: sanitizarTexto(a.texto, 400),
    })),
    _sanitizado: true,
  };
}

export function verificarSanitizado(ctx) {
  if (!ctx._sanitizado)
    throw new Error("REGLA 6 VIOLADA: contexto sin sanitizar");
  return true;
}
