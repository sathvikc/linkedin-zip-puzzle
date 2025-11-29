# LinkedIn Zip Puzzle Game

A browser-based implementation of the LinkedIn Zip puzzle game, showcasing the power of:
- **[Lume.js](https://github.com/sathvikc/lume-js)** - Minimal reactive state management
- **Web Workers** - Non-blocking puzzle generation
- **IndexedDB** - Persistent game statistics
- **Modern Web APIs** - No build step required for production!

## Game Rules

Draw a single, continuous line through the grid:
- Connect numbered cells in ascending order (1→2→3...)
- Use every cell exactly once
- No diagonal moves (only horizontal/vertical)
- Line cannot cross itself
- Each puzzle has only **one valid solution**

## Development Setup

### Prerequisites
- Node.js >= 18.x

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open your browser to `http://localhost:5173`

### Production

No build step needed! Simply open `index.html` directly in any modern browser.

## Technology Stack

- **Lume.js** (via CDN) - Reactive state management
- **Tailwind CSS** (via CDN) - Styling
- **Comlink** (via CDN) - Web Worker communication
- **Vite** (dev only) - Development server with HMR

## Project Structure

```
linkedin-zip-puzzle/
├── index.html              # Main game page
├── styles.css              # Custom styles
├── js/
│   ├── main.js            # App entry point
│   ├── game-state.js      # Game state management
│   ├── game-logic.js      # Core game logic
│   ├── ui.js              # UI interactions
│   ├── storage.js         # IndexedDB wrapper
│   └── workers/
│       └── puzzle-generator.worker.js
└── package.json           # NPM config
```

## License

MIT © Sathvik C
