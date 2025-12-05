export const GRID_SIZE = 6;

// Check if two cells are adjacent
export function isAdjacent(idx1, idx2) {
    const row1 = Math.floor(idx1 / GRID_SIZE);
    const col1 = idx1 % GRID_SIZE;
    const row2 = Math.floor(idx2 / GRID_SIZE);
    const col2 = idx2 % GRID_SIZE;
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}
