# Puzzle Generation Algorithms

This document tracks the evolution of the puzzle generation logic used in the Zip Puzzle game, explaining the approaches tried, their limitations, and the solutions implemented.

## 1. Random Placement (Naive Approach)

**Strategy:**
1.  Select 4 random distinct cells on the grid.
2.  Assign them values 1, 2, 3, 4.
3.  Run a backtracking solver to check if a valid path exists and if it is unique.

**Outcome:**
*   **Failure Rate:** Extremely high (>99%).
*   **Problem:** The vast majority of random number placements on a grid do not allow for *any* valid Hamiltonian path (a path that visits every cell exactly once).
*   **Result:** The generator would loop 100+ times and fail to find a single valid puzzle, leading to infinite loops or fallbacks to broken puzzles.

## 2. Path-First Generation (Hamiltonian Path)

**Strategy:**
1.  **Generate Path First:** Use a randomized backtracking algorithm (with [Warnsdorff's heuristic](https://en.wikipedia.org/wiki/Knight%27s_tour#Warnsdorff's_rule)) to generate a valid [Hamiltonian path](https://en.wikipedia.org/wiki/Hamiltonian_path) covering the entire 6x6 grid.
2.  **Place Numbers:** Once a valid path is found, place numbers along that path.
    *   `1` at the start index.
    *   `4` at the end index.
    *   `2` and `3` at random intermediate indices along the path.
3.  **Check Uniqueness:** Run the solver on this configuration to see if the solution is unique.

**Outcome:**
*   **Success Rate:** 100% for *solvability* (every puzzle has at least one solution).
*   **Uniqueness:** Low with only 4 numbers.
*   **Problem:** While every puzzle is solvable, 4 numbers are often insufficient to constrain the path to a *single* unique solution. The solver often finds multiple valid paths connecting the same 4 points.
*   **Improvement Needed:** Need to increase the number of clues (numbers) or add other constraints (walls) to force uniqueness.

## 3. Minimum Numbers Optimization

**Strategy:**
1.  **Generate Path First:** Same as above.
2.  **Place More Clues:** Instead of just 4 numbers, we place **8 numbers** initially (Start, End, + 6 intermediates).
3.  **Distribution:** The intermediate numbers are distributed roughly evenly along the path segments to "pin" the path in place.
4.  **Check Uniqueness:** Run the solver.

**Outcome:**
*   **Success Rate:** Improved uniqueness, but not 100%.
*   **Problem:** Still occasionally produced non-unique puzzles or required too many clues (cluttered grid).
*   **Improvement Needed:** A smarter way to add clues only where necessary.

## 4. Adaptive Fix (The "Reveal" Method)

**Strategy:**
1.  **Path & Indices:** Generate a full path. Maintain a set of "revealed indices" (initially Start, End, + 2 intermediates).
2.  **Dynamic Value Assignment:** Convert the set of indices into puzzle numbers by sorting them by path order and assigning sequential values (1, 2, 3...).
3.  **Check Uniqueness:** Run the solver.
4.  **Adaptive Loop:** If multiple solutions are found:
    *   Find the **first index** where the intended path and the alternative path diverge.
    *   **Add this index** to the "revealed set".
    *   **Re-generate numbers** (step 2) with the new set.
    *   Repeat until unique.

**Outcome:**
*   **Success Rate:** 100% Unique & Solvable.
*   **Quality:** Produces clean puzzles with the minimum necessary clues (usually 5-7 total).
*   **Robustness:** Solves "duplicate value" bugs by dynamically managing the number sequence.

## 5. Smart Distance-Based Clue Placement (Current)

**Strategy:**
1.  **Generate Path First:** Same Hamiltonian path generation as before.
2.  **Smart Initial Placement:** Instead of random intermediate clues, use a distance-based scoring algorithm:
    *   Always place clues at start (index 0) and end (index N-1).
    *   For each remaining clue, select the path index that **maximizes** the minimum distance to all existing clues.
    *   Distance is calculated as: `score = minManhattanDistance + (minPathDistance / pathLength) * 0.15`
        *   **Manhattan Distance:** Spatial distance on the grid (|row1 - row2| + |col1 - col2|)
        *   **Path Distance:** Sequential distance along the path (|index1 - index2|)
    *   This ensures clues are well-distributed both spatially and sequentially.
3.  **Initial Clue Count:** Start with grid-size-specific clue counts (see table below).
4.  **Adaptive Fix (Refined):** If not unique after initial placement:
    *   **Max Attempts:** 15 iterations (increased from 10 due to better initial placement)
    *   **Strategy:** Find first divergence point between intended and alternative solutions, add clue there
    *   **Fallback:** If still not unique after 15 attempts, add 2 strategic clues at 1/3 and 2/3 path positions
    *   **Guarantee:** This ensures 100% unique puzzles while minimizing total clues

**Rationale:**
*   **Better Distribution:** Random placement often clusters clues or leaves large gaps. Distance-based placement ensures even coverage.
*   **Fewer Total Clues:** Well-placed initial clues are more likely to produce unique puzzles, reducing the need for adaptive fixes.
*   **Scalable:** The algorithm works for any grid size by adjusting the initial clue count.

**Expected Outcome:**
*   **Target:** 8-12 total clues for 6x6 grid (22-33% coverage) vs. previous ~25 clues (69% coverage).
*   **Success Rate:** >95% unique on first attempt, 100% after adaptive fix.
*   **Generation Time:** <100ms per puzzle.

**Grid Size Parameters (Implemented):**
| Grid Size | Total Cells | Initial Clues | Initial Coverage | Target Final Clues | Target Coverage |
|-----------|-------------|---------------|------------------|-------------------|-----------------|
| 5x5       | 25          | 6             | 24%              | 6-10              | 24-40%          |
| 6x6       | 36          | 8             | 22%              | 8-12              | 22-33%          |
| 7x7       | 49          | 10            | 20%              | 10-14             | 20-29%          |
| 8x8       | 64          | 12            | 19%              | 12-16             | 19-25%          |

**Note:** Initial clues are calculated as `start + end + intermediate` where intermediate counts are: 5x5=4, 6x6=6, 7x7=8, 8x8=10.

