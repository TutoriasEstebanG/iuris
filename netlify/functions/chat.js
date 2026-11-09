/**
 * Iuris — Funcion principal de chat con RAG
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { Retriever } from "./lib/retriever.js";
import { sanitizarContexto, sanitizarAdjunto, verificarSanitizado } from "./lib/sanitizador.js";
import { VerificadorCitas } from "./lib/verificador.js";
import { construirSystemPrompt, formatearContexto, PROMPT_RAG }
  from "./lib/prompts.js";
import { evaluarCobertura } from "./lib/cobertura.js";
import { contextualizarConsulta } from "./lib/contexto.js";
import { DEFINICIONES_HERRAMIENTAS, ejecutarHerramienta } from "./lib/herramientas.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RX_ANCLAJE = /art(?:\.|[íi]culo)|c[óo]digo|ley\s+\d|CCyC|CPCC|norma|vigent|deroga|inciso|regula|establece|dispone|plazo|pena|requisito|elemento/i;
const RX_HERRAMIENTAS = /plazo|vence|vencimiento|c[óo]mputo|d[íi]as\s+h[áa]biles|indemniz|m[ée]ndez|vuotto|inconstitucional|r[úu]brica/i;

function normalizarModelo(nombre, porDefecto) {
  const m = String(nombre || porDefecto || "").trim();
  if (m.includes("3-5-sonnet") || m.includes("sonnet-4-5")) return "claude-sonnet-5";
  if (m.includes("3-5-haiku") || m.includes("haiku-4-5")) return "claude-haiku-5-5";
  return m || porDefecto;
}

export default async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST")
    return json({ error: "Metodo no permitido" }, 405);

  const t0 = Date.now();

  try {
    const { modo = "clase", perfil = {}, mensajes = [], adjunto = null } = await request.json();
    if (!Array.isArray(mensajes) || !mensajes.length)
      return json({ error: "Sin mensajes" }, 400);

    const adjuntoLimpio = sanitizarAdjunto(adjunto);
    const consulta = mensajes[mensajes.length - 1].content;
    if (!consulta || consulta.length > 8000)
      return json({ error: "Consulta invalida" }, 400);

    const consultaContextual = contextualizarConsulta(mensajes);

    // ═══ RECUPERACION ═══
    let contexto = { normas: [], jurisprudencia: [], advertencias: [] };
    let resultado = null;
    const necesita = !["metodo", "plan"].includes(modo) &&
      (RX_ANCLAJE.test(consultaContextual) ||
       ["clase","caso","examen","socratico"].includes(modo));

    if (necesita) {
      try {
        resultado = await new Retriever().recuperar(consultaContextual, { topK: 8 });
        contexto.normas = resultado.documentos || [];
        contexto.jurisprudencia = resultado.jurisprudencia || [];
        for (const d of contexto.normas) {
          if (d.estado === "derogado")
            contexto.advertencias.push({
              nivel: "critica",
              texto: `El art. ${d.articulo} ${d.sigla} esta DEROGADO.`,
            });
        }
      } catch (e) {
        console.error("[chat] recuperacion:", e.message);
      }
    }

    // ═══ SANITIZACION ═══
    const limpio = sanitizarContexto(contexto);
    verificarSanitizado(limpio);

    // ═══ PROMPT ═══
    let system = construirSystemPrompt(modo, perfil);
    const tieneFuentes = (limpio.normas && limpio.normas.length > 0) ||
                         (limpio.jurisprudencia && limpio.jurisprudencia.length > 0);
    system += tieneFuentes
      ? "\n\n" + PROMPT_RAG + "\n\n" +
        formatearContexto(limpio.normas, limpio.advertencias, limpio.jurisprudencia)
      : "\n\n" + formatearContexto([], []);

    // ═══ GUARDRAIL DE COBERTURA ═══
    const cob = evaluarCobertura(consulta);
    if (cob.aviso && !adjuntoLimpio) {
      system += cob.aviso;
      contexto.advertencias.push({
        nivel: "critica",
        texto: `Sin corpus de: ${cob.ramas.join(", ")}. `
             + `La respuesta no esta anclada en fuentes de esa rama.`,
      });
      console.log("[cobertura] ramas ausentes:", cob.ramas.join(","));
    }

    // ═══ INSTRUCCIONES DE DOCUMENTO / TEMARIO ADJUNTO ═══
    if (adjuntoLimpio) {
      system += `\n\n# DOCUMENTO / PROGRAMA ADJUNTO POR EL ESTUDIANTE\n` +
        `El estudiante ha adjuntado el documento: "${adjuntoLimpio.nombre}".\n` +
        `- Utilízalo como fuente y temario primario para guiar la interacción en el modo activo (${modo}).\n` +
        `- Si solicita un RESUMEN o GUÍA DE ESTUDIO: elabóralo con rigor, exhaustividad y claridad pedagógica según las unidades del material, sin retacear la información.\n` +
        `- Si solicita una CLASE o CÁTEDRA: estructura la explicación paso a paso siguiendo el temario del documento.\n` +
        `- En modo Socrático: toma este material como el bolillero/temario rector e interroga al alumno dialécticamente para evaluar su comprensión de cada unidad.\n` +
        `- En modo Examen: simula la mesa examinadora evaluando los puntos de dicho programa.\n` +
        `- En análisis de fallo/pieza: desglosa los antecedentes fácticos, holding y doctrina judicial.\n`;
    }

    // ═══ LLM ═══
    const modPrincipal = normalizarModelo(process.env.MODELO_PRINCIPAL, "claude-sonnet-5");
    const modEconomico = normalizarModelo(process.env.MODELO_ECONOMICO, "claude-haiku-5-5");
    const SIMPLES = ["glosario","fichas","mapa","plan","metodo"];
    const modelo = (!adjuntoLimpio && SIMPLES.includes(modo) && limpio.normas.length < 5)
      ? modEconomico
      : modPrincipal;

    const headersAnthropic = {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };
    if (adjuntoLimpio && adjuntoLimpio.tipo === "application/pdf") {
      headersAnthropic["anthropic-beta"] = "pdfs-2024-09-25";
    }

    let adjuntoInyectado = false;
    const messagesAnthropic = mensajes.slice(-16).map((m, idx, arr) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const txt = String(m.content || "").slice(0, 8000);

      // Inyectar el bloque del documento en el primer mensaje de usuario para mantener persistencia en toda la conversación
      if (role === "user" && adjuntoLimpio && !adjuntoInyectado) {
        adjuntoInyectado = true;
        const bloqueFuente = adjuntoLimpio.tipo === "application/pdf"
          ? {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: adjuntoLimpio.base64,
              },
            }
          : {
              type: "image",
              source: {
                type: "base64",
                media_type: adjuntoLimpio.tipo,
                data: adjuntoLimpio.base64,
              },
            };
        return {
          role,
          content: [
            bloqueFuente,
            { type: "text", text: txt || "Material y temario de estudio adjunto para el análisis y consulta." },
          ],
        };
      }

      return { role, content: txt };
    });

    // ═══ AGENTIC TOOL CALLING ═══
    let herramientaEjecutada = null;
    if (RX_HERRAMIENTAS.test(consultaContextual) && process.env.ANTHROPIC_API_KEY) {
      try {
        const modeloPre = adjuntoLimpio ? modPrincipal : modEconomico;

        const preCall = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: headersAnthropic,
          body: JSON.stringify({
            model: modeloPre,
            max_tokens: 1024,
            system,
            messages: messagesAnthropic,
            tools: DEFINICIONES_HERRAMIENTAS,
          }),
        });

        if (preCall.ok) {
          const preData = await preCall.json();
          const toolUse = preData.content?.find(b => b.type === "tool_use");
          if (toolUse) {
            const toolRes = await ejecutarHerramienta(toolUse.name, toolUse.input);
            herramientaEjecutada = {
              nombre: toolUse.name,
              args: toolUse.input,
              resultado: toolRes,
            };

            messagesAnthropic.push({
              role: "assistant",
              content: [toolUse],
            });
            messagesAnthropic.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolRes),
                },
              ],
            });
          }
        }
      } catch (e) {
        console.error("[tool-use-error]", e.message);
      }
    }

    const up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: headersAnthropic,
      body: JSON.stringify({
        model: modelo,
        max_tokens: 4096,
        system,
        messages: messagesAnthropic,
        stream: true,
      }),
    });

    if (!up.ok) {
      const err = await up.text();
      console.error("[anthropic]", up.status, err.slice(0, 200));
      return json({
        error: "error_llm",
        mensaje: up.status === 429
          ? "Limite de uso alcanzado. Intenta en unos minutos."
          : "Error al generar la respuesta. Verifica la API key.",
      }, up.status === 429 ? 429 : 502);
    }

    return new Response(stream(up.body, limpio, resultado, t0, adjuntoLimpio, herramientaEjecutada), {
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (e) {
    console.error("[chat]", e);
    return json({ error: "error_interno", mensaje: e.message }, 500);
  }
};

function stream(body, contexto, resultado, t0, adjunto = null, herramienta = null) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  return new ReadableStream({
    async start(ctrl) {
      const emit = o => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        if (herramienta) {
          await emit({
            tipo: "herramienta",
            nombre: herramienta.nombre,
            resultado: herramienta.resultado,
          });
        }

        await emit({
          tipo: "contexto",
          adjunto: adjunto ? { nombre: adjunto.nombre, tipo: adjunto.tipo } : null,
          herramienta: herramienta ? { nombre: herramienta.nombre } : null,
          dominio: resultado?.dominio || "general",
          fuentes: contexto.normas.map(d => ({
            id: d.id, sigla: d.sigla, articulo: d.articulo,
            rubrica: d.rubrica, estado: d.estado,
            jerarquia: d.jerarquia, url: d.fuente_url,
          })),
          jurisprudencia: (contexto.jurisprudencia || []).map(j => ({
            id: j.id, autos: j.autos, tribunal: j.tribunal,
            fecha: j.fecha, cita: j.cita_fallos, holding: j.holding,
            url: j.fuente_url,
          })),
          advertencias: contexto.advertencias,
        });

        const reader = body.getReader();
        let buf = "", completo = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lineas = buf.split("\n");
          buf = lineas.pop() || "";
          for (const l of lineas) {
            if (!l.startsWith("data: ")) continue;
            const d = l.slice(6).trim();
            if (d === "[DONE]") continue;
            try {
              const j = JSON.parse(d);
              if (j.type === "content_block_delta" && j.delta?.text) {
                completo += j.delta.text;
                await emit({ delta: j.delta.text });
              }
            } catch {}
          }
        }

        if (contexto.normas.length) {
          const v = new VerificadorCitas(contexto.normas);
          const adv = v.generarAdvertencia(v.verificar(completo));
          if (adv) await emit({ tipo: "verificacion", ...adv });
        }

        await emit({ tipo: "fin", latencia_ms: Date.now() - t0,
                     fuentes: contexto.normas.length });
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (e) {
        await emit({ tipo: "error", mensaje: e.message });
      } finally {
        ctrl.close();
      }
    },
  });
}

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { ...CORS, "Content-Type": "application/json" },
});
