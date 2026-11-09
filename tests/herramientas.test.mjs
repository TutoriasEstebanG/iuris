import assert from "node:assert/strict";
import {
  esInhabilJudicial,
  calcularPlazoProcesal,
  calcularIndemnizacion,
  verificarInconstitucionalidad,
  generarCasoDocente,
  generarRubricaDocente,
  ejecutarHerramienta,
  DEFINICIONES_HERRAMIENTAS,
} from "../netlify/functions/lib/herramientas.js";
import endpointHerramientas from "../netlify/functions/herramientas.js";

console.log("▶ Iniciando pruebas de Fase 4: Herramientas Procesales y Suite Docente...");

// 1. Detección de días inhábiles y ferias judiciales
{
  const sabado = new Date("2026-05-16T12:00:00Z");
  assert.equal(esInhabilJudicial(sabado), true, "Sábado debe ser inhábil");

  const domingo = new Date("2026-05-17T12:00:00Z");
  assert.equal(esInhabilJudicial(domingo), true, "Domingo debe ser inhábil");

  const primeroMayo = new Date("2026-05-01T12:00:00Z");
  assert.equal(esInhabilJudicial(primeroMayo), true, "1° de mayo debe ser feriado inhábil");

  const feriaEnero = new Date("2026-01-15T12:00:00Z");
  assert.equal(esInhabilJudicial(feriaEnero, true), true, "Enero debe ser inhábil por feria judicial");
  assert.equal(esInhabilJudicial(feriaEnero, false), false, "Sin computar feria, día de semana en enero sería hábil");

  const diaHabil = new Date("2026-05-13T12:00:00Z"); // Miércoles hábil
  assert.equal(esInhabilJudicial(diaHabil), false, "Miércoles común de mayo debe ser hábil");
}

// 2. Cómputo procesal de plazos judiciales (Art. 156 y 124 CPCCN)
{
  // Notificado un jueves 14 de mayo de 2026, plazo de 5 días hábiles
  // Día 1: Vie 15 Mayo
  // Sab 16, Dom 17 (inhábiles)
  // Día 2: Lun 18 Mayo
  // Día 3: Mar 19 Mayo
  // Día 4: Mie 20 Mayo
  // Día 5: Jue 21 Mayo -> Vencimiento
  // Plazo de gracia: Vie 22 Mayo (primeras 2 horas)
  const calc = calcularPlazoProcesal({
    fechaNotificacion: "2026-05-14",
    dias: 5,
    tipoDias: "habiles",
  });

  assert.equal(calc.fechaVencimiento, "2026-05-21", "El vencimiento debe ser el 2026-05-21");
  assert.equal(calc.fechaPlazoGracia, "2026-05-22", "El plazo de gracia debe operar el día hábil siguiente");
  assert.equal(calc.diasComputados, 5);
  assert.ok(calc.plazoDeGracia.includes("Art. 124 CPCCN"));
}

// 3. Cálculo de indemnizaciones por incapacidad (Fórmula Méndez y Vuotto)
{
  const resMendez = calcularIndemnizacion({
    formula: "mendez",
    ingresoMensual: 500000,
    edadAlAccidente: 30,
    porcentajeIncapacidad: 20,
  });

  assert.ok(resMendez.capitalIndemnizatorio > 0, "Capital de Méndez debe ser mayor a 0");
  assert.ok(resMendez.formula.includes("Méndez"), "Debe indicar fórmula Méndez");
  assert.equal(resMendez.memoriaCalculo.coeficienteEdad60SobreEdad, 2, "60/30 debe ser 2");
  assert.equal(resMendez.memoriaCalculo.anosRestantes, 45, "75 - 30 debe ser 45");

  const resVuotto = calcularIndemnizacion({
    formula: "vuotto",
    ingresoMensual: 500000,
    edadAlAccidente: 30,
    porcentajeIncapacidad: 20,
  });
  assert.ok(resVuotto.capitalIndemnizatorio > 0);
  assert.ok(resVuotto.formula.includes("Vuotto"));
  assert.equal(resVuotto.memoriaCalculo.anosRestantes, 35, "65 - 30 debe ser 35");

  // Validación de errores de rango
  assert.throws(() => calcularIndemnizacion({ ingresoMensual: -10, edadAlAccidente: 30, porcentajeIncapacidad: 20 }));
  assert.throws(() => calcularIndemnizacion({ ingresoMensual: 100, edadAlAccidente: 80, porcentajeIncapacidad: 20 }));
}

// 4. Verificación de inconstitucionalidad CSJN
{
  const lrt = await verificarInconstitucionalidad({
    normaId: "Ley 24557",
    articulo: "39",
    cuerpo: "Riesgos del trabajo",
  });
  assert.equal(lrt.declaradoInconstitucional, true);
  assert.ok(lrt.precedenteCSJN.includes("Aquino"));

  const arriola = await verificarInconstitucionalidad({
    normaId: "Ley 23737",
    articulo: "14",
    cuerpo: "Estupefacientes consumo personal",
  });
  assert.equal(arriola.declaradoInconstitucional, true);
  assert.ok(arriola.precedenteCSJN.includes("Arriola"));

  const halabi = await verificarInconstitucionalidad({
    normaId: "Ley 25873",
    articulo: "1",
    cuerpo: "Telecomunicaciones e internet",
  });
  assert.equal(halabi.declaradoInconstitucional, true);
  assert.ok(halabi.precedenteCSJN.includes("Halabi"));

  const normaValida = await verificarInconstitucionalidad({
    normaId: "AR-CCyC-art1",
    articulo: "1",
    cuerpo: "Codigo Civil y Comercial",
  });
  assert.equal(normaValida.declaradoInconstitucional, false);
}

// 5. Generadores docentes: casos prácticos y rúbricas
{
  const caso = generarCasoDocente({
    materia: "Derecho Civil",
    tema: "Responsabilidad por riesgo de la cosa",
    nivel: "avanzado",
    incluirDistractor: true,
  });
  assert.equal(caso.materia, "Derecho Civil");
  assert.ok(caso.estructuraCaso.distractorProcesal, "Debe incluir distractor procesal");
  assert.ok(caso.estructuraCaso.hechosRelevantes.length >= 2);

  const rubrica = generarRubricaDocente({ tema: "Resolución de caso judicial" });
  assert.ok(rubrica.criterios.length >= 4);
  const totalPesos = rubrica.criterios.reduce((acc, c) => acc + c.pesoPorcentaje, 0);
  assert.equal(totalPesos, 100, "Los criterios deben sumar exactamente 100%");
}

// 6. Definiciones de Tools y Despachador
{
  assert.equal(DEFINICIONES_HERRAMIENTAS.length, 4);
  const toolNombres = DEFINICIONES_HERRAMIENTAS.map(t => t.name);
  assert.ok(toolNombres.includes("calcular_plazo_procesal"));
  assert.ok(toolNombres.includes("calcular_indemnizacion"));
  assert.ok(toolNombres.includes("verificar_inconstitucionalidad"));
  assert.ok(toolNombres.includes("generar_rubrica_docente"));

  const ejec = await ejecutarHerramienta("calcular_plazo_procesal", {
    fechaNotificacion: "2026-06-01",
    dias: 3,
  });
  assert.ok(ejec.fechaVencimiento);
}

// 7. Endpoint HTTP /api/herramientas
{
  const reqGet = new Request("http://localhost/api/herramientas", { method: "GET" });
  const resGet = await endpointHerramientas(reqGet);
  assert.equal(resGet.status, 200);
  const jsonGet = await resGet.json();
  assert.equal(jsonGet.herramientas.length, 4);

  const reqPost = new Request("http://localhost/api/herramientas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      herramienta: "calcular_indemnizacion",
      parametros: {
        formula: "mendez",
        ingresoMensual: 400000,
        edadAlAccidente: 35,
        porcentajeIncapacidad: 15,
      },
    }),
  });
  const resPost = await endpointHerramientas(reqPost);
  assert.equal(resPost.status, 200);
  const jsonPost = await resPost.json();
  assert.equal(jsonPost.ok, true);
  assert.ok(jsonPost.resultado.capitalIndemnizatorio > 0);
}

console.log("✔ Todas las pruebas de Fase 4 pasaron exitosamente.");
