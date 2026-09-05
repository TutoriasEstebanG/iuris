#!/usr/bin/env python3
"""Ingesta del Codigo Penal de la Nacion (Ley 11.179 T.O. 1984).

Fuente: InfoLeg, encoding ISO-8859-1.
Estructura: Libro -> Titulo -> Capitulo.
El indice tematico ocupa el inicio; el cuerpo arranca en la 2da
aparicion de "LIBRO PRIMERO".
Los encabezados se matchean case-sensitive: el texto de los articulos
contiene referencias en minuscula ("titulo de la tentativa").
"""
import re, json, hashlib, pathlib, argparse
from datetime import datetime
from collections import Counter

import requests
from bs4 import BeautifulSoup

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw" / "cp.html"
OUT = RAIZ / "data" / "output"

CP = {
    "jurisdiccion": "AR",
    "sigla": "CP",
    "cuerpo_legal": "Codigo Penal de la Nacion Argentina",
    "vigente_desde": "1922-04-29",
    "url": ("http://servicios.infoleg.gob.ar/infolegInternet/"
            "anexos/15000-19999/16546/texact.htm"),
    "jerarquia": 3,
    "materia": ["penal"],
}
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; IurisIngesta/1.0; academico)",
           "Accept-Language": "es-AR,es;q=0.9"}

ROM = r"[IVXLCDM]+"
SUF = r"(?:\s+(?:bis|ter|quater|quinquies|sexies|septies))?"

P = {
    "libro": re.compile(r"^LIBRO\s+(PRIMERO|SEGUNDO|TERCERO)$"),
    "titulo": re.compile(rf"^T[IÍ]TULO\s+({ROM})$"),
    "capitulo": re.compile(rf"^CAP[IÍ]TULO\s+({ROM}|\d+)$"),
}
P_ART = re.compile(
    rf"^ART[IÍ]CULO\s+(\d+{SUF})\s*[ºo°]?\s*\.?\s*[-–—]?\s*(.*)$")
P_REF = re.compile(
    r"\(\s*(?:Art[íi]culo|Inciso)?\s*(sustituido|incorporado|derogado|modificado)"
    r"\s+por\s+[^)]*?(Ley|Decreto)\s*N?[°º]?\s*([\d\.]+)[^)]*\)", re.I)

ORDEN = ["libro", "titulo", "capitulo"]


def descargar(forzar=False):
    if RAW.exists() and not forzar:
        print(f"  Usando cache: {RAW}")
        return RAW.read_bytes()
    r = requests.get(CP["url"], headers=HEADERS, timeout=180)
    r.raise_for_status()
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_bytes(r.content)
    print(f"  Descargado: {len(r.content):,} bytes")
    return r.content


def limpiar(contenido):
    for enc in ("iso-8859-1", "utf-8", "windows-1252"):
        try:
            t = contenido.decode(enc)
            if "ARTICULO" in t.upper():
                break
        except UnicodeDecodeError:
            continue
    else:
        t = contenido.decode("utf-8", errors="replace")
    soup = BeautifulSoup(t, "lxml")
    for x in soup(["script", "style", "noscript", "iframe", "img"]):
        x.decompose()
    for x in soup.find_all(["p", "div", "br", "tr", "li"]):
        x.insert_after("\n")
    t = soup.get_text(separator=" ")
    for a, b in [("\u2013", "-"), ("\u2014", "-"), ("\u201c", '"'),
                 ("\u201d", '"'), ("\xa0", " "), ("\u200b", "")]:
        t = t.replace(a, b)
    t = re.sub(r"[ \t]+", " ", t)
    return [l.strip() for l in t.split("\n") if l.strip()]


def acotar(lineas):
    ap = [i for i, l in enumerate(lineas) if l == "LIBRO PRIMERO"]
    if len(ap) < 2:
        raise SystemExit(f"ERROR: esperaba 2 'LIBRO PRIMERO', hay {len(ap)}")
    ini = ap[-1]
    print(f"  Corpus: desde linea {ini} ({len(lineas) - ini} lineas)")
    return lineas[ini:]


# ═══════════════════════════════════════════════════════
#  PARSER
# ═══════════════════════════════════════════════════════

def norm_num(s):
    s = s.strip().lower().replace("\u00b0", "").replace("\u00ba", "")
    return re.sub(r"\s+", "_", s.strip())


def num_base(s):
    m = re.match(r"(\d+)", s.strip())
    return int(m.group(1)) if m else 0


class ParserCP:
    def __init__(self):
        self.ctx = {k: "" for k in ORDEN}
        self.arts = []
        self._pend = None

    def _nivel(self, nivel, rot):
        self.ctx[nivel] = rot.strip()
        for inf in ORDEN[ORDEN.index(nivel) + 1:]:
            self.ctx[inf] = ""

    def _guardar(self, clave, buf, ctx):
        texto = re.sub(r"\s{2,}", " ", " ".join(buf).strip())
        if len(texto) < 12:
            return
        refs = []
        for m in P_REF.finditer(texto):
            refs.append({"accion": m.group(1).lower(),
                         "norma": f"{m.group(2)} {m.group(3)}"})
        derogado = bool(re.match(r"^\(?\s*art[íi]culo\s+derogado", texto, re.I)) \
            or texto.lower().startswith("(derogado")
        nn = norm_num(clave)
        aid = f"AR-CP-art{nn}"
        if any(a["id"] == aid for a in self.arts):
            return
        self.arts.append({
            "id": aid,
            "tipo": "normativo",
            "jurisdiccion": CP["jurisdiccion"],
            "cuerpo_legal": CP["cuerpo_legal"],
            "sigla": CP["sigla"],
            "libro": ctx["libro"],
            "titulo": ctx["titulo"],
            "capitulo": ctx["capitulo"],
            "seccion": "",
            "articulo": clave.strip(),
            "articulo_num": num_base(clave),
            "rubrica": "",
            "texto": texto,
            "vigente_desde": CP["vigente_desde"],
            "vigente_hasta": None,
            "estado": "derogado" if derogado else ("reformado" if refs else "vigente"),
            "jerarquia_normativa": CP["jerarquia"],
            "reformas": json.dumps(refs, ensure_ascii=False),
            "concordancias": "[]",
            "materia": json.dumps(CP["materia"], ensure_ascii=False),
            "fuente_url": CP["url"],
            "hash_verif": "sha256:" + hashlib.sha256(texto.encode()).hexdigest()[:20],
            "fecha_ingesta": datetime.now().isoformat(),
        })

    def parsear(self, lineas):
        clave, buf, ctx0 = None, [], dict(self.ctx)
        for l in lineas:
            det = None
            for niv in ORDEN:
                if P[niv].match(l):
                    det = niv
                    break
            if det:
                self._nivel(det, l)
                self._pend = det
                continue

            # el rotulo viene en la linea siguiente al encabezado
            if self._pend:
                niv, self._pend = self._pend, None
                if not P_ART.match(l) and len(l) < 90 and l == l.upper():
                    self.ctx[niv] = f"{self.ctx[niv]} - {l}"
                    continue

            m = P_ART.match(l)
            if m:
                if clave:
                    self._guardar(clave, buf, ctx0)
                clave = m.group(1)
                ctx0 = dict(self.ctx)
                buf = [m.group(2).strip()] if m.group(2).strip() else []
                continue

            if clave:
                buf.append(l)

        if clave:
            self._guardar(clave, buf, ctx0)
        self.arts.sort(key=lambda a: (a["articulo_num"], a["articulo"]))
        return self.arts


# ═══════════════════════════════════════════════════════
#  VALIDACION
# ═══════════════════════════════════════════════════════

def validar(arts):
    nums = sorted({a["articulo_num"] for a in arts})
    mx = max(nums) if nums else 0
    faltan = sorted(set(range(1, mx + 1)) - set(nums))
    ids = [a["id"] for a in arts]
    dups = sorted(i for i, c in Counter(ids).items() if c > 1)
    sin_libro = [a["id"] for a in arts if not a["libro"]]
    sin_titulo = [a["id"] for a in arts if not a["titulo"]]
    cortos = [a["id"] for a in arts if len(a["texto"]) < 40]
    bis = [a["articulo"] for a in arts if not a["articulo"].isdigit()]
    derog = [a["id"] for a in arts if a["estado"] == "derogado"]

    print()
    print("=" * 62)
    print("  VALIDACION CP")
    print("=" * 62)
    print(f"  Articulos             {len(arts):>6}")
    print(f"  Numero maximo         {mx:>6}")
    print(f"  Faltantes             {len(faltan):>6}  {faltan[:12]}")
    print(f"  Duplicados (id)       {len(dups):>6}  {dups[:5]}")
    print(f"  Con sufijo (bis/ter)  {len(bis):>6}  {bis[:8]}")
    print(f"  Derogados             {len(derog):>6}")
    print(f"  Sin libro             {len(sin_libro):>6}")
    print(f"  Sin titulo            {len(sin_titulo):>6}")
    print(f"  Textos < 40 chars     {len(cortos):>6}  {cortos[:5]}")
    print()

    err = []
    if dups:
        err.append(f"ids duplicados: {dups[:5]}")
    if sin_libro:
        err.append(f"{len(sin_libro)} sin libro")
    if len(faltan) > 12:
        err.append(f"{len(faltan)} faltantes")
    if cortos:
        err.append(f"{len(cortos)} textos sospechosamente cortos")

    if err:
        print("  RESULTADO: NO APTO")
        for e in err:
            print(f"    - {e}")
    else:
        print("  RESULTADO: APTO PARA CARGA")
        if faltan:
            print(f"    (faltantes {faltan} — verificar si son derogaciones)")
    print("=" * 62)
    return not err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--forzar-descarga", action="store_true")
    ap.add_argument("--solo-validar", action="store_true")
    a = ap.parse_args()

    print("=" * 62)
    print("  INGESTA DEL CODIGO PENAL")
    print("=" * 62)
    print("\n[1/4] Descarga")
    crudo = descargar(a.forzar_descarga)
    print("\n[2/4] Limpieza")
    lineas = acotar(limpiar(crudo))
    print("\n[3/4] Parseo")
    arts = ParserCP().parsear(lineas)
    print(f"  {len(arts)} articulos")
    print("\n[4/4] Validacion")
    ok = validar(arts)

    OUT.mkdir(parents=True, exist_ok=True)
    destino = OUT / "cp.json"
    destino.write_text(json.dumps(arts, ensure_ascii=False, indent=1),
                       encoding="utf-8")
    print(f"\n  Volcado: {destino}")
    if not ok:
        print("  (revisar antes de cargar)")
        return
    if a.solo_validar:
        print("\n  Solo validacion (--solo-validar)")
        return
    print("\n[Carga en SQLite]")
    from main import cargar
    cargar(arts, sigla="CP", materia="penal")


if __name__ == "__main__":
    main()
