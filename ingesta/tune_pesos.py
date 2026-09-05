#!/usr/bin/env python3
"""Busca los pesos bm25 que mejor rankean los articulos esperados."""
import sqlite3, pathlib

DB = pathlib.Path(__file__).resolve().parent.parent / "data" / "output" / "iuris.db"
STOP = {"que","los","las","por","para","con","una","del","sobre","cual",
        "cuando","como","donde","puede","debe","este","esta"}

CASOS = [
    ("capacidad restringida e inhabilitados", ["AR-CCyC-art32", "AR-CCyC-art48"]),
    ("obligacion de saneamiento eviccion", ["AR-CCyC-art1033", "AR-CCyC-art1044"]),
    ("concurso ideal y concurso real de delitos", ["AR-CP-art54", "AR-CP-art55"]),
    ("plazo de prescripcion liberatoria", ["AR-CCyC-art2560", "AR-CCyC-art2562"]),
    ("teoria de la imprevision", ["AR-CCyC-art1091"]),
    ("boleto de compraventa", ["AR-CCyC-art1170"]),
    ("vicios de los actos juridicos lesion", ["AR-CCyC-art332"]),
    ("simulacion y fraude", ["AR-CCyC-art333", "AR-CCyC-art338"]),
    ("tentativa y desistimiento voluntario", ["AR-CP-art42", "AR-CP-art43"]),
    ("nulidad absoluta del acto juridico", ["AR-CCyC-art386", "AR-CCyC-art387"]),
]

# (cuerpo, ubicacion, rubrica, texto, materia)
COMBOS = [
    (2.0, 1.5, 3.0, 4.0, 1.0),    # actual
    (1.0, 1.0, 6.0, 2.0, 0.5),
    (0.5, 1.0, 10.0, 1.0, 0.5),
    (0.5, 0.5, 15.0, 1.0, 0.5),
    (1.0, 1.0, 8.0, 3.0, 0.5),
    (0.5, 1.0, 20.0, 1.0, 0.5),
]

con = sqlite3.connect(DB)
for pesos in COMBOS:
    w = ",".join(str(x) for x in pesos)
    ranks, en20 = [], 0
    total = 0
    for consulta, esp in CASOS:
        toks = [t for t in consulta.lower().split() if len(t) >= 4 and t not in STOP]
        q = " OR ".join(t + "*" for t in toks[:16])
        filas = con.execute(f"""
            SELECT n.id, row_number() OVER (ORDER BY bm25(normas_fts,0,{w})) rn
            FROM normas_fts JOIN normas n ON n.id=normas_fts.id
            WHERE normas_fts MATCH ?""", (q,)).fetchall()
        pos = {i: r for i, r in filas}
        for e in esp:
            total += 1
            r = pos.get(e)
            if r:
                ranks.append(r)
                if r <= 20:
                    en20 += 1
            else:
                ranks.append(999)
    med = sum(ranks) / len(ranks)
    print(f"  rub={pesos[2]:>5} txt={pesos[3]:>4}  en_top20={en20:>2}/{total}  rank_medio={med:>6.1f}")
con.close()
