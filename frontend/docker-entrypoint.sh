#!/bin/sh
set -e

# Create a runtime config.json for the SPA to consume.
# If VITE_API_URL isn't provided, fall back to build-time value (or localhost).
: ${VITE_API_URL:=}

TARGET=/usr/share/nginx/html/config.json
echo '{' > $TARGET
echo "  \"VITE_API_URL\": \"${VITE_API_URL}\"" >> $TARGET
echo '}' >> $TARGET

exec nginx -g 'daemon off;'
