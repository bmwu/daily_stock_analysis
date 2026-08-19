#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.dsa-dev"

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"

is_running() {
  local pid="$1"
  kill -0 "${pid}" >/dev/null 2>&1
}

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "${pid_file}" ]]; then
    echo "[dev-down] ${name}: 未发现 pid 文件，跳过。"
    return
  fi

  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    echo "[dev-down] ${name}: pid 文件为空，已清理。"
    rm -f "${pid_file}"
    return
  fi

  if is_running "${pid}"; then
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if is_running "${pid}"; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
    echo "[dev-down] ${name}: 已停止 (PID: ${pid})"
  else
    echo "[dev-down] ${name}: 进程不存在 (PID: ${pid})"
  fi

  rm -f "${pid_file}"
}

stop_by_pid_file "后端" "${BACKEND_PID_FILE}"
stop_by_pid_file "前端" "${FRONTEND_PID_FILE}"
echo "[dev-down] 完成。"
