# Clarity Browser Extension

Chrome/Edge/Brave extension for intelligent distraction blocking.

## Development Setup

### Install dependencies

```bash
cd apps/extension
npm install
```

### Build

```bash
# Development build (with watch)
npm run dev

# Production build
npm run build
```

The extension will be built to `dist/` directory.

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` directory
5. The extension should now be loaded!

### Test

1. Navigate to a blocked site (e.g., twitter.com, reddit.com)
2. You should see the block screen
3. Try the bypass options
4. Check the extension popup (click extension icon in toolbar)

## Architecture

See [../../../docs/browser-extension.md](../../../docs/browser-extension.md) for full documentation.

### Structure

```
src/
├── background/          # Service worker (main logic)
├── content/             # Content scripts (injected in pages)
├── ui/                  # UI components
│   ├── block-screen/    # Block screen when site is blocked
│   └── popup/           # Extension popup
└── shared/              # Shared types and utilities
```

### Key Files

- `manifest.json` - Extension configuration
- `src/background/service-worker.ts` - Main background logic
- `src/shared/constants.ts` - Blocklist and rules
- `src/ui/block-screen/` - Block screen UI

## Current Features

- ✅ Hardcoded blocklist (Twitter, Reddit, etc.)
- ✅ Block screen with bypass options
- ✅ Basic analytics (blocks count)
- ✅ Extension popup with status

## Next Steps

- [ ] Native Messaging to Electron app
- [ ] History collection
- [ ] Modes (Focus/Wind Down)
- [ ] LLM integration for intelligent blocking

## Troubleshooting

### Extension not loading
- Make sure you built it first: `npm run build`
- Check that you're loading the `dist/` folder, not `src/`

### Changes not appearing
- Reload the extension in `chrome://extensions/`
- Or use `npm run dev` for auto-reload

### Blocked site not being blocked
- Check the console in the service worker (click "service worker" link in extensions page)
- Verify the URL matches a pattern in `src/shared/constants.ts`
