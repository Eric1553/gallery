#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.fde-server.pid"
LOG_FILE="$DIR/.fde-server.log"
PORT=8765

health_ok() {
  local port="$1"
  curl -sf --max-time 2 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1
}

read_pid_file() {
  if [[ -f "$PID_FILE" ]]; then
    sed -n '1p' "$PID_FILE"
  fi
}

read_port_file() {
  if [[ -f "$PID_FILE" ]]; then
    sed -n '2p' "$PID_FILE"
  fi
}

stop_stale() {
  local pid port
  pid="$(read_pid_file || true)"
  port="$(read_port_file || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    if [[ -n "${port:-}" ]] && health_ok "$port"; then
      echo "服务已在运行 (PID $pid, 端口 $port)"
      open "http://127.0.0.1:${port}/"
      exit 0
    fi
    echo "发现僵死进程 PID $pid，正在清理…"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi

  for p in $(seq 8765 8774); do
    if health_ok "$p"; then
      echo "服务已在运行 (端口 $p)"
      open "http://127.0.0.1:${p}/"
      exit 0
    fi
    pid="$(lsof -t -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      echo "清理占用端口 $p 的无响应进程 (PID $pid)…"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

start_server() {
  cd "$DIR"
  nohup python3 server.py --no-open >>"$LOG_FILE" 2>&1 &
  sleep 1

  for _ in {1..10}; do
    for p in $(seq 8765 8774); do
      if health_ok "$p"; then
        echo "服务启动成功: http://127.0.0.1:${p}/"
        open "http://127.0.0.1:${p}/"
        return 0
      fi
    done
    sleep 0.5
  done

  echo "服务启动失败，最近日志："
  tail -20 "$LOG_FILE" 2>/dev/null || true
  exit 1
}

case "${1:-start}" in
  start)
    stop_stale
    start_server
    ;;
  stop)
    pid="$(read_pid_file || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "已停止 PID $pid"
    else
      echo "未发现运行中的服务"
    fi
    rm -f "$PID_FILE"
    ;;
  status)
    port="$(read_port_file || true)"
    pid="$(read_pid_file || true)"
    if [[ -n "${port:-}" ]] && health_ok "$port"; then
      echo "运行中: PID ${pid:-?}, 端口 $port"
      curl -s "http://127.0.0.1:${port}/api/health"
      echo
    else
      echo "未运行或健康检查失败"
      exit 1
    fi
    ;;
  *)
    echo "用法: $0 [start|stop|status]"
    exit 1
    ;;
esac
