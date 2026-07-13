#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DASHBOARD_PROJECT_DIR:?DASHBOARD_PROJECT_DIR is required}"
BRANCH="${DASHBOARD_PROJECT_BRANCH:-main}"
PROJECT_NAME="${DASHBOARD_PROJECT_NAME:-project}"

echo "Deploying ${PROJECT_NAME}"
echo "Directory: ${APP_DIR}"
echo "Branch: ${BRANCH}"

cd "$APP_DIR"

if [ ! -d ".git" ]; then
  echo "The project directory is not a Git checkout: ${APP_DIR}" >&2
  exit 10
fi

echo "[1/7] Fetching origin/${BRANCH}"
git fetch --prune origin "$BRANCH"

echo "[2/7] Updating working tree"
git reset --hard "origin/${BRANCH}"

echo "[3/7] Validating Docker Compose"
docker compose config --quiet

echo "[4/7] Pulling published images when available"
docker compose pull --ignore-pull-failures || true

echo "[5/7] Building images"
docker compose build --pull

echo "[6/7] Starting containers"
docker compose up -d --remove-orphans

echo "[7/7] Current status"
docker compose ps

docker image prune -f
echo "Deployment completed"
