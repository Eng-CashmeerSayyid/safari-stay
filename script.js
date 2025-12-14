// Safari Stay — Match 3 (8x8)
// Full working: match -> clear -> fall -> refill

let coins = Number(localStorage.getItem("coins")) || 0;
let bushCleared = localStorage.getItem("bushCleared") === "true";

const islandScreen = document.getElementById("islandScreen");
const gameScreen = document.getElementById("gameScreen");
const coinsEl = document.getElementById("coins");
const bushStatus = document.getElementById("bushStatus");

function updateIslandUI() {
  coinsEl.textContent = coins;
  bushStatus.textContent = bushCleared
    ? "✅ Bush cleared"
    : "🌿 Bush is blocking the path";
}

const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;

const COLORS = [
  "#ff5c5c", // red
  "#4aa3ff", // blue
  "#2ed47a", // green
  "#ffd166", // yellow
  "#b388ff", // purple
  "#ff8a3d"  // orange
];

let board = new Array(TOTAL).fill(null);
let selectedIndex = null;
let isBusy = false;

let score = 0;
let moves = 30;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const newGameBtn = document.getElementById("newGameBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function areNeighbors(a, b) {
  const ar = Math.floor(a / WIDTH), ac = a % WIDTH;
  const br = Math.floor(b / WIDTH), bc = b % WIDTH;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function buildGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < TOTAL; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = String(i);
    tile.addEventListener("click", onTileClick);
    gridEl.appendChild(tile);
  }
}

function updateUI(extraClearingSet = null) {
  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((t, i) => {
    t.classList.toggle("selected", i === selectedIndex);
    if (extraClearingSet && extraClearingSet.has(i)) t.classList.add("clearing");
    else t.classList.remove("clearing");

    const val = board[i];
    // "null" becomes empty hole
    t.style.background = val ? val : "rgba(255,255,255,.06)";
    t.style.opacity = val ? "1" : "0.35";
  });

  scoreEl.textContent = String(score);
  movesEl.textContent = String(moves);
}

function fillBoardNoImmediateMatches() {
  // Fill with random colors, then resolve any accidental matches
  for (let i = 0; i < TOTAL; i++) board[i] = randColor();
}

function findMatches() {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < WIDTH; r++) {
    for (let c = 0; c < WIDTH - 2; c++) {
      const i = r * WIDTH + c;
      const a = board[i], b = board[i + 1], d = board[i + 2];
      if (a && a === b && a === d) {
        matched.add(i); matched.add(i + 1); matched.add(i + 2);
        let k = i + 3;
        while (k < r * WIDTH + WIDTH && board[k] === a) { matched.add(k); k++; }
      }
    }
  }

  // Vertical
  for (let c = 0; c < WIDTH; c++) {
    for (let r = 0; r < WIDTH - 2; r++) {
      const i = r * WIDTH + c;
      const a = board[i], b = board[i + WIDTH], d = board[i + 2 * WIDTH];
      if (a && a === b && a === d) {
        matched.add(i); matched.add(i + WIDTH); matched.add(i + 2 * WIDTH);
        let k = i + 3 * WIDTH;
        while (k < TOTAL && board[k] === a) { matched.add(k); k += WIDTH; }
      }
    }
  }

  return matched;
}

function clearMatches(matched) {
  if (matched.size === 0) return false;
  matched.forEach(i => (board[i] = null));
  score += matched.size * 10;
  return true;
}

function applyGravity() {
  // Pull non-null down in each column
  for (let c = 0; c < WIDTH; c++) {
    let writeRow = WIDTH - 1;
    for (let r = WIDTH - 1; r >= 0; r--) {
      const i = r * WIDTH + c;
      if (board[i] != null) {
        const target = writeRow * WIDTH + c;
        board[target] = board[i];
        if (target !== i) board[i] = null;
        writeRow--;
      }
    }
  }
}

function refill() {
  for (let i = 0; i < TOTAL; i++) {
    if (board[i] == null) board[i] = randColor();
  }
}

async function resolveBoard() {
  // Keep resolving until stable
  while (true) {
    const matched = findMatches();
    if (matched.size === 0) break;

    // show clearing animation
    updateUI(matched);
    await sleep(140);

    clearMatches(matched);
    updateUI();
    await sleep(120);

    applyGravity();
    updateUI();
    await sleep(120);

    refill();
    updateUI();
    await sleep(120);
  }
}

async function onTileClick(e) {
  if (isBusy) return;
  if (moves <= 0) return;

  const idx = Number(e.currentTarget.dataset.index);

  // first selection
  if (selectedIndex === null) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  // clicking same tile unselects
  if (selectedIndex === idx) {
    selectedIndex = null;
    updateUI();
    return;
  }

  // if not neighbor, switch selection
  if (!areNeighbors(selectedIndex, idx)) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  // Attempt swap
  isBusy = true;

  const a = selectedIndex, b = idx;
  swap(a, b);
  selectedIndex = null;
  updateUI();
  await sleep(80);

  // Valid move only if it creates a match
  const matched = findMatches();
  if (matched.size === 0) {
    // swap back (invalid)
    swap(a, b);
    updateUI();
    isBusy = false;
    return;
  }

  // consume move
  moves -= 1;
  updateUI();

  // resolve cascade
  await resolveBoard();

  isBusy = false;
}

function swap(i, j) {
  const temp = board[i];
  board[i] = board[j];
  board[j] = temp;
}

function shuffleBoard() {
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = board[i];
    board[i] = board[j];
    board[j] = t;
  }
}

async function newGame() {
  score = 0;
  moves = 30;
  selectedIndex = null;
  isBusy = true;

  fillBoardNoImmediateMatches();
  updateUI();
  await resolveBoard(); // clears any accidental initial matches
  isBusy = false;
}

newGameBtn.addEventListener("click", () => newGame());
shuffleBtn.addEventListener("click", async () => {
  if (isBusy) return;
  isBusy = true;
  shuffleBoard();
  updateUI();
  await resolveBoard();
  isBusy = false;
});

// Boot
buildGrid();
newGame();
