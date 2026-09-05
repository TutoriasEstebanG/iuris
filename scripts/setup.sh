#!/usr/bin/env bash
set -euo pipefail
V='\033[0;32m'; A='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; N='\033[0m'

echo "╔═══════════════════════════════════════════════════════╗"
echo "║              IURIS — CONFIGURACION                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo

# ── Node ──
echo -e "${B}[1/5] Node.js${N}"
if command -v node >/dev/null 2>&1; then
  NV=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NV" -ge 20 ]; then
    echo -e "  ${V}✓${N} Node.js $(node -v)"
  else
    echo -e "  ${A}⚠${N} Node.js $(node -v) — se requiere 20+"
    echo "     Instalando Node 20…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y -qq nodejs
    echo -e "  ${V}✓${N} Node.js $(node -v)"
  fi
else
  echo "  Instalando Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y -qq nodejs
  echo -e "  ${V}✓${N} Node.js $(node -v)"
fi

# ── Netlify CLI ──
echo -e "\n${B}[2/5] Netlify CLI${N}"
if command -v netlify >/dev/null 2>&1; then
  echo -e "  ${V}✓${N} Ya instalado"
else
  echo "  Instalando…"
  sudo npm install -g netlify-cli --silent 2>/dev/null || \
    npm install -g netlify-cli --silent
  echo -e "  ${V}✓${N} Netlify CLI instalado"
fi

# ── Dependencias ──
echo -e "\n${B}[3/5] Dependencias del proyecto${N}"
npm install --silent
(cd netlify/functions && npm install --silent)
echo -e "  ${V}✓${N} Instaladas"

# ── Python (opcional) ──
echo -e "\n${B}[4/5] Python (para la ingesta del corpus)${N}"
if command -v python3 >/dev/null 2>&1; then
  echo -e "  ${V}✓${N} Python $(python3 -V | cut -d' ' -f2)"
  if [ -f ingesta/requirements.txt ]; then
    [ -d .venv ] || python3 -m venv .venv
    source .venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r ingesta/requirements.txt
    echo -e "  ${V}✓${N} Entorno virtual listo"
  fi
else
  echo -e "  ${A}⚠${N} Python 3 no instalado (opcional)"
  echo "     Solo hace falta para generar el corpus normativo"
fi

# ── .env ──
echo -e "\n${B}[5/5] Variables de entorno${N}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "  ${A}⚠${N} .env creado desde plantilla"
  echo
  echo "     ┌────────────────────────────────────────────────┐"
  echo "     │  FALTA CONFIGURAR LA API KEY                   │"
  echo "     └────────────────────────────────────────────────┘"
  echo
  echo "     1. Obtenela en:"
  echo "        https://console.anthropic.com/settings/keys"
  echo
  echo "     2. Configura un LIMITE DE GASTO:"
  echo "        https://console.anthropic.com/settings/limits"
  echo
  echo "     3. Editala:"
  echo "        nano .env"
  echo
else
  set -a; source .env 2>/dev/null || true; set +a
  if [ -n "${ANTHROPIC_API_KEY:-}" ] && [[ "$ANTHROPIC_API_KEY" == sk-ant-* ]]; then
    echo -e "  ${V}✓${N} ANTHROPIC_API_KEY configurada"
  else
    echo -e "  ${A}⚠${N} ANTHROPIC_API_KEY sin configurar"
    echo "     nano .env"
  fi
fi

echo
echo "═══════════════════════════════════════════════════════"
echo -e "  ${V}CONFIGURACION COMPLETADA${N}"
echo "═══════════════════════════════════════════════════════"
echo
echo "  Siguiente paso:"
echo
echo "    ./scripts/dev.sh"
echo "    → http://localhost:8888"
echo
