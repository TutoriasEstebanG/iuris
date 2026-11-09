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

const FALLOS_CLAVE = {
  siri: "CSJN-Fallos-239-459",
  kot: "CSJN-Fallos-241-291",
  arriola: "CSJN-Fallos-332-1963",
  halabi: "CSJN-Fallos-332-111",
  aquino: "CSJN-Fallos-327-3753",
  madorran: "CSJN-Fallos-330-1989",
  "rodriguez pereyra": "CSJN-Fallos-335-2333",
  albarracini: "CSJN-Fallos-335-792",
  mendoza: "CSJN-Fallos-331-1622",
  sejean: "CSJN-Fallos-308-2268",
};

const STOP = new Set(["que","los","las","por","para","con","una","del",
  "sobre","cual","cuando","como","donde","puede","debe","este","esta"]);

function obtenerPesosBM25() {
  const p = (process.env.BM25_PESOS || "0.5,1.0,6.0,2.0,0.5").trim();
  return /^(\d+(\.\d+)?,){4}\d+(\.\d+)?$/.test(p) ? p : "0.5,1.0,6.0,2.0,0.5";
}

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

    const fallos = await this._jurisprudencia(consulta, 4, docs);

    return {
      documentos: docs.slice(0, topK),
      jurisprudencia: fallos,
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
    const pesos = obtenerPesosBM25();
    try {
      const filas = await consultar(`
        SELECT n.*, bm25(normas_fts,0,${pesos}) AS bm
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
    if (!texto || typeof texto !== "string") return "";
    const frases = [...texto.matchAll(/"([^"]+)"/g)]
      .map(m => m[1].replace(/[^\w\sáéíóúñü]/gi, " ").trim())
      .filter(Boolean)
      .map(f => `"${f}"`);
    const resto = texto.replace(/"[^"]+"/g, " ").replace(/[^\w\sáéíóúñü]/gi, " ");
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
    const pesos = obtenerPesosBM25();
    try {
      const filas = await consultar(`
        SELECT n.* FROM normas_fts JOIN normas n ON n.id = normas_fts.id
        WHERE normas_fts MATCH ? AND n.jerarquia_normativa = 1
        ORDER BY bm25(normas_fts,0,${pesos}) LIMIT 10`, [q]);
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

  async _jurisprudencia(consulta, limite = 4, docsNormas = []) {
    const mapa = new Map();
    const low = consulta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Detección directa por palabras clave de autos
    const directos = [];
    for (const [clave, id] of Object.entries(FALLOS_CLAVE)) {
      if (low.includes(clave)) directos.push(id);
    }
    if (directos.length) {
      const ph = directos.map(() => "?").join(",");
      try {
        const filas = await consultar(`SELECT * FROM jurisprudencia WHERE id IN (${ph})`, directos);
        filas.forEach((f, i) => mapa.set(f.id, { ...this._falloDoc(f, "cita_directa"), score: 100 - i }));
      } catch (e) {
        console.error("[jurisprudencia directos]", e.message);
      }
    }

    // 2. Búsqueda léxica FTS5
    const q = this._fts(consulta);
    if (q) {
      try {
        const filas = await consultar(`
          SELECT j.*, bm25(jurisprudencia_fts,0,2.0,2.0,5.0,3.0,1.5,1.0) AS bm
          FROM jurisprudencia_fts JOIN jurisprudencia j ON j.id = jurisprudencia_fts.id
          WHERE jurisprudencia_fts MATCH ? AND j.estado != 'derogado'
          ORDER BY bm LIMIT ?`, [q, limite * 2]);
        filas.forEach((f, i) => {
          if (!mapa.has(f.id)) mapa.set(f.id, { ...this._falloDoc(f, "fts"), score: 50 - i });
        });
      } catch (e) {}
    }

    // 3. Vinculación con normas recuperadas
    if (mapa.size < limite && docsNormas.length) {
      const idsNormas = docsNormas.slice(0, 4).map(d => d.id);
      try {
        const todas = await consultar("SELECT * FROM jurisprudencia WHERE estado != 'derogado'");
        for (const f of todas) {
          if (mapa.has(f.id)) continue;
          let citas = [];
          try { citas = typeof f.citas_normativas === "string" ? JSON.parse(f.citas_normativas) : (f.citas_normativas || []); } catch {}
          const coincide = citas.some(c => idsNormas.includes(c));
          if (coincide) {
            mapa.set(f.id, { ...this._falloDoc(f, "vinculo_normativo"), score: 30 });
            if (mapa.size >= limite * 2) break;
          }
        }
      } catch (e) {}
    }

    const fallos = [...mapa.values()];
    fallos.sort((a, b) => b.score - a.score);
    return fallos.slice(0, limite);
  }

  _falloDoc(f, via) {
    const j = (v, def) => {
      if (!v) return def;
      try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return def; }
    };
    return {
      id: f.id,
      tribunal: f.tribunal,
      autos: f.autos,
      fecha: f.fecha,
      tomo: f.tomo,
      pagina: f.pagina,
      cita_fallos: f.tomo && f.pagina ? `Fallos ${f.tomo}:${f.pagina}` : "",
      holding: f.holding,
      sumario: f.sumario,
      hechos: f.hechos || "",
      citas_normativas: j(f.citas_normativas, []),
      precedentes: j(f.precedentes, []),
      materia: j(f.materia, []),
      estado: f.estado || "vigente",
      fuente_url: f.fuente_url || "",
      via,
      score: 0,
    };
  }
}
