#!/usr/bin/env python3
"""Compara el JSON nuevo contra el anterior y reporta cambios."""
import json, pathlib, sys, shutil
from datetime import datetime

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "output"

def cargar(p):
    return {a["id"]: a for a in json.loads(p.read_text(encoding="utf-8"))}

def main(nombre):
    nuevo_p = OUT / f"{nombre}.json"
    prev_p = OUT / f"{nombre}.anterior.json"
    if not prev_p.exists():
        shutil.copy(nuevo_p, prev_p)
        print("Sin version anterior. Guardada como linea de base.")
        return
    prev, nuevo = cargar(prev_p), cargar(nuevo_p)
    altas = sorted(set(nuevo) - set(prev))
    bajas = sorted(set(prev) - set(nuevo))
    cambios = [k for k in set(prev) & set(nuevo)
               if prev[k]["hash_verif"] != nuevo[k]["hash_verif"]]
    print(f"\n=== DIFF {nombre} — {datetime.now():%Y-%m-%d %H:%M} ===")
    print(f"  altas   : {len(altas)}  {altas[:8]}")
    print(f"  bajas   : {len(bajas)}  {bajas[:8]}")
    print(f"  cambios : {len(cambios)}")
    for k in cambios[:20]:
        print(f"\n  --- {k} ---")
        print(f"  estado: {prev[k]['estado']} -> {nuevo[k]['estado']}")
        print(f"  ANTES: {prev[k]['texto'][:150]}")
        print(f"  AHORA: {nuevo[k]['texto'][:150]}")
    if altas or bajas or cambios:
        print(f"\n  Revisar antes de aceptar. Para fijar la nueva linea de base:")
        print(f"    cp {nuevo_p} {prev_p}")

main(sys.argv[1] if len(sys.argv) > 1 else "articulos")
