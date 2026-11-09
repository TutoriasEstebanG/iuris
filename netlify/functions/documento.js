/**
 * Iuris — Endpoint especializado para análisis multimodal de piezas judiciales y documentos
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { sanitizarAdjunto } from "./lib/sanitizador.js";
import { PROMPT_ANALISIS_DOCUMENTO } from "./lib/prompts.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizarModelo(nombre, porDefecto) {
  const m = String(nombre || porDefecto || "").trim();
  if (m.includes("3-5-sonnet") || m.includes("sonnet-4-5")) return "claude-sonnet-5";
  if (m.includes("3-5-haiku") || m.includes("haiku-4-5")) return "claude-haiku-5-5";
  return m || porDefecto;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST")
    return json({ error: "Metodo no permitido" }, 405);

  try {
    const { documento, instruccion = "", perfil = {} } = await request.json();

    const docLimpio = sanitizarAdjunto(documento);
    if (!docLimpio) {
      return json({
        error: "documento_invalido",
        mensaje: "Debe suministrarse un archivo PDF o imagen válido (JPEG, PNG, WEBP) menor a 10MB.",
      }, 400);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return json({
        error: "sin_api_key",
        mensaje: "Servicio no disponible: ANTHROPIC_API_KEY no configurada.",
      }, 503);
    }

    const bloqueDoc = docLimpio.tipo === "application/pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: docLimpio.base64,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: docLimpio.tipo,
            data: docLimpio.base64,
          },
        };

    const headersAnthropic = {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };
    if (docLimpio.tipo === "application/pdf") {
      headersAnthropic["anthropic-beta"] = "pdfs-2024-09-25";
    }

    const promptContexto = `
${PROMPT_ANALISIS_DOCUMENTO}
# PERFIL ACADÉMICO
- Jurisdicción: ${perfil.jurisdiccion || "Nacional / Federal"}
- Materia: ${perfil.materia || "General"}
- Nivel: ${perfil.nivel || "intermedio"}

# INSTRUCCIÓN ESPECÍFICA DEL ESTUDIANTE
${instruccion.trim() || "Realizar el análisis integral y la ficha procesal completa de la pieza adjunta."}
`;

    const up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: headersAnthropic,
      body: JSON.stringify({
        model: normalizarModelo(process.env.MODELO_PRINCIPAL, "claude-sonnet-5"),
        max_tokens: 4096,
        system: promptContexto,
        messages: [
          {
            role: "user",
            content: [
              bloqueDoc,
              {
                type: "text",
                text: instruccion.trim() || "Analizar detenidamente esta pieza judicial y generar la ficha académica.",
              },
            ],
          },
        ],
        stream: true,
      }),
    });

    if (!up.ok) {
      const err = await up.text();
      console.error("[documento-anthropic]", up.status, err.slice(0, 200));
      return json({
        error: "error_llm",
        mensaje: up.status === 429
          ? "Límite de uso alcanzado. Reintenta en unos minutos."
          : "Error al procesar el documento.",
      }, up.status === 429 ? 429 : 502);
    }

    const enc = new TextEncoder(), dec = new TextDecoder();
    const streamRes = new ReadableStream({
      async start(ctrl) {
        const emit = o => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        try {
          await emit({
            tipo: "documento_iniciado",
            documento: {
              nombre: docLimpio.nombre,
              tipo: docLimpio.tipo,
            },
          });

          const reader = up.body.getReader();
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lineas = buf.split("\n");
            buf = lineas.pop();

            for (const linea of lineas) {
              if (!linea.startsWith("data: ")) continue;
              const jsonStr = linea.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const ev = JSON.parse(jsonStr);
                if (ev.type === "content_block_delta" && ev.delta?.text) {
                  await emit({ tipo: "delta", texto: ev.delta.text });
                }
              } catch {}
            }
          }
          await emit({ tipo: "fin" });
          ctrl.close();
        } catch (e) {
          console.error("[documento-stream]", e);
          ctrl.error(e);
        }
      },
    });

    return new Response(streamRes, {
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (e) {
    console.error("[documento]", e);
    return json({ error: "error_interno", mensaje: e.message }, 500);
  }
};
