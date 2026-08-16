#!/bin/bash
set -e

echo "=========================================================="
echo "  🧭 FindMy Android Bridge - macOS Setup & Launcher"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Please install Node.js (via Homebrew: 'brew install node' or from https://nodejs.org)."
    exit 1
fi

echo "✅ Node.js version $(node -v) detected."

# Check npm dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
else
    echo "✅ Dependencies already installed."
fi

# Ensure .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating default .env from .env.example..."
    cp .env.example .env
fi

# Check Find My cache access
CACHE_DIR="$HOME/Library/Caches/com.apple.findmy.fmipcore"
echo ""
echo "🔍 Checking macOS Find My cache permissions..."
if [ -d "$CACHE_DIR" ]; then
    echo "✅ Found Find My cache directory at $CACHE_DIR"
    if [ -r "$CACHE_DIR/Items.data" ]; then
        echo "✅ Successfully read Items.data"
    else
        echo "⚠️  Note: Items.data not yet found or needs permissions."
        echo "   Make sure Full Disk Access is enabled for Terminal/Node in:"
        echo "   System Settings > Privacy & Security > Full Disk Access"
    fi
else
    echo "⚠️  Directory $CACHE_DIR does not exist yet."
    echo "   Open the Apple 'Find My' app once to generate cache data."
fi

echo ""
echo "=========================================================="
echo "  🚀 How would you like to run the bridge?"
echo "=========================================================="
echo "1) Start in current terminal (Foreground)"
echo "2) Install as background macOS Service (launchd Auto-Start on Boot)"
echo "3) Remove background macOS Service"
echo "4) Exit"
echo ""
read -p "Select an option [1-4]: " CHOICE

PLIST_NAME="com.findmy.androidbridge"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

case $CHOICE in
  1)
    echo "Starting FindMy Bridge..."
    node server/index.js
    ;;
  2)
    echo "Configuring launchd background service..."
    NODE_PATH=$(which node)
    mkdir -p "$HOME/Library/LaunchAgents"

    cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${PROJECT_ROOT}/server/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/findmy-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/findmy-bridge-err.log</string>
</dict>
</plist>
EOF

    # Load launchd service
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "✅ FindMy Bridge is now running in the background and will start automatically on Mac boot!"
    echo "   Logs: /tmp/findmy-bridge.log"
    echo ""
    echo "🌐 Tailscale Funnel Quick Command (to share to Android):"
    echo "   tailscale funnel 3000"
    ;;
  3)
    echo "Stopping and removing background service..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "✅ Background service removed."
    ;;
  *)
    echo "Done."
    ;;
esac
