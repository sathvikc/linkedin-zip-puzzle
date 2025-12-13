# LinkedIn Zip Puzzle
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Deploy to GitHub Pages](https://github.com/sathvikc/linkedin-zip-puzzle/actions/workflows/deploy.yml/badge.svg)](https://github.com/sathvikc/linkedin-zip-puzzle/actions/workflows/deploy.yml)

A browser-based implementation of the LinkedIn Zip puzzle game. This project showcases modern web development techniques without heavy frameworks, utilizing **Lume.js** for reactive state, **Web Workers** for non-blocking computation, and **Tailwind CSS** for styling.

[**Play Live Demo**](https://sathvikc.github.io/linkedin-zip-puzzle/)

## Game Rules
Draw a single, continuous line through the grid:
1. Connect numbered cells in ascending order (1 → 2 → 3...).
2. Visit every empty cell text exactly once.
3. No diagonal moves (only horizontal/vertical).
4. The line cannot cross itself.
5. Each puzzle is guaranteed to have **exactly one valid solution**.

## Technology Stack
- **[Lume.js](https://github.com/sathvikc/lume-js)**: A lightweight (2KB) library for reactive state management.
- **Web Workers**: Offloads the complex backtracking puzzle generation algorithm to a background thread to keep the UI buttery smooth.
- **Vite**: Ultra-fast development server and build tool.
- **Tailwind CSS v4**: Utility-first CSS framework for rapid styling.

## Development Setup

### Prerequisites
- Node.js >= 18.x

### Getting Started
```bash
# Clone the repository
git clone https://github.com/sathvikc/linkedin-zip-puzzle.git
cd linkedin-zip-puzzle

# Install dependencies
npm install

# Start the development server
npm run dev
```
Open your browser to `http://localhost:5173`.

### Building for Production
```bash
npm run build
```
The output will be in the `dist` directory.

## Deployment
This project is configured to automatically deploy to GitHub Pages via GitHub Actions.
- Pushing to the `main` branch triggers the build and deployment workflow.
- You can view the workflow logic in `.github/workflows/deploy.yml`.

## Roadmap 🚀
We are actively working on enhancing the game. Here is what's coming next:

### Phase 4: UX Enhancements (In Progress) 🎨
- [x] Improve Drag Interaction (Resume & Undo)
- [ ] Add Animations
- [ ] Add Sound Effects
- [ ] Add Dark/Light Theme

### Phase 5: Core Features 🎮
- [ ] Timer
- [ ] Move Counter & Undo Tracking
- [ ] Statistics

### Phase 6: Grid Size Selection 📏
- [ ] Add Grid Size Selector
- [ ] Adjust Algorithm Per Size

### Phase 7: Game Modes 🎯
- [ ] Define Mode Parameters
- [ ] Add Mode Selector (Daily Challenge, Infinite Mode)

### Phase 8: Walls Feature 🧱
- [ ] Wall Generation Algorithm
- [ ] Update Solver for Walls

### Phase 9: Advanced Features 🚀
- [ ] Hints System
- [ ] Difficulty Levels

### Phase 10: Modern Web Standards 🌐
- [ ] IndexedDB Integration for persistent stats
- [ ] Service Worker (PWA) support

## License
MIT © Sathvik C
