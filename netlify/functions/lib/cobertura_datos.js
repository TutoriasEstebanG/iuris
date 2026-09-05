// GENERADO POR ingesta/generar_cobertura.py — NO EDITAR A MANO
// Regenerar tras cada ingesta:  python3 ingesta/generar_cobertura.py
export const SIGLAS_EN_CORPUS = ["CCyC", "CN", "CP"];
export const CUERPOS = {
  "CCyC": "Codigo Civil y Comercial de la Nacion",
  "CN": "Constitucion de la Nacion Argentina",
  "CP": "Codigo Penal de la Nacion Argentina"
};
export const AUSENTES_DATOS = {
  "laboral": {
    "rx": "\\b(trabajador(?:es|a)?|laboral(?:es)?|despido|salario|sindical|sindicato|huelga|jornada laboral|LCT|20\\.?744|convenio colectivo|obra social|riesgos del trabajo|aguinaldo)\\b",
    "norma": "Ley de Contrato de Trabajo 20.744 y complementarias"
  },
  "procesal": {
    "rx": "\\b(c[oó]digo procesal|CPCC|CPPF|CPCCN|contestar\\s+(?:la\\s+)?demanda|traslado de (?:la )?demanda|excepci(?:on|ón|ones) previa|recurso de (?:apelaci[oó]n|casaci[oó]n|queja)|caducidad de instancia|alegato|c[eé]dula de notificaci[oó]n|rebeld[ií]a|medida cautelar|embargo preventivo|plazo procesal|traba de la litis)\\b",
    "norma": "codigos procesales segun jurisdiccion"
  },
  "administrativo": {
    "rx": "\\b(acto administrativo|procedimiento administrativo|19\\.?549|recurso jer[aá]rquico|contencioso administrativo)\\b",
    "norma": "Ley 19.549 y normas locales"
  },
  "tributario": {
    "rx": "\\b(tributari|impuesto a las ganancias|IVA|AFIP|ARCA|determinaci[oó]n de oficio|11\\.?683)\\b",
    "norma": "Ley 11.683 y leyes impositivas"
  }
};
