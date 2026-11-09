/**
 * Iuris — Guardrail de cobertura normativa
 * El inventario NO se define aca: se genera desde la base con
 *   python3 ingesta/generar_cobertura.py
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { SIGLAS_EN_CORPUS, CUERPOS, AUSENTES_DATOS }
  from "./cobertura_datos.js";

export const CUBIERTO = CUERPOS;
export const SIGLAS = SIGLAS_EN_CORPUS;

// compila los regex una sola vez
const AUSENTES = Object.fromEntries(
  Object.entries(AUSENTES_DATOS).map(([rama, d]) => [
    rama, { rx: new RegExp(d.rx, "i"), norma: d.norma },
  ])
);

/**
 * @param {string} consulta
 * @returns {{ramas: string[], aviso: string|null}}
 */
export function evaluarCobertura(consulta) {
  const ramas = [];
  const faltantes = [];
  for (const [rama, def] of Object.entries(AUSENTES)) {
    if (def.rx.test(consulta)) {
      ramas.push(rama);
      faltantes.push(`${rama} (${def.norma})`);
    }
  }
  if (!ramas.length) return { ramas: [], aviso: null };

  const tengo = Object.entries(CUERPOS)
    .map(([s, c]) => `${c} (${s})`).join(", ");

  const aviso =
    `\n\n<limitacion_cobertura>\n` +
    `Materia no cubierta en corpus: ${faltantes.join("; ")}.\n` +
    `Corpus normativo disponible: ${tengo}.\n` +
    `Directivas de respuesta:\n` +
    `1. Advertir al inicio que la materia no cuenta con corpus normativo cargado y el desarrollo es doctrinario.\n` +
    `2. Indicar qué legislación oficial rige el instituto consultado.\n` +
    `3. No afirmar plazos, números de artículo ni fórmulas sin texto verificado.\n` +
    `4. Extensión máxima orientativa: 400 palabras en prosa analítica sobria, sin tablas ni esquemas artificiosos.\n` +
    `</limitacion_cobertura>\n`;

  return { ramas, aviso };
}
