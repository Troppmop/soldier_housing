#!/bin/sh
set -e

# Write runtime config.json using env if provided; leave existing file if not.
OUT=/usr/share/app/dist/config.json
if [ -n "$VITE_API_URL" ]; then
  echo '{' > "$OUT"
  echo "  \"VITE_API_URL\": \"$VITE_API_URL\"" >> "$OUT"
  echo '}' >> "$OUT"
fi

# Start static server (no nginx). Respect Railway/Heroku $PORT if present.
PORT_TO_USE=${PORT:-80}
exec serve -s /usr/share/app/dist -l "$PORT_TO_USE"
