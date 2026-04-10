#!/bin/bash
# Standing Orders Auto-Submit Script
# Calls the Taylor's Bakery auto-submit endpoint daily

URL="https://taylorsbakery.abacusai.app/api/standing-orders/auto-submit"
AUTH="Authorization: Bearer eca0f37eb2769ff3d7bd32550a345efad0ba878d757bf5cf0b9931ede8854b04"
RUN_DATE=$(date +"%Y-%m-%d")
RUN_TS=$(date +"%Y-%m-%dT%H:%M:%S")
LOG_DIR="/home/ubuntu/standing_orders_logs"
mkdir -p "$LOG_DIR"

RESPONSE_FILE="$LOG_DIR/auto_submit_response_${RUN_DATE}.json"
TMP_FILE=$(mktemp)

HTTP_CODE=$(curl -s -S -o "$TMP_FILE" -w "%{http_code}" -X POST "$URL" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  --connect-timeout 30 \
  --max-time 120)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  cp "$TMP_FILE" "$RESPONSE_FILE"
  PROCESSED=$(python3 -c "import json; print(json.load(open('$TMP_FILE')).get('processed', '?'))" 2>/dev/null || echo "?")
  echo "[$RUN_TS] SUCCESS HTTP=$HTTP_CODE processed=$PROCESSED" >> "$LOG_DIR/auto_submit.log"
  echo "Successfully processed $PROCESSED standing orders at $RUN_TS (HTTP $HTTP_CODE)"
  cat "$RESPONSE_FILE"
else
  echo "[$RUN_TS] ERROR HTTP=$HTTP_CODE" >> "$LOG_DIR/auto_submit_errors.log"
  cat "$TMP_FILE" >> "$LOG_DIR/auto_submit_errors.log"
  echo "ERROR: Auto-submit failed at $RUN_TS with HTTP $HTTP_CODE"
  cat "$TMP_FILE"
  rm -f "$TMP_FILE"
  exit 1
fi

rm -f "$TMP_FILE"
exit 0
