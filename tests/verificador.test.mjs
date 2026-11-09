import assert from "node:assert/strict";
import { VerificadorCitas } from "../netlify/functions/lib/verificador.js";

const fuentes = [
  { id: "AR-CN-art75", sigla: "CN", articulo: "75", texto: "Corresponde al Congreso: ... 22. Aprobar o desechar tratados..." },
  { id: "AR-CN-art14_bis", sigla: "CN", articulo: "14 bis", texto: "El trabajo en sus diversas formas gozara de la proteccion de las leyes..." },
  { id: "AR-CCyC-art1721", sigla: "CCyC", articulo: "1721", texto: "Factores de atribucion. La atribucion de un dano al responsable puede ser objetiva o subjetiva." },
  { id: "AR-CP-art34", sigla: "CP", articulo: "34", texto: "No son punibles: 1. El que no haya podido en el momento del hecho..." },
];

const v = new VerificadorCitas(fuentes);

console.log("▶ Iniciando pruebas de VerificadorCitas...");

// Caso 1: Cita con inciso y sigla ("art. 75 inc. 22 CN")
{
  const citas = v._citas("Conforme al art. 75 inc. 22 CN.");
  assert.equal(citas.length, 1, "Debe detectar 1 cita");
  assert.equal(citas[0].articulo, "75");
  assert.equal(citas[0].sigla, "CN");
}

// Caso 2: Cita con artículo con sufijo bis y conector ("art. 14 bis de la CN")
{
  const citas = v._citas("Se encuentra tutelado en el art. 14 bis de la CN.");
  assert.equal(citas.length, 1, "Debe detectar 1 cita");
  assert.equal(citas[0].articulo, "14 bis");
  assert.equal(citas[0].sigla, "CN");
}

// Caso 3: Cita estándar con coma ("art. 1721, CCyC")
{
  const citas = v._citas("Segun el art. 1721, CCyC se define el factor de atribucion.");
  assert.equal(citas.length, 1, "Debe detectar 1 cita");
  assert.equal(citas[0].articulo, "1721");
  assert.equal(citas[0].sigla, "CCyC");
}

// Caso 4: Cita con nombre extendido del cuerpo ("art. 34 del Código Penal")
{
  const citas = v._citas("A tenor del art. 34 del Codigo Penal no es punible.");
  assert.equal(citas.length, 1, "Debe detectar 1 cita");
  assert.equal(citas[0].articulo, "34");
  assert.equal(citas[0].sigla, "CP");
}

// Caso 5: Verificación global de citas respaldadas vs no respaldadas
{
  const inf = v.verificar("Conforme al art. 75 inc. 22 CN y al art. 9999 CCyC.");
  assert.equal(inf.verificadas.length, 1, "Art 75 CN debe estar verificada");
  assert.equal(inf.no_verificadas.length, 1, "Art 9999 CCyC no debe estar verificada");
  assert.equal(inf.nivel_riesgo, "medio");
}

console.log("✔ Todas las pruebas de VerificadorCitas pasaron correctamente.");
