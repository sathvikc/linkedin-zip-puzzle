// Puzzle Generator Web Worker
// Uses Comlink for clean async communication with main thread

import * as Comlink from 'comlink';

const gridSize = 6; // TODO: Make this configurable

// Solver to check if puzzle has unique solution
function solvePuzzle(puzzleNumbers) {
    const totalCells = gridSize * gridSize;
    let solutionCount = 0;
    const solutions = [];

    function getNumberAtIdx(idx) {
        const n = puzzleNumbers.find(n => n.index === idx);
        return n ? n.value : null;
    }

    function isAdjacentIdx(idx1, idx2) {
        const row1 = Math.floor(idx1 / gridSize);
        const col1 = idx1 % gridSize;
        const row2 = Math.floor(idx2 / gridSize);
        const col2 = idx2 % gridSize;
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    function solve(currentPath, visited, nextNum) {
        if (solutionCount >= 5) return; // Stop after finding 5 solutions

        if (currentPath.length === totalCells) {
            solutionCount++;
            solutions.push([...currentPath]);
            return;
        }

        const lastIdx = currentPath[currentPath.length - 1];

        // Try all possible next cells
        for (let idx = 0; idx < totalCells; idx++) {
            if (visited.has(idx)) continue;
            if (!isAdjacentIdx(lastIdx, idx)) continue;

            const cellNum = getNumberAtIdx(idx);

            // Check number sequencing
            if (cellNum !== null && cellNum !== nextNum) continue;

            visited.add(idx);
            currentPath.push(idx);
            solve(currentPath, visited, cellNum === nextNum ? nextNum + 1 : nextNum);
            currentPath.pop();
            visited.delete(idx);
        }
    }

    // Start from cell with number 1
    const startCell = puzzleNumbers.find(n => n.value === 1);
    if (!startCell) return { count: 0, solutions: [] };

    const visited = new Set([startCell.index]);
    solve([startCell.index], visited, 2);

    return { count: solutionCount, solutions: solutions };
}

// Generate a random Hamiltonian path (visits every cell exactly once)
function generateHamiltonianPath() {
    const totalCells = gridSize * gridSize;
    const path = [];
    const visited = new Set();

    function getNeighbors(idx) {
        const neighbors = [];
        const row = Math.floor(idx / gridSize);
        const col = idx % gridSize;
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of dirs) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
                neighbors.push(r * gridSize + c);
            }
        }
        // Shuffle neighbors for randomness
        for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }
        return neighbors;
    }

    function backtrack(currentIdx) {
        path.push(currentIdx);
        visited.add(currentIdx);

        if (path.length === totalCells) {
            return true;
        }

        const neighbors = getNeighbors(currentIdx);
        // Heuristic: try neighbors with fewer available neighbors first (Warnsdorff's rule)
        neighbors.sort((a, b) => {
            const aCount = getNeighbors(a).filter(n => !visited.has(n)).length;
            const bCount = getNeighbors(b).filter(n => !visited.has(n)).length;
            return aCount - bCount;
        });

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (backtrack(neighbor)) return true;
            }
        }

        path.pop();
        visited.delete(currentIdx);
        return false;
    }

    // Start from a random cell
    const startIdx = Math.floor(Math.random() * totalCells);
    if (backtrack(startIdx)) {
        // Convert path indices to {row, col} objects for easier use
        return path.map(idx => ({
            row: Math.floor(idx / gridSize),
            col: idx % gridSize,
            index: idx
        }));
    }
    return null;
}

// Main puzzle generation function
function generatePuzzle() {
    const totalCells = gridSize * gridSize;
    const maxAttempts = 50;
    let attempts = 0;

    console.log('[Worker] Starting puzzle generation...');

    while (attempts < maxAttempts) {
        // 1. Generate a valid full path first
        const fullPath = generateHamiltonianPath();
        if (!fullPath) {
            attempts++;
            continue;
        }

        // 2. Place numbers along the path using smart clue placement
        const revealedIndices = new Set();

        // Calculate optimal initial clue count based on grid size
        const clueConfig = {
            25: { intermediate: 4 },  // 5x5: 6 total (24%)
            36: { intermediate: 6 },  // 6x6: 8 total (22%)
            49: { intermediate: 8 },  // 7x7: 10 total (20%)
            64: { intermediate: 10 }  // 8x8: 12 total (19%)
        };

        const config = clueConfig[totalCells] || { intermediate: 6 };
        const intermediateCount = config.intermediate;

        // Helper function to place clues smartly based on distance
        function placeCluesSmartly(path, count) {
            const clues = [0, path.length - 1]; // Always start and end

            while (clues.length < count) {
                let bestIdx = -1;
                let bestScore = -Infinity;

                for (let i = 1; i < path.length - 1; i++) {
                    if (clues.includes(i)) continue;

                    // Calculate minimum Manhattan distance to any existing clue
                    let minManhattanDist = Infinity;
                    let minPathDist = Infinity;

                    for (let clueIdx of clues) {
                        const clueCell = path[clueIdx];
                        const currentCell = path[i];

                        // Manhattan distance (spatial)
                        const manhattanDist = Math.abs(currentCell.row - clueCell.row) +
                            Math.abs(currentCell.col - clueCell.col);
                        minManhattanDist = Math.min(minManhattanDist, manhattanDist);

                        // Path distance (sequential)
                        const pathDist = Math.abs(i - clueIdx);
                        minPathDist = Math.min(minPathDist, pathDist);
                    }

                    // Score combines spatial and path distance
                    const score = minManhattanDist + (minPathDist / path.length) * 0.15;

                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = i;
                    }
                }

                if (bestIdx !== -1) {
                    clues.push(bestIdx);
                } else {
                    break;
                }
            }

            return clues;
        }

        // Place clues using smart algorithm
        console.log(`[Worker] Placing ${intermediateCount + 2} total clues for ${totalCells} cells`);
        const clueIndices = placeCluesSmartly(fullPath, intermediateCount + 2);
        console.log(`[Worker] Smart placement returned ${clueIndices.length} clue indices`);
        clueIndices.forEach(idx => revealedIndices.add(idx));

        // Helper to convert revealed indices to puzzle numbers
        function createPuzzleFromIndices(indicesSet) {
            const sortedPathIndices = Array.from(indicesSet).sort((a, b) => a - b);
            return sortedPathIndices.map((pathIdx, i) => ({
                index: fullPath[pathIdx].index,
                value: i + 1
            }));
        }

        let numbers = createPuzzleFromIndices(revealedIndices);

        // 3. Check uniqueness and fix if needed
        let result = solvePuzzle(numbers);
        console.log(`[Worker] Attempt ${attempts + 1} Initial: ${result.count} solution(s)`);

        // Adaptive Fix
        const maxFixAttempts = 15;
        let fixAttempts = 0;

        while (result.count > 1 && fixAttempts < maxFixAttempts) {
            const sol1 = fullPath.map(p => p.index);
            const sol2 = result.solutions[0].toString() === sol1.toString() ? result.solutions[1] : result.solutions[0];

            if (!sol2) break;

            // Find first point of divergence
            let diffIdx = -1;
            for (let i = 0; i < totalCells; i++) {
                if (sol1[i] !== sol2[i]) {
                    diffIdx = i;
                    break;
                }
            }

            if (diffIdx !== -1) {
                if (!revealedIndices.has(diffIdx)) {
                    revealedIndices.add(diffIdx);
                    numbers = createPuzzleFromIndices(revealedIndices);
                    console.log(`[Worker] Fix ${fixAttempts + 1}: Added clue at step ${diffIdx + 1}`);
                }
            }

            result = solvePuzzle(numbers);
            fixAttempts++;
        }

        // Fallback: If still not unique, add 2 strategic clues
        if (result.count > 1 && fixAttempts >= maxFixAttempts) {
            console.log(`[Worker] Fallback: Adding 2 extra clues`);

            const extraPositions = [
                Math.floor(totalCells / 3),
                Math.floor(totalCells * 2 / 3)
            ];

            for (const pos of extraPositions) {
                if (!revealedIndices.has(pos)) {
                    revealedIndices.add(pos);
                }
            }

            numbers = createPuzzleFromIndices(revealedIndices);
            result = solvePuzzle(numbers);
            console.log(`[Worker] After fallback: ${result.count} solution(s), ${revealedIndices.size} total clues`);
        }

        if (result.count === 1) {
            console.log(`[Worker] ✅ Found unique puzzle with ${numbers.length} clues!`);
            return {
                numbers,
                solution: result.solutions[0],
                clueCount: numbers.length,
                attempts: attempts + 1
            };
        }

        attempts++;
    }

    // Failed to find unique puzzle
    console.warn('[Worker] ⚠️ Could not find unique solution after', maxAttempts, 'attempts');
    return null;
}

// Expose functions via Comlink
const api = {
    generatePuzzle,
    solvePuzzle
};

Comlink.expose(api);
