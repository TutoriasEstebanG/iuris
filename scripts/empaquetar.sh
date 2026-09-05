#!/bin/bash
# Genera un ZIP portable de Iuris (sin node_modules ni secretos)
set -e
cd "$(dirname "$0")/.."
DEST="/tmp/iuris-portable"
rm -rf "$DEST"; mkdir -p "$DEST"

cp -r pwa netlify servidor.js package.json "$DEST/"
mkdir -p "$DEST/data/output"
cp data/output/iuris.db "$DEST/data/output/"
rm -rf "$DEST/netlify/functions/node_modules"
find "$DEST" -name "*.bak*" -delete
find "$DEST" -name "*.pyc" -delete

cat > "$DEST/.env.ejemplo" <<'ENV'
ANTHROPIC_API_KEY=sk-ant-...
LOCAL_DB_PATH=./data/output/iuris.db
MODELO_PRINCIPAL=claude-sonnet-4-5
MODELO_ECONOMICO=claude-haiku-4-5
ENV

cat > "$DEST/iniciar.command" <<'SH'
#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Falta Node.js. Instalalo desde https://nodejs.org (version 20 o superior)"
  read -p "Enter para cerrar"; exit 1
fi
if [ ! -f .env ]; then
  echo "Falta el archivo .env"
  echo "Copiá .env.ejemplo como .env y poné tu API key de console.anthropic.com"
  read -p "Enter para cerrar"; exit 1
fi
if [ ! -d node_modules ]; then
  echo "Instalando dependencias (solo la primera vez)..."
  npm install --omit=dev || { read -p "Error. Enter para cerrar"; exit 1; }
fi
echo "Iuris corriendo en http://localhost:8888"
echo "Cerrá esta ventana para detenerlo."
sleep 1 && open http://localhost:8888 &
node servidor.js
SH
chmod +x "$DEST/iniciar.command"

cat > "$DEST/LEEME.txt" <<'TXT'
IURIS — version portable para macOS

1. Instalar Node.js 20+ desde https://nodejs.org (si no lo tenés)
2. Copiar .env.ejemplo como .env
3. Editar .env y poner tu API key de https://console.anthropic.com
4. Doble clic en iniciar.command

La primera vez tarda: instala dependencias.
Si macOS bloquea el archivo: clic derecho > Abrir > Abrir igual.

Corpus incluido: CCyC, Constitucion Nacional, Codigo Penal.
Contenido academico. Verificar siempre en fuente oficial.
TXT

python3 "$(dirname "$0")/generar_instructivo.py" >/dev/null
cd /tmp && rm -f iuris-portable.zip && zip -qr iuris-portable.zip iuris-portable
echo "Listo: /tmp/iuris-portable.zip ($(du -h /tmp/iuris-portable.zip | cut -f1))"
