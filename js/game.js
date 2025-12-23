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

// Reactive state with Lume.js
const gameState = state({
    path: [],
    elapsedSeconds: 0,
    formattedTime: '00:00',
    cells: Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
        id: i,
        index: i,
        value: null
    }))
});

addDisposable(bindDom(document.body, gameState));

// Sync formatted time reactively
addDisposable(
    effect(() => {
        const seconds = gameState.elapsedSeconds;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        gameState.formattedTime = `${m}:${s}`;
    })
);

// Computed next expected number
const nextNumber = computed(() => {
    let next = 1;
    gameState.path.forEach(idx => {
        const num = getNumberAtIndex(idx);
        if (num === next) {
            next++;
        }
    });
    return next;
});

// nextNumber computed can stay as is if used elsewhere, 
// but we need to ensure it's accessed correctly if it's supposed to be reactive in another place.
// For now, let's see if nextNumber is used in canAddToPath which is NOT reactive (it's called in event handlers).
// In event handlers, accessing .value is fine as it always returns the latest cached value.

// Track cellsVisited reactively
addDisposable(
    effect(() => {
        gameState.cellsVisited = gameState.path.length;
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

// Render grid with repeat
addDisposable(
    repeat(grid, gameState, 'cells', {
        key: cell => cell.id,
        render: (cellData, el) => {
            // One-time initialization
            if (!el.dataset.init) {
                el.className = 'cell';
                el.dataset.index = cellData.index;

                // Path Dot
                const dot = document.createElement('div');
                dot.className = 'path-dot';
                el.appendChild(dot);

                // Connectors
                ['top', 'bottom', 'left', 'right'].forEach(dir => {
                    const conn = document.createElement('div');
                    conn.className = `connector connector-${dir}`;
                    el.appendChild(conn);
                });

                // Debug index span
                const indexSpan = document.createElement('span');
                indexSpan.className = 'cell-index';
                indexSpan.textContent = cellData.index;
                el.appendChild(indexSpan);

                el.dataset.init = 'true';

                // Setup RE-RENDER EFFECT for this specific cell
                // Using an effect here makes the cell UI automatically reactive to gameState.path
                // and gameState.cells without needing a full grid re-render.
                const cellIndex = cellData.index;
                const cellEffect = effect(() => {
                    const currentPath = gameState.path;
                    const pathIdx = currentPath.indexOf(cellIndex);
                    const isInPath = pathIdx !== -1;

                    // Access cell value from gameState.cells for reactivity
                    const cellVal = gameState.cells[cellIndex].value;

                    // Update Active Class
                    if (isInPath) {
                        el.classList.add('active');
                    } else {
                        el.classList.remove('active');
                    }

                    // Update Connector Visibility
                    const connectors = el.querySelectorAll('.connector');
                    connectors.forEach(conn => conn.classList.remove('visible'));

                    if (isInPath) {
                        const prevIdx = pathIdx > 0 ? currentPath[pathIdx - 1] : null;
                        const nextIdx = pathIdx < currentPath.length - 1 ? currentPath[pathIdx + 1] : null;

                        [prevIdx, nextIdx].forEach(neighborIdx => {
                            if (neighborIdx === null) return;

                            const row = Math.floor(cellIndex / GRID_SIZE);
                            const col = cellIndex % GRID_SIZE;
                            const nRow = Math.floor(neighborIdx / GRID_SIZE);
                            const nCol = Math.floor(neighborIdx % GRID_SIZE);

                            if (nRow < row) el.querySelector('.connector-top').classList.add('visible');
                            if (nRow > row) el.querySelector('.connector-bottom').classList.add('visible');
                            if (nCol < col) el.querySelector('.connector-left').classList.add('visible');
                            if (nCol > col) el.querySelector('.connector-right').classList.add('visible');
                        });
                    }

                    // Update puzzle number display
                    let valSpan = el.querySelector('span:not(.cell-index)');
                    if (cellVal !== null) {
                        if (!valSpan) {
                            valSpan = document.createElement('span');
                            valSpan.style.pointerEvents = 'none';
                            el.appendChild(valSpan);
                        }
                        valSpan.textContent = cellVal;
                    } else if (valSpan) {
                        valSpan.remove();
                    }
                });

                addDisposable(cellEffect);
            }
        }
    })
);

// Puzzle data (old numbers array, to be migrated)
let numbers = [];

function getNumberAtIndex(idx) {
    const num = numbers.find(n => n.index === idx);
    return num ? num.value : null;
}

function canAddToPath(idx) {
    const cellNumber = getNumberAtIndex(idx);
    const expected = nextNumber.value;

    // If it's a numbered cell, must match next expected number
    if (cellNumber !== null) {
        return cellNumber === expected;
    }

    // Non-numbered cells can be added anytime
    return true;
}

// Handle drag drawing
let isDrawing = false;

// Win detection via effect
addDisposable(
    effect(() => {
        // Track reactive state: path.length
        if (gameState.path.length === GRID_SIZE * GRID_SIZE) {
            console.log('🎉 Win detected via effect!');
            stopTimer();

            // Show win overlay with a slight delay so user sees the final line
            setTimeout(() => {
                const overlay = document.getElementById('win-overlay');
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
            }, 300);
        }
    })
);

// Helper to add a cell to the path
function addToPath(index) {
    gameState.path = [...gameState.path, index];
    console.log('Path:', [...gameState.path], 'Next number:', nextNumber.value);
}

// Helper to truncate path (undo/backtrack)
function truncatePath(targetIndex) {
    const targetPos = gameState.path.indexOf(targetIndex);
    if (targetPos === -1) return;

    // Remove cells after target
    gameState.path = gameState.path.slice(0, targetPos + 1);
    console.log('Backtracked to:', targetIndex, 'Path:', [...gameState.path], 'Next:', nextNumber.value);
}

grid.addEventListener('mousedown', (e) => {
    const cellEl = e.target.closest('.cell');
    if (cellEl) {
        const index = parseInt(cellEl.dataset.index);

        // Case 1: Resume from last cell
        if (gameState.path.length > 0 && index === gameState.path[gameState.path.length - 1]) {
            isDrawing = true;
            return;
        }

        // Case 2: Backtrack/Resume from existing path cell
        if (gameState.path.includes(index)) {
            truncatePath(index);
            isDrawing = true;
            return;
        }

        // Case 3: Continue path (click adjacent to end)
        if (gameState.path.length > 0) {
            const lastIndex = gameState.path[gameState.path.length - 1];
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
            gameState.path = [];
            if (!isTimerRunning) startTimer();

            isDrawing = true;
            addToPath(index);
            return;
        }
    }
});

grid.addEventListener('mousemove', (e) => {
    const cellEl = e.target.closest('.cell');
    if (isDrawing && cellEl) {
        const index = parseInt(cellEl.dataset.index);

        // Backtrack logic: if moving to the previous cell in path
        if (gameState.path.length > 1 && index === gameState.path[gameState.path.length - 2]) {
            truncatePath(index);
            return;
        }

        // Add to path logic
        if (!gameState.path.includes(index)) {
            const lastIndex = gameState.path[gameState.path.length - 1];
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
    gameState.path = [];
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

        // Update cell values in state (this is reactive)
        const nextCells = gameState.cells.map(cell => ({ ...cell, value: null }));

        result.numbers.forEach(({ index, value }) => {
            numbers.push({ index, value }); // Keep for getNumberAtIndex
            nextCells[index] = { ...nextCells[index], value };
        });

        gameState.cells = nextCells;

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
    gameState.path = [];
    resetTimer();
    console.log('Reset complete');
});
