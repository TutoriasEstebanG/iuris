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
    `\n\n## LIMITACION DE CORPUS — INSTRUCCION OBLIGATORIA\n` +
    `La consulta involucra: ${faltantes.join("; ")}.\n` +
    `El corpus cargado contiene UNICAMENTE: ${tengo}. ` +
    `No tenes esa normativa a la vista.\n` +
    `Debes:\n` +
    `1. Abrir la respuesta advirtiendo de forma destacada que no dispones de ` +
    `las fuentes de esa rama y que lo que sigue no esta anclado normativamente.\n` +
    `2. Indicar que norma habria que consultar.\n` +
    `3. NO enunciar plazos, montos, porcentajes ni requisitos concretos como ` +
    `si fueran verificados. Si los mencionas, marcalos expresamente como ` +
    `orientativos y sujetos a verificacion en la fuente.\n` +
    `4. Limitarte al encuadre conceptual y a lo que SI surge del corpus cargado.\n` +
    `5. No producir un desarrollo extenso que simule respaldo normativo inexistente.\n` +
    `\n### FORMATO OBLIGATORIO PARA ESTA RESPUESTA\n` +
    `Estas instrucciones DEROGAN cualquier indicacion de formato anterior:\n` +
    `- Maximo 450 palabras en total.\n` +
    `- PROHIBIDO: tablas, esquemas ASCII, arboles, diagramas, emojis de seccion.\n` +
    `- PROHIBIDO: preguntas de control, casos practicos, ejemplos numericos.\n` +
    `- PROHIBIDO: enumerar institutos que no puedas anclar (no armes indices ` +
    `ni catalogos de temas que no tenes).\n` +
    `- Estructura unica permitida: (a) advertencia de limitacion; ` +
    `(b) que dice el corpus cargado sobre el punto, si dice algo; ` +
    `(c) que norma hay que consultar y por que.\n` +
    `- Si el usuario necesita el detalle, invitalo a reformular una vez ` +
    `cargado el corpus faltante. No lo suplas con memoria.\n`;

  return { ramas, aviso };
}
