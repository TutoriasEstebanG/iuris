import { Retriever } from "../netlify/functions/lib/retriever.js";
const q = process.argv.slice(2).join(" ");
const r = await new Retriever().recuperar(q);
console.log(`consulta: ${q}\n`);
r.documentos.forEach((d, i) =>
  console.log(`${String(i+1).padStart(2)}. ${d.sigla.padEnd(5)} art ${String(d.articulo).padEnd(9)} `
    + `score=${d.score.toFixed(1).padStart(6)} via=${d.via}  ${(d.rubrica||d.texto).slice(0,45)}`));
