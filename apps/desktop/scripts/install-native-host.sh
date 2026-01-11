#!/bin/bash

# Install Native Messaging Host for Chrome Extension
# This script should be run after installing the Clarity Desktop App

set -e

EXTENSION_ID="${1:-}"
APP_PATH="${2:-/Applications/Clarity.app/Contents/MacOS/Clarity}"

# Chrome Native Messaging Hosts directory
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# Create directory if it doesn't exist
mkdir -p "$CHROME_DIR"

# Manifest file path
MANIFEST_PATH="$CHROME_DIR/com.clarity.app.json"

# If no extension ID provided, use a placeholder
if [ -z "$EXTENSION_ID" ]; then
    echo "⚠️  Warning: No extension ID provided."
    echo "   Usage: $0 <extension_id> [app_path]"
    echo ""
    echo "   You can find the extension ID at chrome://extensions"
    echo "   (Enable Developer mode to see the ID)"
    echo ""
    echo "   Using placeholder for now. You'll need to update the manifest later."
    EXTENSION_ID="YOUR_EXTENSION_ID_HERE"
fi

# Create the manifest
cat > "$MANIFEST_PATH" << EOF
{
  "name": "com.clarity.app",
  "description": "Clarity Desktop App - Native Messaging Host for Chrome Extension",
  "path": "$APP_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✅ Native messaging host manifest installed at:"
echo "   $MANIFEST_PATH"
echo ""
echo "📋 Manifest contents:"
cat "$MANIFEST_PATH"
echo ""
echo ""
echo "🔧 Next steps:"
echo "   1. Make sure the Clarity app is installed at: $APP_PATH"
echo "   2. If you used a placeholder extension ID, update the manifest with the real ID"
echo "   3. Reload the Chrome extension"
echo "   4. The extension should now be able to connect to the desktop app"
