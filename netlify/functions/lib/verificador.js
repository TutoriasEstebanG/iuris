/**
 * Iuris — Verificacion anti-alucinacion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Leyes que SI estan en el corpus (numero -> sigla)
const LEYES_CORPUS = {
  "26994": "CCyC",
  "24430": "CN",
};

export class VerificadorCitas {
  constructor(documentos = []) {
    this.fuentes = new Map();
    this.siglas = new Set();
    const textos = [];
    for (const d of documentos) {
      const k = `${d.sigla}:${d.articulo}`.toUpperCase().replace(/\s+/g, "");
      this.fuentes.set(k, d);
      this.siglas.add(String(d.sigla || "").toUpperCase());
      if (d.texto) textos.push(d.texto);
    }
    // texto plano de las fuentes, para saber si una ley fue MENCIONADA en ellas
    this.corpusTexto = textos.join(" ").replace(/\./g, "");
  }

  verificar(respuesta) {
    const citas = this._citas(respuesta);
    const textuales = this._textuales(respuesta);
    const leyes = this._leyes(respuesta);
    const inf = {
      citas_totales: citas.length,
      verificadas: [], no_verificadas: [],
      textos_alterados: [],
      leyes_ausentes: [], leyes_mencionadas: [],
      nivel_riesgo: "bajo",
    };

    for (const c of citas) {
      const k = `${c.sigla}:${c.articulo}`.toUpperCase().replace(/\s+/g, "");
      (this.fuentes.has(k) ? inf.verificadas : inf.no_verificadas).push(c);
    }

    for (const t of textuales) {
      const ok = [...this.fuentes.values()]
        .some(f => this._sim(f.texto, t) > 0.90);
      if (!ok) inf.textos_alterados.push(t.slice(0, 120));
    }

    for (const l of leyes) {
      if (LEYES_CORPUS[l.num]) continue;              // es el CCyC o la CN
      if (this.corpusTexto.includes(l.num))
        inf.leyes_mencionadas.push(l.etiqueta);       // la nombra una fuente
      else
        inf.leyes_ausentes.push(l.etiqueta);          // sin respaldo alguno
    }
    inf.leyes_ausentes = [...new Set(inf.leyes_ausentes)];
    inf.leyes_mencionadas = [...new Set(inf.leyes_mencionadas)];

    if (inf.textos_alterados.length) inf.nivel_riesgo = "alto";
    else if (inf.no_verificadas.length || inf.leyes_ausentes.length)
      inf.nivel_riesgo = "medio";
    return inf;
  }

  _citas(t) {
    const rx = /\b[Aa]rt(?:\.|ículo)?\s*(\d+(?:\s*(?:bis|ter|quater))?)\s*([A-Z][A-Za-z]{1,6})\b/g;
    const out = []; let m;
    while ((m = rx.exec(t)) !== null)
      out.push({ articulo: m[1].trim(), sigla: m[2] });
    return out;
  }

  _leyes(t) {
    const out = [];
    // 1) numeracion argentina con punto de millar: 11.xxx a 27.xxx
    //    (los articulos del CCyC no usan punto, asi que no colisionan)
    const rxNum = /\b(1[1-9]|2[0-7])\.(\d{3})\b/g;
    // descarta importes: "$ 15.000", "15.000 pesos", "suma de 15.000"
    const MONEDA = /(pesos|d[óo]lares|salarios|m[óo]dulos|UMA|JUS|%)/i;
    const PREVIO = /([$€]|importe|monto|suma|valor|cifra|total|abonar|pagar|percibir)(?:\s+(?:de|por|en|a))?\s*(?:\$\s*)?$/i;
    let m;
    while ((m = rxNum.exec(t)) !== null) {
      const antes = t.slice(Math.max(0, m.index - 18), m.index);
      const desp = t.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (PREVIO.test(antes) || MONEDA.test(desp)) continue;
      out.push({ num: m[1] + m[2], etiqueta: `Ley ${m[1]}.${m[2]}` });
    }
    // 2) forma explicita "ley N 1234" sin punto
    const rxLey = /\bley(?:es)?\s*(?:n[.°ºo]*\s*)?(\d{4,5})\b/gi;
    while ((m = rxLey.exec(t)) !== null) {
      const d = m[1];
      const et = d.length === 5 ? `Ley ${d.slice(0,2)}.${d.slice(2)}`
                                : `Ley ${d.slice(0,1)}.${d.slice(1)}`;
      out.push({ num: d, etiqueta: et });
    }
    return out;
  }

  _textuales(t) {
    return [...t.matchAll(/«([^»]{40,})»/g)].map(m => m[1]);
  }

  _sim(a, b) {
    const n = s => s.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ").trim();
    const A = new Set(n(a).split(" ")), B = new Set(n(b).split(" "));
    if (!B.size) return 0;
    let i = 0; for (const w of B) if (A.has(w)) i++;
    return i / B.size;
  }

  generarAdvertencia(inf) {
    if (inf.nivel_riesgo === "bajo") return null;
    let msg = "";
    if (inf.textos_alterados.length)
      msg += `⛔ **${inf.textos_alterados.length} cita(s) textual(es) no ` +
             `coinciden con el corpus.** No las uses sin verificar.\n\n`;
    if (inf.no_verificadas.length)
      msg += `⚠ **Sin respaldo en el corpus:** ` +
             inf.no_verificadas.map(c => `art. ${c.articulo} ${c.sigla}`).join(", ") +
             `. Verifica antes de citarlas.\n\n`;
    if (inf.leyes_ausentes.length)
      msg += `📕 **Leyes citadas que NO estan en el corpus:** ` +
             inf.leyes_ausentes.join(", ") +
             `. El sistema no pudo verificar su numero, vigencia ni contenido. ` +
             `Consulta el texto oficial.\n\n`;
    if (inf.leyes_mencionadas.length)
      msg += `ℹ Leyes referidas por las fuentes pero sin texto cargado: ` +
             inf.leyes_mencionadas.join(", ") + `.`;
    return { nivel: inf.nivel_riesgo, mensaje: msg.trim() };
  }
}
