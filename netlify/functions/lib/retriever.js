/**
 * Iuris — Motor de recuperacion (BM25 sobre FTS5)
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { consultar } from "./db.js";

const SIGLAS = {
  ccyc: "CCyC", "codigo civil y comercial": "CCyC",
  "código civil y comercial": "CCyC",
  cc: "CC", "codigo civil": "CC", "código civil": "CC",
  cp: "CP", "codigo penal": "CP", "código penal": "CP",
  cn: "CN", constitucion: "CN", "constitución": "CN",
  "constitucion nacional": "CN", "constitución nacional": "CN",
  cadh: "CADH", lct: "LCT", lgs: "LGS", cpccn: "CPCCN",
};

const BOOST = { 1: 2.2, 2: 1.5, 3: 1.0, 4: 0.85, 5: 0.7 };

const RX_CONST = /constitucional|amparo|h[áa]beas|debido\s+proceso|garant[íi]a|convencionalidad|supremac[íi]a|derechos\s+humanos/i;
const RX_PENAL = /delito|pena|prisi[óo]n|tipo\s+penal|dolo|antijurid|tipicidad|culpabilidad|tentativa/i;

const STOP = new Set(["que","los","las","por","para","con","una","del",
  "sobre","cual","cuando","como","donde","puede","debe","este","esta"]);

const PESOS = process.env.BM25_PESOS || "0.5,1.0,6.0,2.0,0.5";

const SINONIMOS = [
  ["daño moral", "consecuencias no patrimoniales"],
  ["patria potestad", "responsabilidad parental"],
  ["tenencia de hijos", "cuidado personal"],
  ["riesgo de la cosa", "actividad riesgosa responsabilidad objetiva"],
  ["teoría de la imprevisión", "excesiva onerosidad sobreviniente"],
  ["usucapión", "prescripción adquisitiva"],
  ["locación", "arrendamiento"],
  ["propiedad", "dominio"],
  ["dominio", "propiedad inviolable"],
  ["alquiler", "locación arrendamiento locatario"],
  ["inquilino", "locatario"],
  ["vivienda", "inmueble destinado a vivienda afectación"],
  ["prescripción", "plazo liberatoria adquisitiva"],
  ["consumidor", "relación de consumo proveedor"],
  ["ambiente", "ambiente sano inmisiones"],
  ["libertad de expresión", "imprenta prensa publicar ideas censura"],
  ["divorcio", "disolución del matrimonio"],
  ["daño", "reparación resarcimiento indemnización"],
  ["reivindicación", "acción reivindicatoria defensa del derecho real"],
  ["propiedad", "dominio perfecto imperfecto"],
  ["prescripción liberatoria", "plazo genérico dos años cinco años"],
  ["exceso", "excedido los límites impuestos por la ley"],
  ["legítima defensa", "defensa propia agresión ilegítima necesidad racional del medio"],
  ["censura previa", "libertad de imprenta publicar sus ideas por la prensa"],
  ["libertad de expresión", "imprenta prensa publicar ideas"],
  ["concurso real", "hechos independientes reprimidos con una misma especie de pena"],
  ["evicción", "saneamiento responsabilidad por evicción turbación del derecho"],
];

export class Retriever {

  async recuperar(consulta, opciones = {}) {
    const t0 = Date.now();
    const { jurisdiccion = "AR", topK = 20 } = opciones;

    const citas = this._detectarCitas(consulta, jurisdiccion);
    const directos = citas.length ? await this._porId(citas) : [];

    const expandida = this._sinonimos(consulta);
    const lexicos = await this._bm25(expandida, jurisdiccion, topK * 3);

    const mapa = new Map();
    directos.forEach((d, i) => mapa.set(d.id, { ...d, score: 100 - i }));
    lexicos.forEach((d, i) => {
      if (!mapa.has(d.id)) mapa.set(d.id, { ...d, score: 50 - i });
    });

    let docs = [...mapa.values()];
    docs = await this._concordancias(docs, 4);
    docs = await this._constitucional(docs, consulta);
    docs = docs.filter(d => d.estado !== "derogado");

    const factor = RX_CONST.test(consulta) ? 1.6 : 0.35;
    docs.forEach(d => { d.score *= Math.pow(BOOST[d.jerarquia] || 1, factor); });
    docs.sort((a, b) => b.score - a.score);

    return {
      documentos: docs.slice(0, topK),
      citas_explicitas: citas,
      dominio: RX_CONST.test(consulta) ? "constitucional"
             : RX_PENAL.test(consulta) ? "penal" : "general",
      tiempo_ms: Date.now() - t0,
    };
  }

  _detectarCitas(texto, jur) {
    const out = new Set();
    const rx = /art(?:\.|[íi]culo)?\s*(\d+\s*(?:bis|ter|quater)?)\s*(?:d?e?l?\s*(?:la\s+)?)?([A-Za-zÁÉÍÓÚáéíóú.\s]{2,35})?/gi;
    let m;
    while ((m = rx.exec(texto)) !== null) {
      const num = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      const cuerpo = (m[2] || "").trim().toLowerCase()
        .replace(/\./g, "").replace(/\s+/g, " ");
      let sigla = null;
      for (const [k, v] of Object.entries(SIGLAS)) {
        if (cuerpo.startsWith(k)) { sigla = v; break; }
      }
      if (sigla) out.add(`${jur}-${sigla}-art${num}`);
      else ["CCyC","CP","CN"].forEach(s => out.add(`${jur}-${s}-art${num}`));
    }
    return [...out];
  }

  _sinonimos(c) {
    let out = c;
    const low = c.toLowerCase();
    for (const [t, e] of SINONIMOS) if (low.includes(t)) out += " " + e;
    return out;
  }

  async _bm25(consulta, jur, limite) {
    const q = this._fts(consulta);
    if (!q) return [];
    try {
      const filas = await consultar(`
        SELECT n.*, bm25(normas_fts,0,${PESOS}) AS bm
        FROM normas_fts JOIN normas n ON n.id = normas_fts.id
        WHERE normas_fts MATCH ? AND n.jurisdiccion = ?
        ORDER BY bm LIMIT ?`, [q, jur, limite]);
      return filas.map(f => this._doc(f, "bm25"));
    } catch (e) {
      console.error("[bm25]", e.message);
      return [];
    }
  }

  _fts(texto) {
    const frases = [...texto.matchAll(/"([^"]+)"/g)].map(m => `"${m[1]}"`);
    const resto = texto.replace(/"[^"]+"/g, "");
    const toks = [...resto.toLowerCase().matchAll(/[\wáéíóúñü]{4,}/g)]
      .map(m => m[0]).filter(t => !STOP.has(t)).slice(0, 16).map(t => t + "*");
    const p = [...frases, ...toks];
    return p.length ? p.join(" OR ") : "";
  }

  async _porId(ids) {
    if (!ids.length) return [];
    const ph = ids.map(() => "?").join(",");
    const filas = await consultar(
      `SELECT * FROM normas WHERE id IN (${ph})`, ids);
    return filas.map(f => this._doc(f, "cita_directa"));
  }

  async _concordancias(docs, max) {
    const vistos = new Set(docs.map(d => d.id));
    const pedir = [];
    for (const d of docs.slice(0, 3)) {
      for (const c of (d.concordancias || []).slice(0, 3)) {
        const id = `AR-${d.sigla}-art${c}`;
        if (!vistos.has(id)) { pedir.push(id); vistos.add(id); }
      }
    }
    if (!pedir.length) return docs;
    const extra = await this._porId(pedir.slice(0, max));
    extra.forEach(e => { e.via = "concordancia"; e.score = 5; });
    return [...docs, ...extra];
  }

  async _constitucional(docs, consulta) {
    const q = this._fts(consulta);
    if (!q) return docs;
    const vistos = new Set(docs.map(d => d.id));
    try {
      const filas = await consultar(`
        SELECT n.* FROM normas_fts JOIN normas n ON n.id = normas_fts.id
        WHERE normas_fts MATCH ? AND n.jerarquia_normativa = 1
        ORDER BY bm25(normas_fts,0,${PESOS}) LIMIT 10`, [q]);
      const extra = filas
        .filter(f => !vistos.has(f.id))
        .map((f, i) => {
          const d = this._doc(f, "inyeccion_constitucional");
          d.score = 58 - i * 2; return d;
        });
      return [...extra, ...docs];
    } catch { return docs; }
  }

  _doc(f, via) {
    const j = (v, def) => {
      if (!v) return def;
      try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return def; }
    };
    return {
      id: f.id, sigla: f.sigla, cuerpo_legal: f.cuerpo_legal,
      articulo: f.articulo, rubrica: f.rubrica || "", texto: f.texto,
      ubicacion: [f.libro, f.titulo, f.capitulo, f.seccion].filter(Boolean).join(" › "),
      estado: f.estado || "vigente",
      jerarquia: Number(f.jerarquia_normativa) || 3,
      jurisdiccion: f.jurisdiccion,
      vigente_hasta: f.vigente_hasta,
      reformas: j(f.reformas, []),
      concordancias: j(f.concordancias, []),
      fuente_url: f.fuente_url || "",
      via, score: 0,
    };
  }
}
