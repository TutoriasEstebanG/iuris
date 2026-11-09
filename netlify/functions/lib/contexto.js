/**
 * Iuris — Enriquecimiento y recontextualización de consultas dependientes del historial
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const STOP = new Set([
  "que", "los", "las", "por", "para", "con", "una", "uno", "del", "sobre",
  "cual", "cuando", "como", "donde", "puede", "debe", "este", "esta", "estos",
  "estas", "ese", "esa", "esos", "esas", "aquel", "aquella", "dicho", "dicha",
  "pero", "sino", "bien", "todo", "toda", "todos", "todas", "otro", "otra",
  "algo", "nada", "hola", "gracias", "favor", "explicame", "decime", "cual",
  "cuales", "entonces", "tambien", "ademas", "segun", "entre", "hacia", "desde"
]);

const RX_DEPENDENCIA = /\b(este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|dicho|dicha|mismo|misma|lo|la|los|las|anterior|caso|instituto|norma|articulo|fallo|precedente|plazo|requisito|excepcion|elemento)\b/i;
const RX_CONECTORES_INICIO = /^(y\s+|pero\s+|entonces\s+|en\s+(?:ese|este)\s+caso|y\s+si\s+|que\s+pasa\s+si\s+|cuales\s+son\s+|como\s+se\s+|quien\s+|que\s+dijo\s+)/i;

export function contextualizarConsulta(mensajes = []) {
  if (!Array.isArray(mensajes) || !mensajes.length) return "";
  const ultima = mensajes[mensajes.length - 1];
  const textoActual = (ultima?.content || ultima?.texto || "").trim();
  if (mensajes.length < 2) return textoActual;

  const palabras = textoActual.split(/\s+/).filter(Boolean);
  const esCorta = palabras.length <= 7;
  const tieneDependencia = RX_DEPENDENCIA.test(textoActual) || RX_CONECTORES_INICIO.test(textoActual);

  if (!esCorta && !tieneDependencia) {
    return textoActual;
  }

  // Extraer términos ancla de los últimos 3 mensajes anteriores
  const anteriores = mensajes.slice(-4, -1);
  const terminosRelevantes = [];
  const vistos = new Set();

  for (let i = anteriores.length - 1; i >= 0; i--) {
    const raw = anteriores[i].content || anteriores[i].texto || "";
    const toks = raw.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 4 && !STOP.has(t));

    for (const tok of toks) {
      if (!vistos.has(tok)) {
        vistos.add(tok);
        terminosRelevantes.push(tok);
        if (terminosRelevantes.length >= 6) break;
      }
    }
    if (terminosRelevantes.length >= 6) break;
  }

  if (!terminosRelevantes.length) return textoActual;

  return `${textoActual} ${terminosRelevantes.join(" ")}`;
}
