#!/bin/bash
systemctl --user is-active --quiet iuris || systemctl --user start iuris
for i in $(seq 1 20); do
  curl -sf http://localhost:8888/api/salud >/dev/null && break
  sleep 0.3
done
xdg-open http://localhost:8888
