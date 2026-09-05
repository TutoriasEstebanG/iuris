#!/usr/bin/env python3
"""Banco de pruebas del retrieval. Mide si los articulos esperados entran."""
import sqlite3, pathlib, sys

DB = pathlib.Path(__file__).resolve().parent.parent / "data" / "output" / "iuris.db"

# consulta -> ids que DEBERIAN aparecer
CASOS = [
    ("proteccion del derecho de propiedad",
     ["AR-CN-art17", "AR-CCyC-art1941", "AR-CCyC-art2252"]),
    ("regimen de defensa del consumidor",
     ["AR-CN-art42", "AR-CCyC-art1092", "AR-CCyC-art1094"]),
    ("responsabilidad por riesgo de la cosa",
     ["AR-CCyC-art1757", "AR-CCyC-art1758"]),
    ("nulidad absoluta del acto juridico",
     ["AR-CCyC-art386", "AR-CCyC-art387"]),
    ("derecho a un ambiente sano",
     ["AR-CN-art41", "AR-CCyC-art1973"]),
    ("proteccion de la vivienda familiar",
     ["AR-CCyC-art244", "AR-CCyC-art245"]),
    ("libertad de expresion y censura previa",
     ["AR-CN-art14", "AR-CN-art32"]),
    ("plazo de prescripcion liberatoria",
     ["AR-CCyC-art2560", "AR-CCyC-art2562"]),
]

STOP = set("""que como para por con los las del una the sobre entre cual
cuales cuando donde quien segun este esta estos estas ante""".split())

def fts(texto):
    toks = [t for t in texto.lower().split() if len(t) >= 4 and t not in STOP]
    return " OR ".join(t + "*" for t in toks[:16])

def probar(topk=8, extra_stop=()):
    st = STOP | set(extra_stop)
    con = sqlite3.connect(DB)
    total = aciertos = 0
    for consulta, esperados in CASOS:
        toks = [t for t in consulta.lower().split() if len(t) >= 4 and t not in st]
        q = " OR ".join(t + "*" for t in toks[:16])
        filas = con.execute(
            "SELECT n.id FROM normas_fts JOIN normas n ON n.id=normas_fts.id "
            "WHERE normas_fts MATCH ? "
            "ORDER BY bm25(normas_fts,0,2.0,1.5,3.0,4.0,1.0) LIMIT ?",
            (q, topk)).fetchall()
        got = {f[0] for f in filas}
        hit = [e for e in esperados if e in got]
        total += len(esperados); aciertos += len(hit)
        estado = "OK " if len(hit) == len(esperados) else "-- "
        print(f"  {estado} {consulta[:44]:<46} {len(hit)}/{len(esperados)}")
        faltan = [e for e in esperados if e not in got]
        if faltan:
            print(f"       faltan: {faltan}")
    con.close()
    print(f"\n  TOTAL: {aciertos}/{total} ({aciertos/total:.0%})")
    return aciertos / total

print("=== topK=8, stopwords base ===")
probar(8)
print("\n=== topK=8, + stopwords genericas ===")
GEN = ["proteccion", "derecho", "derechos", "regimen", "concepto",
       "aplicacion", "general", "generales"]
probar(8, GEN)
print("\n=== topK=15, + stopwords genericas ===")
probar(15, GEN)
