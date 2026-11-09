import assert from "node:assert/strict";
import { MODOS } from "../netlify/functions/lib/prompts.js";

console.log("▶ Iniciando pruebas de Mejoras Pedagógicas y Experiencia de Usuario...");

// 1. Verificación de Modo Cátedra a Demanda
{
  assert.ok(MODOS.catedra, "Debe existir el modo 'catedra'");
  assert.equal(MODOS.catedra.nombre, "Cátedra a Demanda");
  assert.ok(MODOS.catedra.prompt.includes("Índice Temático"));
  assert.ok(MODOS.catedra.prompt.includes("PREGUNTA DE CONTROL"));
  assert.ok(MODOS.catedra.prompt.includes("Dosifica el conocimiento"));
}

// 2. Parser de Fichas (Anverso / Reverso y CSV)
{
  function parsearFichas(texto) {
    var fichas = [];
    var rxAnversoReverso = /\*\*\[?(\d+)?\]?\s*ANVERSO\*\*([\s\S]*?)\*\*REVERSO\*\*([\s\S]*?)(?:(?=\*\*\[?\d*\]?\s*ANVERSO)|(?=\*Etiquetas)|(?=```csv)|$)/gi;
    var m;
    while ((m = rxAnversoReverso.exec(texto)) !== null) {
      var anverso = m[2].replace(/^[-–—\s]+/, "").trim();
      var reverso = m[3].replace(/^[-–—\s]+/, "").trim();
      if (anverso && reverso) {
        fichas.push({ anverso, reverso });
      }
    }
    if (!fichas.length) {
      var rxCsv = /```csv\s*([\s\S]*?)```/i;
      var mCsv = rxCsv.exec(texto);
      if (mCsv) {
        var lineas = mCsv[1].split("\n");
        for (var i = 0; i < lineas.length; i++) {
          var l = lineas[i].trim();
          if (!l || l.toLowerCase().startsWith("anverso;")) continue;
          var cols = l.split(";");
          if (cols.length >= 2) {
            fichas.push({ anverso: cols[0].trim(), reverso: cols[1].trim() });
          }
        }
      }
    }
    return fichas;
  }

  const textoMarkdown = `
## Fichas de Estudio

---
**[1] ANVERSO**
¿Qué es la lesión enorme en el acto jurídico?

**REVERSO**
Desproporción evidente y sin justificación en las prestaciones (Art. 332 CCyC).

*Etiquetas:* #civil #vicios
---

**[2] ANVERSO**
¿Cuál es el plazo de prescripción de la acción por vicio de lesión?

**REVERSO**
Dos años computados desde la fecha en que la obligación a cargo del lesionado debió ser cumplida (Art. 2562 inc. b CCyC).
---
`;

  const fichas = parsearFichas(textoMarkdown);
  assert.equal(fichas.length, 2, "Debe parsear exactamente 2 fichas");
  assert.ok(fichas[0].anverso.includes("lesión enorme"));
  assert.ok(fichas[0].reverso.includes("Art. 332 CCyC"));
  assert.ok(fichas[1].anverso.includes("prescripción"));
  assert.ok(fichas[1].reverso.includes("Dos años"));

  const textoCsv = `
\`\`\`csv
Anverso;Reverso;Etiquetas
Presuncion de inocencia;Garantia constitucional art. 18 CN;#penal
Principio de legalidad;Nullum crimen sine lege previa;#penal
\`\`\`
`;
  const fichasCsv = parsearFichas(textoCsv);
  assert.equal(fichasCsv.length, 2);
  assert.equal(fichasCsv[0].anverso, "Presuncion de inocencia");
}

// 3. Verificación de cálculo SM-2 de repetición espaciada
{
  function computarSM2(item, calidad) {
    const copia = { ...item };
    if (calidad < 2) {
      copia.reps = 0;
      copia.interval = 1;
    } else {
      if (copia.reps === 0) copia.interval = 1;
      else if (copia.reps === 1) copia.interval = 6;
      else copia.interval = Math.round(copia.interval * copia.ease);
      copia.reps++;
    }
    copia.ease = Math.max(1.3, copia.ease + (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02)));
    return copia;
  }

  const inicio = { reps: 0, interval: 1, ease: 2.5 };

  // Calificación fácil (5)
  const paso1 = computarSM2(inicio, 5);
  assert.equal(paso1.reps, 1);
  assert.equal(paso1.interval, 1);
  assert.ok(paso1.ease >= 2.5);

  const paso2 = computarSM2(paso1, 5);
  assert.equal(paso2.reps, 2);
  assert.equal(paso2.interval, 6);

  // Olvido (0)
  const olvido = computarSM2(paso2, 0);
  assert.equal(olvido.reps, 0);
  assert.equal(olvido.interval, 1);
}

console.log("✔ Todas las pruebas de Mejoras Pedagógicas pasaron exitosamente.");
