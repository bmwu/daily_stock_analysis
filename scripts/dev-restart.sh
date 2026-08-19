#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[dev-restart] stopping services..."
bash "${SCRIPT_DIR}/dev-down.sh"

echo "[dev-restart] starting services..."
bash "${SCRIPT_DIR}/dev-up.sh"

echo "[dev-restart] done."
