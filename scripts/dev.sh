#!/usr/bin/env bash
set -euo pipefail
V='\033[0;32m'; A='\033[1;33m'; N='\033[0m'

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           IURIS — DESARROLLO LOCAL                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo

if [ ! -f .env ]; then
  echo -e "${A}⚠${N} No existe .env"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

set -a; source .env; set +a

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [[ "$ANTHROPIC_API_KEY" == *COMPLETAR* ]]; then
  echo -e "${A}⚠${N} ANTHROPIC_API_KEY sin configurar"
  echo "   El chat no va a funcionar."
  echo "   nano .env"
  echo
fi

if [ -f data/output/iuris.db ]; then
  export LOCAL_DB_PATH="$(pwd)/data/output/iuris.db"
  NART=$(sqlite3 data/output/iuris.db "SELECT COUNT(*) FROM normas" 2>/dev/null || echo "?")
  echo -e "${V}✓${N} Corpus local: $NART articulos"
elif [ -n "${TURSO_DATABASE_URL:-}" ]; then
  echo -e "${V}✓${N} Corpus en Turso"
else
  echo -e "${A}⚠${N} Sin corpus normativo"
  echo "   La app funciona, pero sin anclaje normativo."
  echo "   Para cargarlo:  cd ingesta && python main.py"
  echo
fi

echo
echo "═══════════════════════════════════════════════════════"
echo "  App:    http://localhost:8888"
echo "  Salud:  http://localhost:8888/api/salud"
echo
echo "  Ctrl+C para detener"
echo "═══════════════════════════════════════════════════════"
echo

exec netlify dev
