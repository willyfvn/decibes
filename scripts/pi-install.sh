#!/bin/bash
set -e

# Must run from repo root
if [ ! -f package.json ]; then
  echo "Error: Run this from the decibes repo root"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(pwd)"

# Prompt for configuration
read -p "Enter your deployed app URL (e.g. https://decibes.vercel.app): " APP_URL
read -p "Enter device ID (e.g. pi-restaurant): " DEVICE_ID

# Generate the autostart script with the actual URL and device ID
sed "s|YOUR_DEPLOYED_URL|${APP_URL}|g; s|pi-restaurant|${DEVICE_ID}|g" \
  "$SCRIPT_DIR/pi-autostart.sh" > /tmp/decibes-autostart.sh
chmod +x /tmp/decibes-autostart.sh
cp /tmp/decibes-autostart.sh "$SCRIPT_DIR/pi-autostart.sh"

# Update the service file with the correct repo path and user
CURRENT_USER="$(whoami)"
sed "s|/home/pi/decibes|${REPO_DIR}|g; s|User=pi|User=${CURRENT_USER}|g" \
  "$SCRIPT_DIR/decibes-pi.service" > /tmp/decibes-pi.service

# Install systemd service (needs sudo)
echo ""
echo "Installing systemd service (requires sudo)..."
sudo cp /tmp/decibes-pi.service /etc/systemd/system/decibes-pi.service
sudo systemctl daemon-reload
sudo systemctl enable decibes-pi.service
sudo systemctl start decibes-pi.service

echo ""
echo "Installed successfully!"
echo "  Check status: sudo systemctl status decibes-pi.service"
echo "  View logs:    journalctl -u decibes-pi -f"
echo "  Stop:         sudo systemctl stop decibes-pi.service"
echo "  Disable:      sudo systemctl disable decibes-pi.service"
