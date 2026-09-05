#!/usr/bin/env python3
"""Genera INSTRUCCIONES.rtf para la version portable de macOS."""
import pathlib

TEXTO = """IURIS — Instalación en macOS
Tutor jurídico con corpus normativo argentino

═══════════════════════════════════════════════

QUÉ ES

Iuris es una herramienta de consulta sobre normativa argentina. Corre
localmente en tu computadora y responde preguntas citando los artículos
del corpus cargado.

Corpus incluido:
  •  Código Civil y Comercial de la Nación — 2.674 artículos
  •  Constitución Nacional — 148 unidades (incluye disposiciones transitorias)
  •  Código Penal de la Nación — 382 artículos

Total: 3.188 unidades normativas verificadas contra InfoLeg.

═══════════════════════════════════════════════

ANTES DE EMPEZAR

Necesitás dos cosas:

1) Node.js versión 20 o superior
   Descargalo de https://nodejs.org
   Elegí el instalador .pkg para macOS (Apple Silicon).
   Instalación estándar, siguiente-siguiente.

2) Una clave de API de Anthropic
   Entrá a https://console.anthropic.com
   Creá una cuenta y cargá crédito.

   IMPORTANTE: la clave de API es distinta de una suscripción a
   Claude.ai. Aunque tengas Claude Pro, necesitás cuenta de consola
   con saldo. El consumo se cobra por uso.

═══════════════════════════════════════════════

INSTALACIÓN — PASO A PASO

PASO 1. Descomprimir
Doble clic en iuris-portable.zip. Se crea la carpeta iuris-portable.
Movela donde quieras tenerla, por ejemplo a Documentos.

PASO 2. Crear el archivo de configuración
Abrí la carpeta. Vas a ver un archivo llamado .env.ejemplo

  •  Si no lo ves, presioná Comando + Shift + Punto para mostrar
     archivos ocultos.
  •  Duplicalo (clic derecho > Duplicar).
  •  Renombrá la copia como .env (sin extensión, sin "ejemplo").

PASO 3. Poner la clave
Abrí .env con TextEdit (clic derecho > Abrir con > TextEdit).
Reemplazá la línea que dice:

    ANTHROPIC_API_KEY=sk-ant-...

por tu clave real. Debe quedar sin espacios ni comillas, así:

    ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx

Guardá con Comando + S y cerrá.

PASO 4. Primer arranque
Doble clic en iniciar.command

macOS va a bloquearlo la primera vez con un aviso de seguridad.
Es normal: el archivo no está firmado digitalmente.

Para autorizarlo:
  •  Clic derecho sobre iniciar.command
  •  Elegí "Abrir"
  •  En el diálogo, clic en "Abrir" otra vez

Se abre una ventana de Terminal. La primera vez tarda uno o dos
minutos instalando dependencias. Vas a ver texto corriendo.

Cuando termine, se abre el navegador en http://localhost:8888

═══════════════════════════════════════════════

USO DIARIO

Doble clic en iniciar.command
El navegador se abre solo.

Para cerrarlo: cerrá la ventana de Terminal, o presioná
Control + C dentro de ella.

Mientras la Terminal esté abierta, Iuris funciona. Si la cerrás,
se detiene.

═══════════════════════════════════════════════

CÓMO LEER LAS RESPUESTAS

Al pie de cada respuesta aparece una sección de verificación:

  •  "Sin respaldo en el corpus" — el sistema citó un artículo que
     no está en la base. Verificalo en la fuente oficial antes de usarlo.

  •  "Leyes citadas que NO están en el corpus" — mencionó leyes cuyo
     texto no tiene cargado. No confíes en el número ni el contenido.

  •  "Citas textuales que no coinciden" — reprodujo un texto que no
     coincide con el corpus. Es una señal de alerta fuerte.

Si consultás sobre una rama que no está cargada (laboral, procesal,
administrativo, tributario), el sistema lo advierte al inicio y acota
la respuesta. No inventa desarrollo extenso.

═══════════════════════════════════════════════

LIMITACIONES

Esta herramienta sirve para LOCALIZAR normas rápido y ver cómo se
articulan entre sí. La doctrina que agrega alrededor no está verificada
y puede contener errores: atribuciones de fallos equivocadas,
denominaciones desactualizadas, construcciones forzadas.

Usala para encontrar el artículo. Para entenderlo, andá al manual.

Contenido con fines exclusivamente académicos. No constituye
asesoramiento jurídico profesional. Las normas se reforman:
verificá siempre en la publicación oficial.

═══════════════════════════════════════════════

PROBLEMAS FRECUENTES

"No se puede abrir porque proviene de un desarrollador no identificado"
   Clic derecho sobre el archivo > Abrir > Abrir.

"command not found: node"
   Node.js no está instalado o no quedó en el PATH.
   Reinstalalo desde nodejs.org y reiniciá la Terminal.

"Falta el archivo .env"
   No creaste el .env o quedó nombrado mal.
   Verificá que se llame exactamente .env, no .env.txt ni env.

Error 401 o "authentication_error"
   La clave de API está mal copiada o la cuenta no tiene crédito.
   Revisá en console.anthropic.com

El puerto 8888 está ocupado
   Otra aplicación lo está usando. Cerrala, o editá el archivo .env
   agregando una línea: PORT=8899

La página queda en blanco
   Esperá unos segundos y recargá. El servidor puede tardar en
   levantar la primera vez.

═══════════════════════════════════════════════

ACTUALIZAR EL CORPUS

El corpus incluido es una foto del momento en que se armó el paquete.
Si se reforma una norma, hay que regenerar la base desde la máquina
donde está el proyecto completo y volver a empaquetar.

═══════════════════════════════════════════════

Licencia AGPL-3.0 para uso académico.
"""


def a_rtf(texto):
    out = []
    for ch in texto:
        o = ord(ch)
        if ch == "\n":
            out.append("\\par\n")
        elif ch == "\\":
            out.append("\\\\")
        elif ch in "{}":
            out.append("\\" + ch)
        elif o < 128:
            out.append(ch)
        else:
            out.append(f"\\u{o if o < 32768 else o - 65536}?")
    return "".join(out)


rtf = ("{\\rtf1\\ansi\\ansicpg1252\\deff0\n"
       "{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\fmodern Menlo;}}\n"
       "\\fs22\\sa120\n" + a_rtf(TEXTO) + "\n}")

RAIZ = pathlib.Path(__file__).resolve().parent.parent
for destino in (RAIZ / "docs" / "INSTRUCCIONES-MAC.rtf",
                pathlib.Path("/tmp/iuris-portable/INSTRUCCIONES.rtf")):
    if destino.parent.exists():
        destino.write_text(rtf, encoding="ascii")
        print(f"escrito: {destino}")
