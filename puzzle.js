// ===============================
// SAFARI STAY - PUZZLE (MATCH 3)
// RULE: Every valid move = +1 coin
// ===============================

// ----- Coins (shared across the whole game) -----
function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}
function setCoins(n) {
  localStorage.setItem("coins", String(n));
}

// ----- Puzzle constants -----
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const ITEMS = ["🍓", "🥥", "🌴", "🐚", "⭐", "🍍"];

// ----- State -----
let board = new Array(TOTAL).fill(null);
let selected = null;

let score = 0;   // optional: still useful for later
let moves = 20;

// ----- Elements -----
const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const coinsEl = document.getElementById("coins");
const msgEl = document.getElementById("msg");

// Buttons (safe even if missing)
const resetBtn = document.getElementById("resetPuzzle");
const cashOutBtn = document.getElementById("cashOutBtn"); // optional old button

// ----- Helpers -----
function randItem() {
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function setMsg(t) {
  if (msgEl) msgEl.textContent = t;
}

function renderHUD() {
  if (scoreEl) scoreEl.textContent = score;
  if (movesEl) movesEl.textContent = moves;
  if (coinsEl) coinsEl.textContent = getCoins();
}

// ----- Board creation (avoid starting matches) -----
function createBoard() {
  for (let i = 0; i < TOTAL; i++) board[i] = randItem();

  // Remove accidental starting matches a few times
  for (let k = 0; k < 8; k++) {
    const matched = findAllMatches();
    if (matched.size === 0) break;
    matched.forEach(i => (board[i] = randItem()));
  }
}

// ----- Drawing -----
function draw() {
  if (!gridEl) return;

  gridEl.innerHTML = "";
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement("div");
    cell.className = "cell" + (selected === i ? " selected" : "");
    cell.textContent = board[i];

    cell.addEventListener("click", () => onCellClick(i));
    gridEl.appendChild(cell);
  }
}

function isNeighbor(a, b) {
  const ar = Math.floor(a / WIDTH), ac = a % WIDTH;
  const br = Math.floor(b / WIDTH), bc = b % WIDTH;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

function swap(a, b) {
  const tmp = board[a];
  board[a] = board[b];
  board[b] = tmp;
}

// ----- Find all matches (3+) -----
function findAllMatches() {
  const matches = new Set();

  // Rows
  for (let r = 0; r < WIDTH; r++) {
    let runStart = r * WIDTH;
    let runLen = 1;

    for (let c = 1; c < WIDTH; c++) {
      const idx = r * WIDTH + c;
      const prev = r * WIDTH + (c - 1);

      if (board[idx] === board[prev]) runLen++;
      else {
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) matches.add(runStart + k);
        }
        runStart = idx;
        runLen = 1;
      }
    }

    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) matches.add(runStart + k);
    }
  }

  // Columns
  for (let c = 0; c < WIDTH; c++) {
    let runStart = c;
    let runLen = 1;

    for (let r = 1; r < WIDTH; r++) {
      const idx = r * WIDTH + c;
      const prev = (r - 1) * WIDTH + c;

      if (board[idx] === board[prev]) runLen++;
      else {
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) matches.add(runStart + k * WIDTH);
        }
        runStart = idx;
        runLen = 1;
      }
    }

    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) matches.add(runStart + k * WIDTH);
    }
  }

  return matches;
}

// ----- Drop and refill after matches -----
function dropAndFill() {
  for (let c = 0; c < WIDTH; c++) {
    let writeRow = WIDTH - 1;

    // drop existing items down
    for (let r = WIDTH - 1; r >= 0; r--) {
      const idx = r * WIDTH + c;
      if (board[idx] !== null) {
        const writeIdx = writeRow * WIDTH + c;
        board[writeIdx] = board[idx];
        if (writeIdx !== idx) board[idx] = null;
        writeRow--;
      }
    }

    // fill remaining spaces
    for (let r = writeRow; r >= 0; r--) {
      board[r * WIDTH + c] = randItem();
    }
  }
}

// ----- Resolve matches repeatedly (cascades) -----
function resolveMatchesLoop() {
  let totalCleared = 0;

  while (true) {
    const matches = findAllMatches();
    if (matches.size === 0) break;

    totalCleared += matches.size;

    // clear them
    matches.forEach(i => (board[i] = null));

    // score is optional; keep it for future features
    score += matches.size * 10;

    dropAndFill();
  }

  return totalCleared;
}

// ----- Click handler (main game logic) -----
function onCellClick(i) {
  if (moves <= 0) {
    setMsg("No moves left. Tap 'New board' to play again.");
    return;
  }

  if (selected === null) {
    selected = i;
    draw();
    return;
  }

  if (selected === i) {
    selected = null;
    draw();
    return;
  }

  // Only allow swap with neighbors
  if (!isNeighbor(selected, i)) {
    selected = i;
    draw();
    return;
  }

  // Try swap
  swap(selected, i);

  const matched = findAllMatches();

  if (matched.size === 0) {
    // invalid move: swap back
    swap(selected, i);
    setMsg("No match ❌ Try a different swap.");
    selected = null;
  } else {
    // valid move ✅
    moves -= 1;
    selected = null;

    const cleared = resolveMatchesLoop();

    // ⭐ RULE YOU WANTED:
    // Every valid move = +1 coin instantly
    setCoins(getCoins() + 1);

    setMsg(`Nice! Cleared ${cleared} tiles ✅ +1 coin 💰`);
  }

  renderHUD();
  draw();

  if (moves === 0) setMsg("Moves finished. Tap 'New board' to play again.");
}

// ----- Reset button -----
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    score = 0;
    moves = 20;
    selected = null;
    createBoard();
    renderHUD();
    draw();
    setMsg("New board ready ✅");
  });
}

// ----- Optional old Cash Out button (safe: just explains it's not used) -----
if (cashOutBtn) {
  cashOutBtn.addEventListener("click", () => {
    setMsg("Coins are earned instantly per valid move ✅ No cash out needed.");
  });
}

// ----- INIT -----
createBoard();
renderHUD();
draw();
setMsg("Tap one item, then a neighbor to swap. Valid move = +1 coin 💰");

