#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.dsa-dev"

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"
BACKEND_LOG_FILE="${RUNTIME_DIR}/backend.log"
FRONTEND_LOG_FILE="${RUNTIME_DIR}/frontend.log"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_KILL_PORT_CONFLICT="${FRONTEND_KILL_PORT_CONFLICT:-1}"
BACKEND_REUSE_IF_RUNNING="${BACKEND_REUSE_IF_RUNNING:-1}"
BACKEND_WAIT_SECONDS="${BACKEND_WAIT_SECONDS:-30}"

mkdir -p "${RUNTIME_DIR}"

pick_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi
  echo ""
}

is_running() {
  local pid="$1"
  kill -0 "${pid}" >/dev/null 2>&1
}

stop_by_pid_file() {
  local pid_file="$1"
  if [[ ! -f "${pid_file}" ]]; then
    return
  fi

  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}"
    return
  fi

  if is_running "${pid}"; then
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if is_running "${pid}"; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "${pid_file}"
}

kill_frontend_port_conflict() {
  local pids
  pids="$(lsof -ti "tcp:${FRONTEND_PORT}" || true)"
  if [[ -z "${pids}" ]]; then
    return
  fi

  echo "[dev-up] 端口 ${FRONTEND_PORT} 已被占用，正在清理进程: ${pids}"
  for pid in ${pids}; do
    kill "${pid}" >/dev/null 2>&1 || true
  done
  sleep 1
  pids="$(lsof -ti "tcp:${FRONTEND_PORT}" || true)"
  if [[ -n "${pids}" ]]; then
    for pid in ${pids}; do
      kill -9 "${pid}" >/dev/null 2>&1 || true
    done
  fi
}

backend_health_ok() {
  curl --silent --fail --max-time 3 "http://${BACKEND_HOST}:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

wait_backend_ready() {
  local total_wait="${1:-30}"
  local waited=0
  while [[ "${waited}" -lt "${total_wait}" ]]; do
    if backend_health_ok; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

PYTHON_BIN="$(pick_python)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[dev-up] 未找到可用 Python（python3/python）。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[dev-up] 未找到 npm，请先安装 Node.js。"
  exit 1
fi

echo "[dev-up] 清理旧进程..."
stop_by_pid_file "${BACKEND_PID_FILE}"
stop_by_pid_file "${FRONTEND_PID_FILE}"

if [[ "${FRONTEND_KILL_PORT_CONFLICT}" == "1" ]]; then
  kill_frontend_port_conflict
fi

if [[ "${BACKEND_REUSE_IF_RUNNING}" == "1" ]] && backend_health_ok; then
  echo "[dev-up] 检测到后端已运行，复用现有服务: http://${BACKEND_HOST}:${BACKEND_PORT}"
else
  echo "[dev-up] 启动后端: ${PYTHON_BIN} main.py --serve-only --host ${BACKEND_HOST} --port ${BACKEND_PORT}"
  (
    cd "${ROOT_DIR}"
    nohup "${PYTHON_BIN}" main.py --serve-only --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" >>"${BACKEND_LOG_FILE}" 2>&1 &
    echo $! >"${BACKEND_PID_FILE}"
  )
  echo "[dev-up] 等待后端健康检查就绪（最多 ${BACKEND_WAIT_SECONDS}s）..."
  if ! wait_backend_ready "${BACKEND_WAIT_SECONDS}"; then
    echo "[dev-up] 后端在等待窗口内未就绪，前端仍会继续启动；请检查日志: ${BACKEND_LOG_FILE}"
  fi
fi

echo "[dev-up] 启动前端: npm run dev -- --host ${FRONTEND_HOST} --port ${FRONTEND_PORT}"
(
  cd "${ROOT_DIR}/apps/dsa-web"
  nohup npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" >>"${FRONTEND_LOG_FILE}" 2>&1 &
  echo $! >"${FRONTEND_PID_FILE}"
)

sleep 2

BACKEND_PID="$(cat "${BACKEND_PID_FILE}" 2>/dev/null || true)"
FRONTEND_PID="$(cat "${FRONTEND_PID_FILE}" 2>/dev/null || true)"

if [[ "${BACKEND_REUSE_IF_RUNNING}" == "1" ]] && backend_health_ok; then
  echo "[dev-up] 后端可用"
elif [[ -n "${BACKEND_PID}" ]] && is_running "${BACKEND_PID}"; then
  echo "[dev-up] 后端已启动 (PID: ${BACKEND_PID})"
else
  echo "[dev-up] 后端启动失败，请查看日志: ${BACKEND_LOG_FILE}"
fi

if [[ -n "${FRONTEND_PID}" ]] && is_running "${FRONTEND_PID}"; then
  echo "[dev-up] 前端已启动 (PID: ${FRONTEND_PID})"
else
  echo "[dev-up] 前端启动失败，请查看日志: ${FRONTEND_LOG_FILE}"
fi

echo "[dev-up] 前端地址: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "[dev-up] 后端地址: http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "[dev-up] 停止服务: bash scripts/dev-down.sh"
