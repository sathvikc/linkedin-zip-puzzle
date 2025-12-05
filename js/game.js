import { state, bindDom } from 'https://cdn.jsdelivr.net/npm/lume-js@1.0.0/src/index.js';
import * as Comlink from 'comlink';
import PuzzleWorker from './worker.js?worker';

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

const gridSize = 6;
const grid = document.getElementById('grid');
const path = [];

// Reactive state with Lume.js
const gameState = state({
    cellsVisited: 0
});

bindDom(document.body, gameState);

// Create grid cells
for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    grid.appendChild(cell);
}

// Puzzle data
let numbers = [];
let currentSolution = null;

// Track next expected number
let nextNumber = 1;

function getNumberAtIndex(idx) {
    const num = numbers.find(n => n.index === idx);
    return num ? num.value : null;
}

// Check if two cells are adjacent
function isAdjacent(idx1, idx2) {
    const row1 = Math.floor(idx1 / gridSize);
    const col1 = idx1 % gridSize;
    const row2 = Math.floor(idx2 / gridSize);
    const col2 = idx2 % gridSize;
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
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

function checkWin() {
    if (path.length === gridSize * gridSize) {
        console.log('🎉 You won!');
        setTimeout(() => {
            alert('🎉 Congratulations! You solved the puzzle!');
        }, 100);
        return true;
    }
    return false;
}

// Helper to add a cell to the path
function addToPath(index, element) {
    path.push(index);
    gameState.cellsVisited = path.length;
    element.style.background = '#4CAF50';

    const cellNumber = getNumberAtIndex(index);
    if (cellNumber === nextNumber) {
        nextNumber++;
    }
    console.log('Path:', path, 'Next number:', nextNumber);
    checkWin();
}

// Helper to truncate path (undo/backtrack)
function truncatePath(targetIndex) {
    const targetPos = path.indexOf(targetIndex);
    if (targetPos === -1) return;

    // Remove cells after target
    const removedCells = path.slice(targetPos + 1);
    path.length = targetPos + 1;
    gameState.cellsVisited = path.length;

    // Reset UI for removed cells
    const cells = grid.querySelectorAll('.cell');
    removedCells.forEach(idx => {
        cells[idx].style.background = '';
    });

    // Recalculate nextNumber
    nextNumber = 1;
    path.forEach(idx => {
        const num = getNumberAtIndex(idx);
        if (num === nextNumber) {
            nextNumber++;
        }
    });
    
    console.log('Backtracked to:', targetIndex, 'Path:', path, 'Next:', nextNumber);
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
                addToPath(index, e.target);
                return;
            }
        }

        // Case 4: Start new path (only if clicking 1 or path empty)
        // If clicking '1', reset and start
        const cellNumber = getNumberAtIndex(index);
        if (cellNumber === 1) {
            // Reset everything
            path.length = 0;
            gameState.cellsVisited = 0;
            nextNumber = 1;
            const cells = grid.querySelectorAll('.cell');
            cells.forEach(c => c.style.background = '');
            
            isDrawing = true;
            addToPath(index, e.target);
            return;
        }

        // Case 5: Start new path (empty path)
        if (path.length === 0 && canAddToPath(index)) {
            isDrawing = true;
            addToPath(index, e.target);
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
                addToPath(index, e.target);
            }
        }
    }
});

grid.addEventListener('mouseup', () => {
    isDrawing = false;
});

document.getElementById('new-puzzle').addEventListener('click', async () => {
    // Reset game state
    path.length = 0;
    nextNumber = 1;
    gameState.cellsVisited = 0;
    const cells = grid.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.background = '';
        cell.textContent = '';
    });
    
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
        
        // Store the puzzle data
        numbers = result.numbers;
        currentSolution = [result.solution];
        
        // Render numbers on grid
        numbers.forEach(({ index, value }) => {
            cells[index].textContent = value;
        });
        
        // Update debug display
        const debugDiv = document.getElementById('solution-display');
        debugDiv.innerHTML = `
            <strong>Puzzle:</strong> ${JSON.stringify(numbers)}<br><br>
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
});

document.getElementById('reset').addEventListener('click', () => {
    path.length = 0;
    nextNumber = 1;
    gameState.cellsVisited = 0;
    const cells = grid.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.background = '';
    });
    console.log('Reset complete');
});
