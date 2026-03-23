#!/bin/bash
# Decibes Pi Auto-Start Script
# Waits for network, then launches Chromium in kiosk mode

# Wait for network connectivity
until ping -c1 google.com &>/dev/null; do
  echo "Waiting for network..."
  sleep 5
done

echo "Network available, launching Chromium..."

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  "https://YOUR_DEPLOYED_URL/?autostart=true&deviceId=pi-restaurant"
