#!/usr/bin/env bash
# Constrói todas as imagens Docker do autograder (uma vez; ~alguns minutos).
# Uso:  bash scripts/build-runners.sh   (ou: LANGS="python java" bash scripts/build-runners.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

LANGS="${LANGS:-python java node typescript go ruby c cpp php rust}"
for lang in $LANGS; do
  echo "── a construir avalia-runner-$lang ──"
  docker build -t "avalia-runner-$lang" -f "runner/Dockerfile.$lang" runner
done
echo "✓ Imagens prontas: $LANGS"
