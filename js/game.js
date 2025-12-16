import { state, bindDom, effect } from 'lume-js';
import { computed, repeat } from 'lume-js/addons';
import * as Comlink from 'comlink';
import PuzzleWorker from './worker.js?worker';

// Initialize Web Worker with Comlink
import { GRID_SIZE, isAdjacent } from './puzzle.js';

// Initialize Web Worker with Comlink
const worker = new PuzzleWorker();
const puzzleAPI = Comlink.wrap(worker);

console.log('✅ Worker initialized with Comlink');

// Puzzle Queue System
const puzzleQueue = [];
const MIN_QUEUE_SIZE = 2;
let isQueueFilling = false;

async function ensureQueueFilled() {
    if (isQueueFilling) return;
    isQueueFilling = true;

    try {
        while (puzzleQueue.length < MIN_QUEUE_SIZE) {
            console.log('[Queue] Generating background puzzle...');
            const result = await puzzleAPI.generatePuzzle();
            if (result) {
                puzzleQueue.push(result);
                console.log(`[Queue] Puzzle added. Size: ${puzzleQueue.length}`);

                // Update loading text if visible to show we have one ready
                const loadingDiv = document.getElementById('loading');
                if (loadingDiv && loadingDiv.style.display === 'block' && puzzleQueue.length === 1) {
                    // Optional: could auto-trigger if we were waiting, 
                    // but simpler to let the button handler wait.
                }
            } else {
                // If generation failed, break to avoid infinite loop
                break;
            }
        }
    } catch (err) {
        console.error('[Queue] Background generation failed:', err);
    } finally {
        isQueueFilling = false;
    }
}

// Start filling queue immediately
ensureQueueFilled();

// ============================================================================
// CLEANUP TRACKING
// ============================================================================
const disposables = [];

function addDisposable(cleanup) {
    if (typeof cleanup === 'function') {
        disposables.push(cleanup);
    }
}

// Expose cleanup for hot-reloading or testing
window.disposeGame = () => {
    console.log('[Cleanup] Disposing game resources...');
    disposables.forEach(cleanup => cleanup());
    disposables.length = 0;
    console.log('[Cleanup] All resources disposed');
};

const grid = document.getElementById('grid');
const path = [];

// Reactive state with Lume.js
const gameState = state({
    cellsVisited: 0,
    elapsedSeconds: 0,
    formattedTime: '00:00'
});

addDisposable(bindDom(document.body, gameState));

// Computed timer value
const formattedTime = computed(() => {
    const seconds = gameState.elapsedSeconds;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
});

// Sync computed time to gameState (so bindDom can display it)
addDisposable(
    effect(() => {
        // Access elapsedSeconds to track it as a dependency
        const seconds = gameState.elapsedSeconds;
        const formatted = formattedTime.value;
        console.log('[Timer] Effect triggered. Seconds:', seconds, 'Formatted:', formatted);
        gameState.formattedTime = formatted;
    })
);

// Timer State
let timerInterval = null;
let isTimerRunning = false;

function startTimer() {
    if (isTimerRunning) return;
    console.log('[Timer] Starting timer...');
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        gameState.elapsedSeconds++;
        console.log('[Timer] Tick:', gameState.elapsedSeconds);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isTimerRunning = false;
}

function resetTimer() {
    stopTimer();
    gameState.elapsedSeconds = 0;
}

// Initialize cells in state
gameState.cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
    id: i,
    index: i,
    value: null
}));

// Render grid with repeat
addDisposable(
    repeat(grid, gameState, 'cells', {
        key: cell => cell.id,
        render: (cellData, el) => {
            // One-time initialization
            if (!el.dataset.init) {
                el.className = 'cell';
                el.dataset.index = cellData.index;

                // Debug index span
                const indexSpan = document.createElement('span');
                indexSpan.className = 'cell-index';
                indexSpan.textContent = cellData.index;
                el.appendChild(indexSpan);

                el.dataset.init = 'true';
            }

            // Updates on every render
            // Check if this cell is in the path
            const isInPath = path.includes(cellData.index);
            el.style.background = isInPath ? '#4CAF50' : '';

            // Update puzzle number display
            let valSpan = el.querySelector('span:not(.cell-index)');
            if (cellData.value !== null) {
                if (!valSpan) {
                    valSpan = document.createElement('span');
                    valSpan.style.pointerEvents = 'none';
                    el.appendChild(valSpan);
                }
                valSpan.textContent = cellData.value;
            } else if (valSpan) {
                valSpan.remove();
            }
        }
    })
);

// Puzzle data (old numbers array, to be migrated)
let numbers = [];
let currentSolution = null;

// Track next expected number
let nextNumber = 1;

function getNumberAtIndex(idx) {
    const num = numbers.find(n => n.index === idx);
    return num ? num.value : null;
}

function canAddToPath(idx) {
    const cellNumber = getNumberAtIndex(idx);

    // If it's a numbered cell, must match next expected number
    if (cellNumber !== null) {
        return cellNumber === nextNumber;
    }

    // Non-numbered cells can be added anytime
    return true;
}

// Handle drag drawing
let isDrawing = false;

// Win detection via effect
addDisposable(
    effect(() => {
        // Track reactive state: cellsVisited
        if (gameState.cellsVisited === GRID_SIZE * GRID_SIZE) {
            console.log('🎉 Win detected via effect!');
            stopTimer();

            // Show win overlay
            const overlay = document.getElementById('win-overlay');
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }
    })
);

// Helper to add a cell to the path
function addToPath(index) {
    path.push(index);
    gameState.cellsVisited = path.length;

    const cellNumber = getNumberAtIndex(index);
    if (cellNumber === nextNumber) {
        nextNumber++;
    }
    console.log('Path:', path, 'Next number:', nextNumber);

    // Trigger re-render
    gameState.cells = [...gameState.cells];
}

// Helper to truncate path (undo/backtrack)
function truncatePath(targetIndex) {
    const targetPos = path.indexOf(targetIndex);
    if (targetPos === -1) return;

    // Remove cells after target
    const removedCells = path.slice(targetPos + 1);
    path.length = targetPos + 1;
    gameState.cellsVisited = path.length;

    // Recalculate nextNumber
    nextNumber = 1;
    path.forEach(idx => {
        const num = getNumberAtIndex(idx);
        if (num === nextNumber) {
            nextNumber++;
        }
    });

    console.log('Backtracked to:', targetIndex, 'Path:', path, 'Next:', nextNumber);

    // Trigger re-render
    gameState.cells = [...gameState.cells];
}

grid.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('cell')) {
        const index = parseInt(e.target.dataset.index);

        // Case 1: Resume from last cell
        if (path.length > 0 && index === path[path.length - 1]) {
            isDrawing = true;
            return;
        }

        // Case 2: Backtrack (click on existing path cell)
        if (path.includes(index)) {
            truncatePath(index);
            isDrawing = true;
            return;
        }

        // Case 3: Continue path (click adjacent to end)
        if (path.length > 0) {
            const lastIndex = path[path.length - 1];
            if (isAdjacent(lastIndex, index) && canAddToPath(index)) {
                isDrawing = true;
                addToPath(index);
                return;
            }
        }

        // Case 4: Start new path (only if clicking 1)
        const cellNumber = getNumberAtIndex(index);
        if (cellNumber === 1) {
            // Reset everything
            path.length = 0;
            gameState.cellsVisited = 0;
            nextNumber = 1;

            if (!isTimerRunning) startTimer();

            isDrawing = true;
            addToPath(index);
            return;
        }
    }
});

grid.addEventListener('mousemove', (e) => {
    if (isDrawing && e.target.classList.contains('cell')) {
        const index = parseInt(e.target.dataset.index);

        // Backtrack logic: if moving to the previous cell in path
        if (path.length > 1 && index === path[path.length - 2]) {
            truncatePath(index);
            return;
        }

        // Add to path logic
        if (!path.includes(index)) {
            const lastIndex = path[path.length - 1];
            if (isAdjacent(lastIndex, index) && canAddToPath(index)) {
                addToPath(index);
            }
        }
    }
});

grid.addEventListener('mouseup', () => {
    isDrawing = false;
});

async function loadNewPuzzle() {
    // Reset game state
    path.length = 0;
    nextNumber = 1;
    gameState.cellsVisited = 0;
    resetTimer();

    // Show loading state
    const loadingDiv = document.getElementById('loading');
    const newPuzzleBtn = document.getElementById('new-puzzle');
    loadingDiv.style.display = 'block';
    newPuzzleBtn.disabled = true;

    try {
        let result;

        // Check queue first
        if (puzzleQueue.length > 0) {
            console.log('[Queue] Using pre-generated puzzle');
            result = puzzleQueue.shift();
        } else {
            console.log('[Queue] Queue empty, generating immediately...');
            result = await puzzleAPI.generatePuzzle();
        }

        // Trigger background refill
        ensureQueueFilled();

        if (!result) {
            console.error('Worker failed to generate puzzle');
            alert('Failed to generate puzzle. Please try again.');
            return;
        }

        console.log(`✅ Loaded puzzle with ${result.clueCount} clues`);

        // Reset numbers array
        numbers = [];

        // Clear all cell values first
        gameState.cells.forEach(cell => {
            cell.value = null;
        });

        // Set puzzle numbers
        result.numbers.forEach(({ index, value }) => {
            numbers.push({ index, value }); // Keep for getNumberAtIndex
            gameState.cells[index].value = value;
        });

        // Trigger re-render with immutable update
        gameState.cells = [...gameState.cells];

        // Update debug display
        const debugDiv = document.getElementById('solution-display');
        debugDiv.innerHTML = `
            <strong>Puzzle:</strong> ${JSON.stringify(result.numbers)}<br><br>
            <strong>✅ Unique Solution (${result.solution.length} cells):</strong><br>
            ${result.solution.join(' → ')}
        `;

    } catch (error) {
        console.error('Error generating puzzle:', error);
        alert('Error generating puzzle. Check console for details.');
    } finally {
        // Hide loading state
        loadingDiv.style.display = 'none';
        newPuzzleBtn.disabled = false;
    }

    console.log('New puzzle loaded');
}

// Auto-load on startup
loadNewPuzzle();

document.getElementById('new-puzzle').addEventListener('click', loadNewPuzzle);

// Overlay Event Listeners
document.getElementById('overlay-new-puzzle').addEventListener('click', () => {
    const overlay = document.getElementById('win-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    loadNewPuzzle();
});

document.getElementById('overlay-exit').addEventListener('click', () => {
    const overlay = document.getElementById('win-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
});

document.getElementById('reset').addEventListener('click', () => {
    path.length = 0;
    nextNumber = 1;
    gameState.cellsVisited = 0;
    resetTimer();
    const cells = grid.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.background = '';
    });
    console.log('Reset complete');
});
