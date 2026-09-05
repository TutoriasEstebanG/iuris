#!/usr/bin/env python3
"""Regenera lib/cobertura.js segun lo que hay realmente en la base."""
import sqlite3, pathlib, json

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DB = RAIZ / "data" / "output" / "iuris.db"
DEST = RAIZ / "netlify" / "functions" / "lib" / "cobertura_datos.js"

# rama -> (siglas que la cubren, regex, norma de referencia)
RAMAS = {
    "laboral": (["LCT", "LAS", "LRT"],
        r"\b(trabajador(?:es|a)?|laboral(?:es)?|despido|salario|sindical|sindicato|huelga|jornada laboral|LCT|20\.?744|convenio colectivo|obra social|riesgos del trabajo|aguinaldo)\b",
        "Ley de Contrato de Trabajo 20.744 y complementarias"),
    "penal": (["CP"],
        r"\b(delito|delictiv|tipo penal|imputad|querella|excarcelaci[oó]n|prisi[oó]n preventiva|c[oó]digo penal|culpabilidad|pena privativa|dolo eventual|culpa consciente|tentativa|leg[ií]tima defensa|imputabilidad|tipicidad|antijuridicidad|homicidio|hurto|robo|estafa|sobreseimiento|proces(?:ad|amiento))\b",
        "Codigo Penal (Ley 11.179)"),
    "procesal": (["CPCCN", "CPCCBA", "CPPF", "CPPN"],
        r"\b(c[oó]digo procesal|CPCC|CPPF|CPCCN|contestar\s+(?:la\s+)?demanda|traslado de (?:la )?demanda|excepci(?:on|ón|ones) previa|recurso de (?:apelaci[oó]n|casaci[oó]n|queja)|caducidad de instancia|alegato|c[eé]dula de notificaci[oó]n|rebeld[ií]a|medida cautelar|embargo preventivo|plazo procesal|traba de la litis)\b",
        "codigos procesales segun jurisdiccion"),
    "administrativo": (["LNPA"],
        r"\b(acto administrativo|procedimiento administrativo|19\.?549|recurso jer[aá]rquico|contencioso administrativo)\b",
        "Ley 19.549 y normas locales"),
    "tributario": (["LPT"],
        r"\b(tributari|impuesto a las ganancias|IVA|AFIP|ARCA|determinaci[oó]n de oficio|11\.?683)\b",
        "Ley 11.683 y leyes impositivas"),
}

con = sqlite3.connect(DB)
presentes = {r[0] for r in con.execute("SELECT DISTINCT sigla FROM normas")}
leyes = {}
for sig, cl in con.execute("SELECT DISTINCT sigla, cuerpo_legal FROM normas"):
    leyes[sig] = cl
con.close()

ausentes = {}
for rama, (siglas, rx, norma) in RAMAS.items():
    if any(s in presentes for s in siglas):
        continue
    ausentes[rama] = {"rx": rx, "norma": norma}

js = f"""// GENERADO POR ingesta/generar_cobertura.py — NO EDITAR A MANO
// Regenerar tras cada ingesta:  python3 ingesta/generar_cobertura.py
export const SIGLAS_EN_CORPUS = {json.dumps(sorted(presentes), ensure_ascii=False)};
export const CUERPOS = {json.dumps(leyes, ensure_ascii=False, indent=2)};
export const AUSENTES_DATOS = {json.dumps(ausentes, ensure_ascii=False, indent=2)};
"""
DEST.write_text(js, encoding="utf-8")
print(f"Generado {DEST}")
print(f"  en corpus : {sorted(presentes)}")
print(f"  ausentes  : {sorted(ausentes)}")
