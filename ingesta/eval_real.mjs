import { Retriever } from "../netlify/functions/lib/retriever.js";

const CASOS = [
  ["proteccion del derecho de propiedad", ["AR-CN-art17","AR-CCyC-art1941"]],
  ["regimen de defensa del consumidor", ["AR-CN-art42","AR-CCyC-art1092"]],
  ["responsabilidad por riesgo de la cosa", ["AR-CCyC-art1757","AR-CCyC-art1758"]],
  ["derecho a un ambiente sano", ["AR-CN-art41","AR-CCyC-art1973"]],
  ["proteccion de la vivienda familiar", ["AR-CCyC-art244","AR-CCyC-art245"]],
  ["libertad de expresion y censura previa", ["AR-CN-art14","AR-CN-art32"]],
  ["plazo de prescripcion liberatoria", ["AR-CCyC-art2560","AR-CCyC-art2562"]],
  ["nulidad absoluta del acto juridico", ["AR-CCyC-art386","AR-CCyC-art387"]],
  // --- EFIP 1 Modulo 2: Penal Parte General ---
  ["legitima defensa y estado de necesidad", ["AR-CP-art34"]],
  ["tentativa y desistimiento voluntario", ["AR-CP-art42","AR-CP-art43"]],
  ["participacion criminal complicidad", ["AR-CP-art45","AR-CP-art46"]],
  ["concurso ideal y concurso real de delitos", ["AR-CP-art54","AR-CP-art55"]],
  ["exceso en la legitima defensa", ["AR-CP-art35"]],
  ["suspension del juicio a prueba", ["AR-CP-art76_bis"]],
  // --- EFIP 1 Modulo 1: Constitucional ---
  ["supremacia constitucional y tratados", ["AR-CN-art31","AR-CN-art75"]],
  ["garantias del debido proceso", ["AR-CN-art18"]],
  ["reforma constitucional poder constituyente", ["AR-CN-art30"]],
  ["competencias del poder judicial federal", ["AR-CN-art116"]],
  // --- EFIP 1 Modulo 3: Privado ---
  ["capacidad restringida e inhabilitados", ["AR-CCyC-art32","AR-CCyC-art48"]],
  ["vicios de los actos juridicos lesion", ["AR-CCyC-art332"]],
  ["simulacion y fraude", ["AR-CCyC-art333","AR-CCyC-art338"]],
  ["obligacion de saneamiento eviccion", ["AR-CCyC-art1033","AR-CCyC-art1044"]],
  ["teoria de la imprevision", ["AR-CCyC-art1091"]],
  ["clausula resolutoria implicita", ["AR-CCyC-art1087","AR-CCyC-art1088"]],
  ["boleto de compraventa", ["AR-CCyC-art1170"]],
  ["mandato con y sin representacion", ["AR-CCyC-art1319","AR-CCyC-art1320"]],
];

let tot = 0, hit = 0;
for (const [q, esp] of CASOS) {
  const r = await new Retriever().recuperar(q);
  const ids = new Set(r.documentos.map(d => d.id));
  const ok = esp.filter(e => ids.has(e));
  tot += esp.length; hit += ok.length;
  console.log(`${ok.length === esp.length ? "OK " : "-- "} ${q.slice(0,42).padEnd(44)} ${ok.length}/${esp.length}`);
  const f = esp.filter(e => !ids.has(e));
  if (f.length) console.log(`      faltan: ${f.join(", ")}`);
}
console.log(`\nTOTAL: ${hit}/${tot} (${Math.round(100*hit/tot)}%)`);
