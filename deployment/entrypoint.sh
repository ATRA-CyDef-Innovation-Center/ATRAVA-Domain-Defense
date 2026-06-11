#!/bin/sh
set -e

mkdir -p /var/lib/coredns /var/lib/unbound /var/log/unbound /etc/unbound

if [ ! -f /etc/unbound/unbound.conf ]; then
  echo "[entrypoint] Missing /etc/unbound/unbound.conf. Mount coredns/unbound.conf to /etc/unbound/unbound.conf."
  exit 1
fi

cat > /var/lib/coredns/policies.zone <<'EOF'
# GCOT policy hosts file
EOF

echo "[entrypoint] Checking Unbound configuration..."
unbound-checkconf /etc/unbound/unbound.conf

echo "[entrypoint] Starting Unbound..."
unbound -d -c /etc/unbound/unbound.conf &
UNBOUND_PID=$!

for i in 1 2 3 4 5; do
  if ! kill -0 "$UNBOUND_PID" 2>/dev/null; then
    echo "[entrypoint] Unbound exited before the control interface became ready"
    wait "$UNBOUND_PID"
    exit 1
  fi
  if unbound-control status >/dev/null 2>&1; then
    echo "[entrypoint] Unbound control interface ready"
    break
  fi
  echo "[entrypoint] Waiting for Unbound control interface..."
  sleep 2
done

if ! unbound-control status >/dev/null 2>&1; then
  echo "[entrypoint] Error: Unbound control interface did not become ready"
  exit 1
fi

echo "[entrypoint] Starting CoreDNS..."
coredns -conf /var/lib/coredns/Corefile &
COREDNS_PID=$!

echo "[entrypoint] Starting block page server..."
node src/block-page-server.js &
BLOCK_PAGE_PID=$!

trap 'echo "[entrypoint] Shutting down..."; kill $UNBOUND_PID $COREDNS_PID $BLOCK_PAGE_PID 2>/dev/null || true; wait $UNBOUND_PID $COREDNS_PID $BLOCK_PAGE_PID 2>/dev/null || true; exit 0' INT TERM

node src/index.js
AGENT_EXIT_CODE=$?

echo "[entrypoint] Agent exited with code ${AGENT_EXIT_CODE}, stopping services..."
kill $UNBOUND_PID $COREDNS_PID $BLOCK_PAGE_PID 2>/dev/null || true
wait $UNBOUND_PID $COREDNS_PID $BLOCK_PAGE_PID 2>/dev/null || true
exit $AGENT_EXIT_CODE
