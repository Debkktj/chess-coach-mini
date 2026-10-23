# Chess Coach Mini v2.0

AI-powered chess coach with floating board interface.

## Features

- **Floating Popup Window**: Draggable, resizable, minimize/restore
- **Interactive Chessboard**: Click to move, legal move validation
- **Chat Input**: Type moves in natural language
- **Visual Suggestions**: Arrow overlay + preview board
- **Ollama Integration**: Local AI model support
- **PWA**: Install as web app, works offline
- **Auto-float**: Opens in floating mode on launch

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Install as Web App

1. Open in Chrome/Edge
2. Click "Install" when prompted, or
3. Menu → Add to Home Screen

## Floating Window

- App opens in floating popup automatically
- Drag header to move
- Resize from bottom-right corner
- Minimize to keep on screen

## Ollama Setup

1. Install Ollama: https://ollama.com
2. Pull model: `ollama pull gemma4:31b`
3. Start server: `ollama serve`
4. In app: Settings → Test Connection

## Deploy

### Vercel
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder
```

### GitHub Pages
```bash
npm run build
# Push dist/ to gh-pages branch
```

## Tech Stack

- React 18 + Vite
- chess.js for game logic
- Ollama for AI suggestions
- PWA with service worker

## License

MIT
