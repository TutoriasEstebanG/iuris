#!/usr/bin/env python3
"""
Iuris — Ingesta de Fallos Cardinales de Jurisprudencia (CSJN)
SPDX-License-Identifier: AGPL-3.0-or-later

Uso:
    python ingesta_jurisprudencia.py --solo-validar
    python ingesta_jurisprudencia.py
"""
import json
import sqlite3
import hashlib
import argparse
import pathlib
from datetime import datetime

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / "data" / "output"
DB = OUT / "iuris.db"

FALLOS_CARDINALES = [
    {
        "id": "CSJN-Fallos-239-459",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Siri, Angel s/ recurso de habeas corpus",
        "fecha": "1957-12-27",
        "tomo": 239,
        "pagina": 459,
        "holding": "Las garantias individuales existen y protegen a los habitantes por el solo hecho de estar consagradas en la Constitucion, independientemente de las leyes reglamentarias. La inexistencia de una ley procesal especifica no puede desproteger garantias fundamentales cuando media violacion manifiesta por autoridad publica, naciendo la accion de amparo.",
        "sumario": "Accion de amparo. Clausura policial ilegitima de un periodico sin orden judicial. Procedencia de la via sumaria para tutelar garantias constitucionales esenciales aun sin reglamentacion procesal legislativa previa.",
        "hechos": "Angel Siri, director del diario 'Mercedes', sufrio la clausura de su imprenta y custodia policial en el local sin orden de autoridad judicial o administrativa competente. Tras agotar recursos ordinarios sin exito, dedujo recurso ante la justicia que inicialmente fue rechazado por no adecuarse al habeas corpus tipico.",
        "votos": ["Unanimidad: Oyhanarte, Arauz Castex, Argañarás, Boffi Boggero"],
        "citas_normativas": ["AR-CN-art14", "AR-CN-art17", "AR-CN-art18", "AR-CN-art33"],
        "precedentes": [],
        "materia": ["constitucional", "procesal", "amparo", "libertad de expresion"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=16301"
    },
    {
        "id": "CSJN-Fallos-241-291",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Kot, Samuel SRL s/ recurso de amparo",
        "fecha": "1958-09-05",
        "tomo": 241,
        "pagina": 291,
        "holding": "La accion de amparo procede no solo contra actos de autoridad publica sino tambien contra actos u omisiones manifiestamente ilegitimos de particulares que lesionen en forma palmaria libertades y garantias constitucionales.",
        "sumario": "Amparo contra particulares. Toma de establecimiento fabril por obreros en huelga. Inoperancia de vias ordinarias y necesidad de tutela judicial urgente y expedita.",
        "hechos": "La fabrica textil de Samuel Kot SRL fue ocupada por personal en huelga por conflicto laboral. La empresa intento la via penal por usurpacion que fue desestimada, tras lo cual interpuso amparo solicitando el desalojo y restitucion del inmueble frente a la violacion del derecho de propiedad y de trabajar.",
        "votos": ["Mayoria: Villegas Basavilbaso, Argañarás, Oyhanarte, Boffi Boggero"],
        "citas_normativas": ["AR-CN-art14", "AR-CN-art17", "AR-CN-art18"],
        "precedentes": ["CSJN-Fallos-239-459"],
        "materia": ["constitucional", "procesal", "amparo", "propiedad"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=16428"
    },
    {
        "id": "CSJN-Fallos-332-1963",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Arriola, Sebastian y otros s/ causa N° 9080",
        "fecha": "2009-08-25",
        "tomo": 332,
        "pagina": 1963,
        "holding": "El articulo 19 de la Constitucion Nacional prohibe penalizar la tenencia de estupefacientes para consumo personal cuando se realiza en condiciones que no traen peligro ni dano concreto a terceros, consagrando un ambito de privacidad inmune a la interferencia estatal paternalista.",
        "sumario": "Inconstitucionalidad del art. 14 segundo parrafo de la Ley 23.737. Despenalizacion de la tenencia para consumo personal en el ambito privado. Reafirmacion del principio de reserva y autonomia personal.",
        "hechos": "Varios jovenes fueron detenidos en la via publica portando escasa cantidad de marihuana (entre 1 y 3 cigarrillos) para consumo personal, sin haber exteriorizado ostentacion ni comercializacion a terceros.",
        "votos": ["Lorenzetti", "Highton de Nolasco", "Fayt", "Petracchi", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art19", "AR-CN-art18", "AR-CN-art75"],
        "precedentes": ["CSJN-Fallos-308-1392 (Bazterrica - retoma)", "CSJN-Fallos-313-1333 (Montalvo - superado/overruled)"],
        "materia": ["penal", "constitucional", "privacidad", "estupefacientes"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=6683833"
    },
    {
        "id": "CSJN-Fallos-332-111",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Halabi, Ernesto c/ P.E.N. - ley 25.873 - dto. 1563/04 s/ amparo",
        "fecha": "2009-02-24",
        "tomo": 332,
        "pagina": 111,
        "holding": "Se reconocen pretorianamente las acciones de clase en el derecho argentino para la tutela de derechos de incidencia colectiva referentes a intereses individuales homogeneos, con efectos erga omnes, ante la concurrencia de un hecho unico causal y una afectacion comun.",
        "sumario": "Acciones de clase. Derechos de incidencia colectiva sobre intereses individuales homogeneos. Inconstitucionalidad de la captacion de comunicaciones telefónicas e internet sin orden judicial (Ley 25.873). Efecto expansivo erga omnes de la sentencia.",
        "hechos": "El abogado Ernesto Halabi dedujo amparo cuestionando la ley que obligaba a las empresas de telecomunicaciones a registrar y conservar las comunicaciones de los usuarios a disposicion del Ministerio Publico sin intervencion judicial previa, invocando la violacion de su privacidad y el secreto profesional.",
        "votos": ["Lorenzetti", "Highton de Nolasco", "Fayt", "Petracchi", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art18", "AR-CN-art19", "AR-CN-art43"],
        "precedentes": ["CSJN-Fallos-239-459", "CSJN-Fallos-241-291"],
        "materia": ["constitucional", "procesal", "amparo colectivo", "acciones de clase", "privacidad"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=6626490"
    },
    {
        "id": "CSJN-Fallos-327-3753",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Aquino, Isacio c/ Cargo Servicios Industriales S.A. s/ accidentes",
        "fecha": "2004-09-21",
        "tomo": 327,
        "pagina": 3753,
        "holding": "Es inconstitucional el articulo 39 inciso 1 de la Ley de Riesgos del Trabajo 24.557 en cuanto exime al empleador de responsabilidad civil mediante una indemnizacion tarifada que no repara integralmente el dano a la integridad psicofisica del trabajador.",
        "sumario": "Riesgos del trabajo. Reparacion integral del dano civil. Inconstitucionalidad de la exencion de responsabilidad civil del empleador. Principio protectorio y principio alterum non laedere.",
        "hechos": "Un trabajador sufrio un accidente grave por caida desde 10 metros de altura que le provoco una incapacidad total y permanente del 100%. La ley de riesgos limitaba el cobro a una tarifa fija, impidiendole demandar por el derecho comun de danos.",
        "votos": ["Petracchi", "Belluscio", "Boggiano", "Fayt", "Zaffaroni", "Highton de Nolasco", "Maqueda"],
        "citas_normativas": ["AR-CN-art14_bis", "AR-CN-art19", "AR-CCyC-art1716", "AR-CCyC-art1740"],
        "precedentes": [],
        "materia": ["laboral", "civil", "danos", "constitucional"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=6121408"
    },
    {
        "id": "CSJN-Fallos-330-1989",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Madorran, Marta Cristina c/ Administracion Nacional de Aduanas s/ reincorporacion",
        "fecha": "2007-05-03",
        "tomo": 330,
        "pagina": 1989,
        "holding": "La garantia constitucional de estabilidad propia consagrada en el articulo 14 bis de la Constitucion Nacional para el empleado publico veda el despido sin causa justificada y confiere el derecho a la reincorporacion efectiva ante la cesantia ilegitima.",
        "sumario": "Empleo publico. Estabilidad propia constitucional. Invalidez del despido incausado con mera indemnizacion monetaria en la funcion publica. Reincorporacion y salarios caidos.",
        "hechos": "Marta Madorran, empleada de la Aduana bajo convenio colectivo de trabajo, fue despedida sin invocacion de causa pagandosele indemnizacion. Reclamo judicialmente la nulidad del despido y su reincorporacion al cargo amparada en el art. 14 bis CN.",
        "votos": ["Petracchi", "Highton de Nolasco", "Fayt", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art14_bis", "AR-CN-art16"],
        "precedentes": [],
        "materia": ["laboral", "administrativo", "constitucional", "estabilidad publica"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=6409867"
    },
    {
        "id": "CSJN-Fallos-335-2333",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Rodriguez Pereyra, Jorge Luis y otra c/ Ejercito Argentino s/ danios y perjuicios",
        "fecha": "2012-11-27",
        "tomo": 335,
        "pagina": 2333,
        "holding": "Los jueces de cualquier instancia y fuero estan facultados y obligados a ejercer el control de constitucionalidad y convencionalidad de oficio de las leyes aplicables al litigio, sin necesidad de peticion expresa de parte, resguardando la supremacia constitucional.",
        "sumario": "Control de constitucionalidad de oficio. Control de convencionalidad difuso. Deber judicial de contrastar leyes con la Constitucion Nacional y tratados de derechos humanos.",
        "hechos": "Un conscripto sufrio un accidente en el servicio militar que le dejo 100% de incapacidad. La normativa especial preveia indemnizaciones irrisorias. La camara declaro de oficio la inconstitucionalidad de la norma legal excluyente, lo que fue apelado por el Estado Nacional por considerarlo violatorio de la congruencia procesal.",
        "votos": ["Lorenzetti", "Highton de Nolasco", "Fayt", "Petracchi", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art31", "AR-CN-art75", "AR-CN-art116"],
        "precedentes": ["CSJN-Fallos-324-3219 (Banco Comercial de Finanzas)"],
        "materia": ["constitucional", "procesal", "supremacia", "control de oficio"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=7056221"
    },
    {
        "id": "CSJN-Fallos-335-792",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Albarracini Nieves, Jorge Washington s/ medidas precautorias",
        "fecha": "2012-06-01",
        "tomo": 335,
        "pagina": 792,
        "holding": "El derecho de una persona adulta y plenamente capaz a expresar directivas medicas anticipadas y rechazar tratamientos medicos (incluidas transfusiones de sangre por conviccion religiosa) esta protegido por el derecho a la autodeterminacion y privacidad del art. 19 CN, debiendo ser respetado incluso ante riesgo de muerte.",
        "sumario": "Autonomia de la voluntad. Directivas anticipadas de salud. Objecion de conciencia y libertad religiosa. Prevalencia de la decision informada del paciente sobre el deber medico de preservacion de la vida.",
        "hechos": "Jorge Albarracini sufrio heridas graves de bala en un robo. Como Testigo de Jehova, habia formalizado por escritura publica su voluntad de no recibir transfusiones sanguineas. Su padre interpuso medida judicial exigiendo la transfusion compulsiva para salvarle la vida, ante la oposicion de la conyuge que exigia respetar las directivas del paciente.",
        "votos": ["Lorenzetti", "Highton de Nolasco", "Fayt", "Petracchi", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art19", "AR-CCyC-art56", "AR-CCyC-art60"],
        "precedentes": ["CSJN-Fallos-316-479 (Bahamondez)"],
        "materia": ["civil", "constitucional", "bioderecho", "autonomia personal"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=7015482"
    },
    {
        "id": "CSJN-Fallos-331-1622",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Mendoza, Beatriz Silvia y otros c/ Estado Nacional y otros s/ danios y perjuicios",
        "fecha": "2008-07-08",
        "tomo": 331,
        "pagina": 1622,
        "holding": "La tutela del bien colectivo medio ambiental tiene jerarquia constitucional prevalente y habilita sentencias estructurales que fijan programas de politicas publicas obligatorias, comisiones de seguimiento y sanciones ante el incumplimiento concurrente de entes estatales y empresas privadas.",
        "sumario": "Causa Riachuelo. Derecho a un ambiente sano y equilibrado. Mandato de saneamiento de la cuenca hidrica Matanza-Riachuelo. Condena concurrente y creacion de mecanismos judiciales de ejecucion continua.",
        "hechos": "Un grupo de vecinos de la cuenca Matanza-Riachuelo interpuso demanda originaria ante la Corte Suprema contra el Estado Nacional, la Provincia de Buenos Aires, la Ciudad de Buenos Aires y 44 empresas por contaminacion y afectacion grave de la salud publica.",
        "votos": ["Lorenzetti", "Highton de Nolasco", "Fayt", "Petracchi", "Maqueda", "Zaffaroni", "Argibay"],
        "citas_normativas": ["AR-CN-art41", "AR-CN-art43"],
        "precedentes": ["CSJN-Fallos-332-111 (Halabi)"],
        "materia": ["ambiental", "constitucional", "procesal", "derechos colectivos"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=6569101"
    },
    {
        "id": "CSJN-Fallos-308-2268",
        "tribunal": "Corte Suprema de Justicia de la Nacion",
        "autos": "Sejean, Juan Bautista c/ Zaks de Sejean, Ana Maria",
        "fecha": "1986-11-27",
        "tomo": 308,
        "pagina": 2268,
        "holding": "La prohibicion absoluta del divorcio vincular contenida en el articulo 64 de la Ley 2393 vulnera la garantia de proteccion integral de la familia y el principio de reserva y proyecto de vida (arts. 14 bis y 19 CN), declarandose su inconstitucionalidad.",
        "sumario": "Divorcio vincular. Inconstitucionalidad de la indisolubilidad civil del matrimonio. Apertura jurisprudencial a la sancion de la Ley 23.515.",
        "hechos": "Juan Bautista Sejean solicito judicialmente la declaracion de inconstitucionalidad del art. 64 de la ley de matrimonio civil para disolver el vinculo de un matrimonio fracasado hacia decadas y poder contraer nuevo matrimonio valido con su actual pareja e hijos.",
        "votos": ["Petracchi", "Bacque", "Fayt", "Belluscio"],
        "citas_normativas": ["AR-CN-art14_bis", "AR-CN-art19", "AR-CCyC-art435"],
        "precedentes": [],
        "materia": ["civil", "familia", "constitucional"],
        "estado": "vigente",
        "fuente_url": "https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/verDocumentoById.html?idDocumento=18742"
    }
]

def hash_dict(d):
    blob = f"{d['tribunal']}|{d['autos']}|{d['fecha']}|{d['holding']}|{d['sumario']}"
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]

def validar():
    print(f"Validando {len(FALLOS_CARDINALES)} fallos cardinales...")
    ids = set()
    for f in FALLOS_CARDINALES:
        assert f["id"] not in ids, f"ID duplicado: {f['id']}"
        ids.add(f["id"])
        assert f["tribunal"] and f["autos"] and f["holding"] and f["sumario"], f"Campo obligatorio vacio en {f['id']}"
        assert isinstance(f["citas_normativas"], list)
        assert isinstance(f["materia"], list)
        f["hash_verif"] = hash_dict(f)
    print(f"✓ Todos los {len(FALLOS_CARDINALES)} fallos cardinales son estructuralmente válidos.")
    return True

def guardar_json():
    destino = OUT / "jurisprudencia.json"
    for f in FALLOS_CARDINALES:
        f["hash_verif"] = hash_dict(f)
    destino.write_text(json.dumps(FALLOS_CARDINALES, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ Guardado JSON: {destino}")

def asegurar_tablas(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS jurisprudencia (
      id                  TEXT PRIMARY KEY,
      tribunal            TEXT NOT NULL,
      autos               TEXT NOT NULL,
      fecha               TEXT NOT NULL,
      tomo                INTEGER,
      pagina              INTEGER,
      holding             TEXT NOT NULL,
      sumario             TEXT NOT NULL,
      hechos              TEXT,
      votos               TEXT DEFAULT '[]',
      citas_normativas    TEXT DEFAULT '[]',
      precedentes         TEXT DEFAULT '[]',
      materia             TEXT DEFAULT '[]',
      estado              TEXT DEFAULT 'vigente',
      fuente_url          TEXT,
      hash_verif          TEXT,
      fecha_ingesta       TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jurisp_tribunal ON jurisprudencia(tribunal);
    CREATE INDEX IF NOT EXISTS idx_jurisp_autos    ON jurisprudencia(autos);
    CREATE INDEX IF NOT EXISTS idx_jurisp_fecha    ON jurisprudencia(fecha);
    CREATE INDEX IF NOT EXISTS idx_jurisp_estado   ON jurisprudencia(estado);

    CREATE VIRTUAL TABLE IF NOT EXISTS jurisprudencia_fts USING fts5(
      id UNINDEXED, tribunal, autos, holding, sumario, hechos, materia,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    """)

def cargar_db():
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    asegurar_tablas(con)

    print("Cargando fallos en SQLite...")
    con.execute("DELETE FROM jurisprudencia")
    con.execute("DELETE FROM jurisprudencia_fts")

    for f in FALLOS_CARDINALES:
        h = hash_dict(f)
        con.execute("""
            INSERT INTO jurisprudencia (
                id, tribunal, autos, fecha, tomo, pagina, holding, sumario,
                hechos, votos, citas_normativas, precedentes, materia,
                estado, fuente_url, hash_verif
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f["id"], f["tribunal"], f["autos"], f["fecha"], f.get("tomo"), f.get("pagina"),
            f["holding"], f["sumario"], f.get("hechos"),
            json.dumps(f.get("votos", []), ensure_ascii=False),
            json.dumps(f.get("citas_normativas", []), ensure_ascii=False),
            json.dumps(f.get("precedentes", []), ensure_ascii=False),
            json.dumps(f.get("materia", []), ensure_ascii=False),
            f.get("estado", "vigente"), f.get("fuente_url"), h
        ))

        con.execute("""
            INSERT INTO jurisprudencia_fts (id, tribunal, autos, holding, sumario, hechos, materia)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f["id"], f["tribunal"], f["autos"], f["holding"], f["sumario"],
            f.get("hechos", ""), " ".join(f.get("materia", []))
        ))

    con.commit()
    con.close()
    print(f"✓ {len(FALLOS_CARDINALES)} fallos cargados con éxito en {DB}.")

def main():
    parser = argparse.ArgumentParser(description="Ingesta de Jurisprudencia CSJN")
    parser.add_argument("--solo-validar", action="store_true", help="Solo valida la estructura")
    args = parser.parse_args()

    validar()
    guardar_json()
    if not args.solo_validar:
        cargar_db()

if __name__ == "__main__":
    main()
