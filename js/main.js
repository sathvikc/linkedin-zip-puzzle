// Import Lume.js from CDN
import { state, bindDom } from 'https://cdn.jsdelivr.net/npm/lume-js@1.0.0/src/index.js';

// Game State
const gameState = state({
    // Grid configuration
    gridSize: 6,
    grid: [],
    
    // Game state
    difficulty: 'Easy',
    moveCount: 0,
    cellsVisited: 0,
    totalCells: 36,
    
    // Current game
    numbers: [], // {row, col, value}
    currentPath: [],
    isDrawing: false,
    isComplete: false,
    
    // Theme
    theme: 'light'
});

// Initialize app
function init() {
    console.log('🎮 Initializing Zip Puzzle Game...');
    
    // Initialize theme
    initTheme();
    
    // Bind Lume.js to DOM
    bindDom(document.body, gameState);
    
    // Initialize grid
    initializeGrid();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✨ Game initialized!');
}

// Initialize theme from localStorage or system preference
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        gameState.theme = savedTheme;
    } else if (systemPrefersDark) {
        gameState.theme = 'dark';
    }
    
    applyTheme(gameState.theme);
}

// Apply theme to document
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
}

// Initialize empty grid
function initializeGrid() {
    const gridContainer = document.getElementById('game-grid');
    gridContainer.innerHTML = '';
    
    // Create grid cells
    for (let row = 0; row < gameState.gridSize; row++) {
        for (let col = 0; col < gameState.gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            gridContainer.appendChild(cell);
        }
    }
    
    console.log(`Grid initialized: ${gameState.gridSize}x${gameState.gridSize}`);
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        gameState.theme = gameState.theme === 'light' ? 'dark' : 'light';
        applyTheme(gameState.theme);
    });
    
    // New game button
    const newGameBtn = document.getElementById('new-game-btn');
    newGameBtn.addEventListener('click', () => {
        console.log('🎲 Starting new game...');
        // TODO: Generate new puzzle (will implement in next milestone)
        generateDemoPuzzle();
    });
    
    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => {
        console.log('🔄 Resetting game...');
        resetGame();
    });
}

// Generate a simple demo puzzle (placeholder until we implement worker)
function generateDemoPuzzle() {
    // Clear previous state
    resetGame();
    
    // Simple demo: place 4 numbers in a 6x6 grid
    gameState.numbers = [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 5, value: 2 },
        { row: 5, col: 5, value: 3 },
        { row: 5, col: 0, value: 4 }
    ];
    
    // Render numbers on grid
    const gridContainer = document.getElementById('game-grid');
    const cells = gridContainer.querySelectorAll('.grid-cell');
    
    gameState.numbers.forEach(num => {
        const index = num.row * gameState.gridSize + num.col;
        cells[index].textContent = num.value;
        cells[index].classList.add('number');
    });
    
    console.log('✅ Demo puzzle generated!');
}

// Reset game state
function resetGame() {
    gameState.currentPath = [];
    gameState.moveCount = 0;
    gameState.cellsVisited = 0;
    gameState.isComplete = false;
    gameState.isDrawing = false;
    
    // Clear grid visual state
    const gridContainer = document.getElementById('game-grid');
    const cells = gridContainer.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.classList.remove('visited', 'current', 'start');
        if (!cell.classList.contains('number')) {
            cell.textContent = '';
        }
    });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
