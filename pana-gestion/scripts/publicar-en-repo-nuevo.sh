#!/usr/bin/env bash
#
# Publica pana-gestion/ como su propio repositorio, conservando el historial.
#
# PANA Gestión se construyó dentro del repositorio del portfolio porque la
# sesión donde se escribió no tenía permiso para crear repositorios. Este
# script hace la mudanza en un paso, sin perder los commits.
#
# Se corre UNA VEZ, desde una copia local del repositorio del portfolio, en una
# máquina con sesión de GitHub iniciada:
#
#   ./pana-gestion/scripts/publicar-en-repo-nuevo.sh benzprog/pana-gestion
#
# Qué hace:
#   1. Extrae el historial de la carpeta pana-gestion/ como si siempre hubiera
#      sido la raíz de su propio repositorio.
#   2. Crea el repositorio en GitHub (privado) si todavía no existe.
#   3. Sube esa historia a la rama principal.
#
set -euo pipefail

DESTINO="${1:-}"
if [ -z "$DESTINO" ]; then
  echo "Uso: $0 <owner/repo>    por ejemplo: $0 benzprog/pana-gestion" >&2
  exit 2
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

if [ ! -d pana-gestion ]; then
  echo "No encuentro la carpeta pana-gestion/ en $RAIZ" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin commitear. Guardalos antes de mudar el proyecto." >&2
  exit 1
fi

echo "→ extrayendo el historial de pana-gestion/"
# Deja los commits que tocaron esa carpeta, con las rutas ya relativas a la raíz.
RAMA_TEMP="publicar-pana-gestion-$$"
git subtree split --prefix=pana-gestion -b "$RAMA_TEMP" >/dev/null

TRABAJO="$(mktemp -d)"
trap 'rm -rf "$TRABAJO"; git branch -D "$RAMA_TEMP" >/dev/null 2>&1 || true' EXIT

echo "→ armando el repositorio nuevo en $TRABAJO"
git clone --quiet --branch "$RAMA_TEMP" --single-branch "$RAIZ" "$TRABAJO/pana-gestion"
cd "$TRABAJO/pana-gestion"
git branch -m "$RAMA_TEMP" main
git remote remove origin

if command -v gh >/dev/null 2>&1; then
  if gh repo view "$DESTINO" >/dev/null 2>&1; then
    echo "→ el repositorio $DESTINO ya existe: subo ahí"
  else
    echo "→ creando $DESTINO (privado)"
    gh repo create "$DESTINO" --private \
      --description "PANA Gestión — sistema interno de gestión de PANA Iluminación"
  fi
else
  cat >&2 <<TXT

No encontré la herramienta gh. Creá el repositorio a mano en
https://github.com/new  (nombre: ${DESTINO#*/}, privado, sin README) y volvé a
correr este script.

TXT
  exit 1
fi

git remote add origin "https://github.com/$DESTINO.git"
git push -u origin main

cat <<TXT

Listo. PANA Gestión vive ahora en https://github.com/$DESTINO

Lo que sigue, dentro del repositorio nuevo:
  pnpm install
  cp .env.example .env.local      # completar (ver README.md)
  pnpm dev

La carpeta pana-gestion/ del portfolio quedó intacta. Cuando confirmes que el
repositorio nuevo está bien, se puede borrar de allá con:
  git rm -r pana-gestion && git commit -m "Mover PANA Gestión a su propio repositorio"
TXT
