#!/usr/bin/env bash
set -euo pipefail
V='\033[0;32m'; R='\033[0;31m'; A='\033[1;33m'; B='\033[0;34m'; N='\033[0m'

echo "╔═══════════════════════════════════════════════════════╗"
echo "║            IURIS — DEPLOY A NETLIFY                   ║"
echo "╚═══════════════════════════════════════════════════════╝"

[ -f .env ] && { set -a; source .env; set +a; }

echo -e "\n${B}[1/4] Verificaciones${N}"
echo "───────────────────────────────────────────────────────"

if grep -rEq "sk-ant-api[a-zA-Z0-9_-]{20,}" \
   --include="*.js" --include="*.json" --include="*.md" \
   --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null; then
  echo -e "  ${R}⛔ SECRETOS EN EL CODIGO — deploy abortado${N}"
  exit 1
fi
echo -e "  ${V}✓${N} Sin secretos expuestos"

command -v netlify >/dev/null || {
  echo -e "  ${R}✗${N} Netlify CLI no instalado"
  echo "     npm install -g netlify-cli"; exit 1; }
echo -e "  ${V}✓${N} Netlify CLI"

netlify status >/dev/null 2>&1 || netlify login
echo -e "  ${V}✓${N} Autenticado"

echo -e "\n${B}[2/4] Sitio${N}"
echo "───────────────────────────────────────────────────────"
if [ ! -f .netlify/state.json ]; then
  echo "  Sin sitio vinculado."
  echo "    1) Crear uno nuevo"
  echo "    2) Vincular a existente"
  read -rp "  Elegi [1/2]: " -n 1 O; echo
  [ "$O" = "1" ] && netlify sites:create || netlify link
fi
echo -e "  ${V}✓${N} Sitio configurado"

echo -e "\n${B}[3/4] Variables de entorno${N}"
echo "───────────────────────────────────────────────────────"
set_env() {
  [ -n "${2:-}" ] && {
    netlify env:set "$1" "$2" >/dev/null 2>&1
    echo -e "  ${V}✓${N} $1"
  } || echo -e "  ${A}⊘${N} $1 (sin configurar)"
}
set_env ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY:-}"
set_env TURSO_DATABASE_URL "${TURSO_DATABASE_URL:-}"
set_env TURSO_AUTH_TOKEN "${TURSO_AUTH_TOKEN:-}"
set_env MODELO_PRINCIPAL "${MODELO_PRINCIPAL:-claude-sonnet-4-5}"

echo -e "\n${B}[4/4] Desplegando${N}"
echo "───────────────────────────────────────────────────────"
netlify deploy --prod --dir=pwa --functions=netlify/functions

echo
echo "═══════════════════════════════════════════════════════"
echo -e "  ${V}✅ DESPLEGADO${N}"
echo "═══════════════════════════════════════════════════════"
echo
echo "  Verifica con:  netlify open"
echo
