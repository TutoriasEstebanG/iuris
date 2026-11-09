import assert from "node:assert/strict";
import { Retriever } from "../netlify/functions/lib/retriever.js";
import { contextualizarConsulta } from "../netlify/functions/lib/contexto.js";
import { formatearContexto } from "../netlify/functions/lib/prompts.js";
import { sanitizarJurisprudencia, sanitizarContexto } from "../netlify/functions/lib/sanitizador.js";

console.log("▶ Iniciando pruebas de Fase 2: Jurisprudencia y Retrieval Contextual...");

// 1. Prueba de contextualización de consultas dependientes
{
  const standalone = contextualizarConsulta([
    { role: "user", content: "Explicame el regimen de la responsabilidad civil objetiva." }
  ]);
  assert.equal(standalone, "Explicame el regimen de la responsabilidad civil objetiva.");

  const dependiente = contextualizarConsulta([
    { role: "user", content: "Explicame el amparo colectivo y los derechos individuales homogeneos." },
    { role: "assistant", content: "El amparo colectivo permite tutelar a grupos afectados por una misma causa fáctica." },
    { role: "user", content: "¿Qué precedente de la Corte lo creó?" }
  ]);
  assert.ok(dependiente.includes("¿Qué precedente de la Corte lo creó?"), "Debe mantener la consulta original");
  assert.ok(dependiente.toLowerCase().includes("amparo") || dependiente.toLowerCase().includes("colectivo"),
    "Debe anexar términos ancla del contexto previo");
}

// 2. Prueba de sanitización de jurisprudencia
{
  const falloCrudo = {
    id: "CSJN-Fallos-332-111",
    tribunal: "Corte Suprema <script>alert(1)</script>",
    autos: "Halabi, Ernesto c/ PEN",
    fecha: "2009-02-24T00:00:00Z",
    cita_fallos: "Fallos 332:111",
    holding: "Se reconocen las acciones de clase.",
    sumario: "Acciones de clase.",
    hechos: "Hechos del caso.",
    citas_normativas: ["AR-CN-art43"],
    precedentes: ["CSJN-Fallos-239-459"],
    materia: ["constitucional"],
    estado: "vigente",
    fuente_url: "https://csjn.gov.ar/fallo",
    via: "fts"
  };

  const limpio = sanitizarJurisprudencia(falloCrudo);
  assert.equal(limpio.id, "CSJN-Fallos-332-111");
  assert.ok(!limpio.tribunal.includes("<script>"), "Debe sanitizar etiquetas html");
  assert.equal(limpio.fecha, "2009-02-24");

  const ctxLimpio = sanitizarContexto({ normas: [], jurisprudencia: [falloCrudo], advertencias: [] });
  assert.equal(ctxLimpio.jurisprudencia.length, 1);
  assert.equal(ctxLimpio._sanitizado, true);
}

// 3. Prueba de formateo en bloque XML
{
  const xml = formatearContexto([], [], [
    {
      id: "CSJN-Fallos-239-459",
      tribunal: "Corte Suprema de Justicia de la Nacion",
      autos: "Siri, Angel",
      fecha: "1957-12-27",
      cita_fallos: "Fallos 239:459",
      holding: "Nacimiento del amparo constitucional.",
      sumario: "Amparo contra autoridad publica.",
      hechos: "Clausura de diario.",
      citas_normativas: ["AR-CN-art18"]
    }
  ]);
  assert.ok(xml.includes("<jurisprudencia_recuperada>"), "Debe incluir bloque de jurisprudencia");
  assert.ok(xml.includes('<fallo numero="1" id="CSJN-Fallos-239-459"'), "Debe contener atributos estructurados del fallo");
  assert.ok(xml.includes("<autos>Siri, Angel</autos>"), "Debe contener la carátula");
  assert.ok(xml.includes("<holding>Nacimiento del amparo constitucional.</holding>"), "Debe incluir el holding");
}

// 4. Prueba de recuperación real en base de datos SQLite
{
  process.env.LOCAL_DB_PATH = "./data/output/iuris.db";
  const r = new Retriever();

  // Test Kot / Siri en amparo
  const resAmparo = await r.recuperar("accion de amparo contra actos de particulares o autoridad");
  assert.ok(resAmparo.jurisprudencia.length > 0, "Debe recuperar al menos un fallo de amparo");
  const autos = resAmparo.jurisprudencia.map(f => f.autos);
  const tieneKotOSiri = autos.some(a => a.includes("Kot") || a.includes("Siri"));
  assert.ok(tieneKotOSiri, "Debe recuperar Kot o Siri para consultas sobre amparo");

  // Test Arriola en estupefacientes
  const resArriola = await r.recuperar("tenencia de estupefacientes consumo personal articulo 19");
  assert.ok(resArriola.jurisprudencia.some(f => f.autos.includes("Arriola")), "Debe recuperar fallo Arriola");

  // Test Halabi en acciones de clase
  const resHalabi = await r.recuperar("acciones de clase derechos colectivos individuales homogeneos");
  assert.ok(resHalabi.jurisprudencia.some(f => f.autos.includes("Halabi")), "Debe recuperar fallo Halabi");
}

console.log("✔ Todas las pruebas de Fase 2 pasaron exitosamente.");
