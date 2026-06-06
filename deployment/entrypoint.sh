#!/bin/sh
set -e

mkdir -p /var/lib/coredns /var/lib/unbound /var/log/unbound /etc/unbound

if [ ! -f /etc/unbound/unbound.conf ]; then
  echo "[entrypoint] Missing /etc/unbound/unbound.conf. Mount coredns/unbound.conf to /etc/unbound/unbound.conf."
  exit 1
fi

if [ ! -f /etc/unbound/unbound_control.key ] || [ ! -f /etc/unbound/unbound_control.pem ] || [ ! -f /etc/unbound/unbound_server.key ] || [ ! -f /etc/unbound/unbound_server.pem ]; then
  echo "[entrypoint] Generating Unbound control keys..."
  unbound-control-setup || true
fi

echo "[entrypoint] Starting Unbound..."
unbound -c /etc/unbound/unbound.conf &
UNBOUND_PID=$!

sleep 2

echo "[entrypoint] Starting CoreDNS..."
coredns -conf /var/lib/coredns/Corefile &
COREDNS_PID=$!

trap 'echo "[entrypoint] Shutting down..."; kill $UNBOUND_PID $COREDNS_PID 2>/dev/null || true; wait $UNBOUND_PID $COREDNS_PID 2>/dev/null || true; exit 0' INT TERM

node src/index.js
AGENT_EXIT_CODE=$?

echo "[entrypoint] Agent exited with code ${AGENT_EXIT_CODE}, stopping services..."
kill $UNBOUND_PID $COREDNS_PID 2>/dev/null || true
wait $UNBOUND_PID $COREDNS_PID 2>/dev/null || true
exit $AGENT_EXIT_CODE
