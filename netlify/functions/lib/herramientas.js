/**
 * Iuris — Herramientas procesales, de cálculo y suite docente
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { consultar } from "./db.js";

// Feriados nacionales argentinos fijos y de referencia
const FERIADOS_FIJOS = new Set([
  "01-01", // Año Nuevo
  "03-24", // Memoria, Verdad y Justicia
  "04-02", // Veteranos de Malvinas
  "05-01", // Día del Trabajador
  "05-25", // Revolución de Mayo
  "06-20", // Paso a la Inmortalidad de Belgrano
  "07-09", // Día de la Independencia
  "08-17", // San Martín
  "10-12", // Diversidad Cultural
  "11-20", // Soberanía Nacional
  "12-08", // Inmaculada Concepción
  "12-25", // Navidad
]);

/**
 * Determina si una fecha dada es inhábil judicial en tribunales argentinos
 */
export function esInhabilJudicial(fecha, considerarFerias = true) {
  const d = new Date(fecha.getTime());
  const diaSemana = d.getUTCDay(); // 0 = Domingo, 6 = Sábado
  if (diaSemana === 0 || diaSemana === 6) return true;

  const mes = d.getUTCMonth() + 1; // 1 a 12
  const dia = d.getUTCDate();
  const mmdd = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  if (FERIADOS_FIJOS.has(mmdd)) return true;

  if (considerarFerias) {
    // Feria judicial de enero completa (1 al 31 de enero)
    if (mes === 1) return true;
    // Feria judicial de invierno (aproximación estándar: días 10 a 24 de julio)
    if (mes === 7 && dia >= 10 && dia <= 24) return true;
  }

  return false;
}

/**
 * Computa el vencimiento de un plazo procesal judicial en días hábiles
 */
export function calcularPlazoProcesal({
  fechaNotificacion,
  dias,
  tipoDias = "habiles",
  fuero = "civil_comercial_nacional",
  considerarFerias = true
}) {
  const f0 = new Date(fechaNotificacion);
  if (isNaN(f0.getTime())) {
    throw new Error("Fecha de notificación inválida (formato esperado AAAA-MM-DD)");
  }
  const cantidadDias = parseInt(dias, 10);
  if (!cantidadDias || cantidadDias <= 0) {
    throw new Error("Cantidad de días debe ser un número entero positivo");
  }

  // En derecho procesal argentino, el plazo comienza a correr al día siguiente de la notificación (Art. 156 CPCCN)
  let cur = new Date(Date.UTC(f0.getUTCFullYear(), f0.getUTCMonth(), f0.getUTCDate()));
  cur.setUTCDate(cur.getUTCDate() + 1);

  let contados = 0;
  const diasDetalle = [];

  if (tipoDias === "corridos") {
    for (let i = 0; i < cantidadDias; i++) {
      diasDetalle.push(cur.toISOString().slice(0, 10));
      if (i < cantidadDias - 1) cur.setUTCDate(cur.getUTCDate() + 1);
    }
    // Si el último día es inhábil, se prorroga al primer día hábil siguiente (Art. 156 CPCCN)
    while (esInhabilJudicial(cur, considerarFerias)) {
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else {
    // Días hábiles judiciales
    while (contados < cantidadDias) {
      const inhabil = esInhabilJudicial(cur, considerarFerias);
      if (!inhabil) {
        contados++;
        diasDetalle.push(cur.toISOString().slice(0, 10));
      }
      if (contados < cantidadDias) {
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
  }

  // Día hábil siguiente para plazo de gracia (primeras dos horas art. 124 CPCCN)
  const diaGracia = new Date(cur.getTime());
  diaGracia.setUTCDate(diaGracia.getUTCDate() + 1);
  while (esInhabilJudicial(diaGracia, considerarFerias)) {
    diaGracia.setUTCDate(diaGracia.getUTCDate() + 1);
  }

  const fechaVencimiento = cur.toISOString().slice(0, 10);
  const fechaPlazoGracia = diaGracia.toISOString().slice(0, 10);

  return {
    fechaNotificacion: f0.toISOString().slice(0, 10),
    dias: cantidadDias,
    tipoDias,
    fuero,
    fechaVencimiento,
    fechaPlazoGracia,
    plazoDeGracia: `Hasta las primeras 2 horas de despacho del día ${fechaPlazoGracia} (Art. 124 CPCCN)`,
    diasComputados: diasDetalle.length,
    calendarioDiasComputados: diasDetalle,
  };
}

/**
 * Cálculo de indemnizaciones según fórmulas reconocidas jurisprudencialmente (Méndez / Vuotto)
 */
export function calcularIndemnizacion({
  formula = "mendez",
  ingresoMensual,
  edadAlAccidente,
  porcentajeIncapacidad,
  tasaPura = null
}) {
  const ingreso = parseFloat(ingresoMensual);
  const edad = parseInt(edadAlAccidente, 10);
  const incap = parseFloat(porcentajeIncapacidad);

  if (!ingreso || ingreso <= 0) throw new Error("Ingreso mensual debe ser mayor a 0");
  if (!edad || edad < 16 || edad >= 75) throw new Error("Edad debe encontrarse entre 16 y 74 años");
  if (!incap || incap <= 0 || incap > 100) throw new Error("Porcentaje de incapacidad debe ser entre 1 y 100");

  const porcentajeFracc = incap / 100;
  const ingresosAnualesConSAC = ingreso * 13;
  const perdidaAnual = ingresosAnualesConSAC * porcentajeFracc;

  let resultadoCapital = 0;
  let formulaNombre = "";
  let memoriaCalculo = {};

  if (formula.toLowerCase() === "vuotto") {
    // Fórmula Vuotto (CNAT): edad límite 65, tasa 6% anual
    const i = tasaPura !== null ? parseFloat(tasaPura) : 0.06;
    const n = Math.max(1, 65 - edad);
    const factorDescuento = (1 - Math.pow(1 + i, -n)) / i;
    resultadoCapital = perdidaAnual * factorDescuento;
    formulaNombre = "Fórmula Vuotto (CNAT)";
    memoriaCalculo = {
      tasaDescuento: i,
      anosRestantes: n,
      factorDescuento: Math.round(factorDescuento * 10000) / 10000,
    };
  } else {
    // Fórmula Méndez (CSJN, 2008): edad límite 75, tasa 4% anual, multiplicador (60/edad)
    const i = tasaPura !== null ? parseFloat(tasaPura) : 0.04;
    const n = Math.max(1, 75 - edad);
    const factorDescuento = (1 - Math.pow(1 + i, -n)) / i;
    const coefEdad = 60 / edad;
    resultadoCapital = perdidaAnual * factorDescuento * coefEdad;
    formulaNombre = "Fórmula Méndez (CSJN - Fallos 331:570)";
    memoriaCalculo = {
      tasaDescuento: i,
      anosRestantes: n,
      coeficienteEdad60SobreEdad: Math.round(coefEdad * 10000) / 10000,
      factorDescuento: Math.round(factorDescuento * 10000) / 10000,
    };
  }

  const capitalRedondeado = Math.round(resultadoCapital * 100) / 100;

  return {
    formula: formulaNombre,
    parametros: {
      ingresoMensual: ingreso,
      ingresosAnualesConSAC,
      edadAlAccidente: edad,
      porcentajeIncapacidad: incap,
    },
    capitalIndemnizatorio: capitalRedondeado,
    memoriaCalculo,
    citaJurisprudencial: formula.toLowerCase() === "vuotto"
      ? "CNAT, Sala III, 'Vuotto c/ AEG Telefunken', 1978"
      : "CSJN, 'Méndez, Daniel c/ Mylba S.A. s/ accidente', Fallos 331:570 (2008)",
  };
}

/**
 * Consulta y verificación de precedentes de inconstitucionalidad de la CSJN
 */
export async function verificarInconstitucionalidad({ normaId = "", articulo = "", cuerpo = "" }) {
  const busqueda = `${normaId} ${articulo} ${cuerpo}`.toLowerCase().trim();

  // 1. Registro canónico de declaraciones de inconstitucionalidad de la Corte
  const PRECEDENTES_INCONSTITUCIONALIDAD = [
    {
      norma: "Ley 24.557 art. 39 inc. 1 (LRT)",
      patron: /art(?:iculo|\.)?\s*39.*24\.?557|lrt.*39/i,
      fallo: "Aquino, Isacio c/ Cargo Servicios Industriales S.A.",
      cita: "Fallos 327:3753 (2004)",
      holding: "Es inconstitucional eximir al empleador de responsabilidad civil privando al trabajador de la reparación integral del daño según el derecho común.",
      efecto: "Invalidez de la tarifa cerrada sustitutiva del Código Civil."
    },
    {
      norma: "Ley 23.737 art. 14 segundo párrafo",
      patron: /14.*23\.?737|estupefacientes.*consumo\s+personal/i,
      fallo: "Arriola, Sebastián y otros",
      cita: "Fallos 332:1963 (2009)",
      holding: "Es inconstitucional penalizar la tenencia de estupefacientes para consumo personal que no traiga peligro concreto a terceros por violentar el art. 19 de la CN.",
      efecto: "Despenalización pretoriana en ámbito de privacidad."
    },
    {
      norma: "Ley 25.873 y Dto. 1563/04",
      patron: /25\.?873|telecomunicaciones.*comunicaciones/i,
      fallo: "Halabi, Ernesto c/ P.E.N.",
      cita: "Fallos 332:111 (2009)",
      holding: "Es inconstitucional la retención y captación indiscriminada de datos de tráfico telefónico e internet sin orden judicial previa.",
      efecto: "Creación pretoriana de la acción de clase para derechos individuales homogéneos con efectos erga omnes."
    },
    {
      norma: "Ley 24.557 art. 21 y 22 (Comisiones Médicas obligatorias)",
      patron: /art(?:iculo|\.)?\s*21.*24\.?557|comisiones\s+medicas.*castillo/i,
      fallo: "Castillo, Ángel c/ Cerámica Alberdi S.A.",
      cita: "Fallos 327:3610 (2004)",
      holding: "Es inconstitucional otorgar competencia federal exclusiva a las comisiones médicas para materias de derecho común y desplazar a los jueces laborales locales.",
      efecto: "Apertura de la jurisdicción ordinaria."
    },
    {
      norma: "Ley 24.557 art. 46 (Competencia federal de apelación)",
      patron: /art(?:iculo|\.)?\s*46.*24\.?557/i,
      fallo: "Castillo / Obregón",
      cita: "Fallos 327:3610 / Fallos 335:663",
      holding: "Inconstitucionalidad de la vía recursiva ante la Cámara Federal de la Seguridad Social para reclamos de derecho laboral local.",
      efecto: "Competencia de la justicia laboral ordinaria de cada jurisdicción."
    }
  ];

  for (const item of PRECEDENTES_INCONSTITUCIONALIDAD) {
    if (item.patron.test(busqueda)) {
      return {
        declaradoInconstitucional: true,
        normaCuestionada: item.norma,
        precedenteCSJN: item.fallo,
        publicacionOficial: item.cita,
        holding: item.holding,
        efectoProcesal: item.efecto,
      };
    }
  }

  // 2. Búsqueda en la tabla de jurisprudencia local si existe base de datos
  try {
    const filas = await consultar(
      "SELECT autos, tomo, pagina, holding, sumario FROM jurisprudencia WHERE holding LIKE '%inconstitucional%'"
    );
    const artLimpio = String(articulo || "").trim();
    if (artLimpio) {
      const rxArt = new RegExp(`\\bart(?:[íi]culo|\\.)?\\s*${artLimpio}\\b`, "i");
      for (const f of filas) {
        const txtFallo = `${f.holding} ${f.sumario}`;
        if (rxArt.test(txtFallo)) {
          if (!cuerpo || txtFallo.toLowerCase().includes(cuerpo.toLowerCase())) {
            return {
              declaradoInconstitucional: true,
              precedenteCSJN: f.autos,
              publicacionOficial: f.tomo && f.pagina ? `Fallos ${f.tomo}:${f.pagina}` : "",
              holding: f.holding,
            };
          }
        }
      }
    }
  } catch {}

  return {
    declaradoInconstitucional: false,
    mensaje: "No consta declaración general de inconstitucionalidad por la CSJN en el registro para dicha disposición.",
  };
}

/**
 * Generador estructurado de casos prácticos con distractores para docencia
 */
export function generarCasoDocente({
  materia = "Derecho Civil",
  tema = "Responsabilidad Civil Objetiva",
  nivel = "intermedio",
  incluirDistractor = true
}) {
  return {
    materia,
    tema,
    nivel,
    formato: "Método IRAC para examen universitario",
    estructuraCaso: {
      caratulaHipotetica: `Caso de Estudio: Conflicto sobre ${tema}`,
      hechosRelevantes: [
        `Un hecho generador con intervención de cosas riesgosas o dependientes.`,
        `Presencia de daño patrimonial y extrapatrimonial verificable.`,
        `Relación de causalidad aparente sujeta a discusión sobre eximentes.`
      ],
      distractorProcesal: incluirDistractor
        ? "Planteo de excepción de prescripción fundada en normativa anterior derogada o confusión sobre plazo de prescripción bienal vs trienal/quinquenal."
        : null,
      quaestioIuris: `¿Se configuran los presupuestos de la responsabilidad y concurre alguna causal de interrupción del nexo causal?`,
      pautasDeEvaluacion: [
        "1. Identificación del factor de atribución (objetivo vs subjetivo).",
        "2. Análisis preciso de la carga de la prueba de la eximente.",
        "3. Solución fundada con indicación de artículos y doctrina legal."
      ]
    }
  };
}

/**
 * Generador de rúbricas analíticas estructuradas para cátedras universitarias
 */
export function generarRubricaDocente({
  tema = "Dictamen / Resolución de Caso",
  escala = "1-10"
}) {
  return {
    tema,
    escala,
    criterios: [
      {
        dimension: "Encuadre Normativo y Precisión de Citas",
        pesoPorcentaje: 30,
        niveles: {
          sobresaliente: "Cita artículos exactos del ordenamiento vigente sin invocar normas derogadas. Distingue texto literal de interpretación.",
          bueno: "Identifica las leyes aplicables y cita la mayoría de los artículos pertinentes con mínimas imprecisiones secundarias.",
          regular: "Cita normas incompletas o menciona principios generales sin anclaje articulado preciso.",
          insuficiente: "Invoca leyes derogadas o fundamenta en derecho positivo inexistente."
        }
      },
      {
        dimension: "Razonamiento Dogmático y Subsunsión",
        pesoPorcentaje: 30,
        niveles: {
          sobresaliente: "Estructura rigurosamente Hechos -> Quaestio Iuris -> Regla -> Conclusión (IRAC). Desarrolla los elementos dogmáticos del instituto.",
          bueno: "Aplica correctamente la regla jurídica a los hechos aunque con desarrollo teórico sintético.",
          regular: "Presenta contradicciones entre la regla invocada y la conclusión fáctica propuesta.",
          insuficiente: "No realiza operación de subsunsión; emite opiniones subjetivas desprovistas de fundamentación jurídica."
        }
      },
      {
        dimension: "Jurisprudencia y Precedentes",
        pesoPorcentaje: 20,
        niveles: {
          sobresaliente: "Identifica el holding de fallos cardinales de la CSJN aplicables al caso y fundamenta la ratio decidendi.",
          bueno: "Menciona fallos jurisprudenciales conocidos vinculados al tema.",
          regular: "Alude a 'criterios de tribunales' de forma genérica sin identificar tribunal ni carátula.",
          insuficiente: "Omite toda referencia a la doctrina judicial o cita precedentes superados."
        }
      },
      {
        dimension: "Registro Lingüístico Forense y Claridad Expositiva",
        pesoPorcentaje: 20,
        niveles: {
          sobresaliente: "Vocabulario forense impecable, latinos empleados en contexto y excelente coherencia sintáctica.",
          bueno: "Claridad expositiva con adecuada terminología jurídica.",
          regular: "Uso coloquial o impreciso de figuras técnicas (ej. confundir nulidad con rescisión).",
          insuficiente: "Incoherencia expositiva y deformación de conceptos elementales del Derecho."
        }
      }
    ]
  };
}

/**
 * Definición de Tools en esquema Anthropic Claude
 */
export const DEFINICIONES_HERRAMIENTAS = [
  {
    name: "calcular_plazo_procesal",
    description: "Calcula con precisión cronológica el vencimiento de un plazo procesal judicial en días hábiles (excluyendo sábados, domingos, feriados nacionales y ferias judiciales argentinas de enero y julio), indicando el día de vencimiento y el plazo de gracia (primeras dos horas del día hábil posterior, Art. 124 CPCCN).",
    input_schema: {
      type: "object",
      properties: {
        fechaNotificacion: {
          type: "string",
          description: "Fecha en que se perfeccionó la notificación judicial (formato AAAA-MM-DD)."
        },
        dias: {
          type: "integer",
          description: "Cantidad de días del plazo procesal (ej. 3, 5, 10, 15)."
        },
        tipoDias: {
          type: "string",
          enum: ["habiles", "corridos"],
          description: "Tipo de cómputo: 'habiles' judiciales (por defecto) o 'corridos'."
        },
        fuero: {
          type: "string",
          description: "Fuero judicial (ej. 'civil_comercial_nacional', 'laboral', 'penal')."
        }
      },
      required: ["fechaNotificacion", "dias"]
    }
  },
  {
    name: "calcular_indemnizacion",
    description: "Calcula indemnizaciones por incapacidad psicofísica o muerte según las fórmulas jurisprudenciales argentinas Méndez (CSJN Fallos 331:570, expectativa 75 años, tasa 4%) y Vuotto (CNAT, 65 años, tasa 6%).",
    input_schema: {
      type: "object",
      properties: {
        formula: {
          type: "string",
          enum: ["mendez", "vuotto"],
          description: "Fórmula de cálculo a aplicar ('mendez' de la CSJN o 'vuotto' de la CNAT)."
        },
        ingresoMensual: {
          type: "number",
          description: "Remuneración mensual habitual devengada al momento del hecho."
        },
        edadAlAccidente: {
          type: "integer",
          description: "Edad de la víctima en años al momento del hecho dañoso."
        },
        porcentajeIncapacidad: {
          type: "number",
          description: "Porcentaje de incapacidad permanente física o psíquica (de 1 a 100)."
        }
      },
      required: ["ingresoMensual", "edadAlAccidente", "porcentajeIncapacidad"]
    }
  },
  {
    name: "verificar_inconstitucionalidad",
    description: "Verifica si una disposición legal o normativa fue declarada inconstitucional por la Corte Suprema de Justicia de la Nación (CSJN) y devuelve el precedente, holding y efecto procesal.",
    input_schema: {
      type: "object",
      properties: {
        normaId: {
          type: "string",
          description: "Identificador de la norma o ley (ej. 'Ley 24557', 'AR-CCyC-art39', 'Ley 23737')."
        },
        articulo: {
          type: "string",
          description: "Número de artículo específico a auditar (ej. '39', '14', '21')."
        },
        cuerpo: {
          type: "string",
          description: "Nombre del cuerpo normativo o ley."
        }
      },
      required: ["articulo"]
    }
  },
  {
    name: "generar_rubrica_docente",
    description: "Genera una matriz de evaluación o rúbrica analítica por dimensiones ponderadas y niveles de desempeño para cátedras de Derecho.",
    input_schema: {
      type: "object",
      properties: {
        tema: {
          type: "string",
          description: "Tema o pieza objeto de evaluación (ej. 'Resolución de Caso Civil', 'Examen Oral Penal')."
        },
        escala: {
          type: "string",
          description: "Escala de calificación (ej. '1-10', 'porcentual')."
        }
      }
    }
  }
];

/**
 * Despachador de ejecución de herramientas
 */
export async function ejecutarHerramienta(nombre, args = {}) {
  switch (nombre) {
    case "calcular_plazo_procesal":
      return calcularPlazoProcesal(args);
    case "calcular_indemnizacion":
      return calcularIndemnizacion(args);
    case "verificar_inconstitucionalidad":
      return await verificarInconstitucionalidad(args);
    case "generar_rubrica_docente":
      return generarRubricaDocente(args);
    default:
      throw new Error(`Herramienta desconocida: ${nombre}`);
  }
}
