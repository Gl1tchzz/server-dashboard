#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DASHBOARD_PROJECT_DIR:-/opt/docker/example-project}"
BRANCH="${DASHBOARD_PROJECT_BRANCH:-main}"

cd "$APP_DIR"

echo "[1/6] Fetching origin/$BRANCH"
git fetch origin "$BRANCH"

echo "[2/6] Updating working tree"
git reset --hard "origin/$BRANCH"

echo "[3/6] Validating Compose"
docker compose config --quiet

echo "[4/6] Building image"
docker compose build --pull

echo "[5/6] Starting containers"
docker compose up -d --remove-orphans

echo "[6/6] Showing status"
docker compose ps

docker image prune -f
echo "Deployment completed"
