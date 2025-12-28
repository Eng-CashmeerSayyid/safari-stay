// ===== Coins (shared) =====
function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}
function setCoins(n) {
  localStorage.setItem("coins", String(n));
}

// ===== Match-3 Puzzle =====
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const ITEMS = ["🍓","🥥","🌴","🐚","⭐","🍍"];

let board = new Array(TOTAL).fill(null);
let selected = null;

let score = 0;
let moves = 20;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const coinsEl = document.getElementById("coins");
const msgEl = document.getElementById("msg");

function randItem() {
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function renderHUD() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  coinsEl.textContent = getCoins();
}

function setMsg(t) {
  msgEl.textContent = t;
}

function createBoard() {
  // Fill, then remove any accidental starting matches
  for (let i = 0; i < TOTAL; i++) board[i] = randItem();
  // Clean initial matches a few times
  for (let k = 0; k < 6; k++) {
    const matched = findAllMatches();
    if (matched.size === 0) break;
    matched.forEach(i => board[i] = randItem());
  }
}

function draw() {
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

function findAllMatches() {
  const matches = new Set();

  // rows
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

  // cols
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

function dropAndFill() {
  // Drop down each column
  for (let c = 0; c < WIDTH; c++) {
    let writeRow = WIDTH - 1;
    for (let r = WIDTH - 1; r >= 0; r--) {
      const idx = r * WIDTH + c;
      if (board[idx] !== null) {
        const writeIdx = writeRow * WIDTH + c;
        board[writeIdx] = board[idx];
        if (writeIdx !== idx) board[idx] = null;
        writeRow--;
      }
    }
    // fill remaining
    for (let r = writeRow; r >= 0; r--) {
      board[r * WIDTH + c] = randItem();
    }
  }
}

function resolveMatchesLoop() {
  let totalCleared = 0;

  while (true) {
    const matches = findAllMatches();
    if (matches.size === 0) break;

    totalCleared += matches.size;
    matches.forEach(i => board[i] = null);

    // score: 10 points per tile cleared
    score += matches.size * 10;

    dropAndFill();
  }

  return totalCleared;
}

function onCellClick(i) {
  if (moves <= 0) {
    setMsg("No moves left. Cash out or start a new board.");
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

  if (!isNeighbor(selected, i)) {
    selected = i;
    draw();
    return;
  }

  // Try swap
  swap(selected, i);

  const matched = findAllMatches();
  if (matched.size === 0) {
    // invalid move, swap back
    swap(selected, i);
    setMsg("No match ❌ Try a different swap.");
  } else {
    moves -= 1;
    selected = null;

    // resolve matches (and cascades)
    const cleared = resolveMatchesLoop();
    setMsg(`Nice! Cleared ${cleared} tiles ✅`);
  }

  renderHUD();
  draw();

  if (moves === 0) setMsg("Moves finished. Tap Cash out to add coins 💰");
}

// Cash out score -> coins
document.getElementById("cashOutBtn").addEventListener("click", () => {
  const earned = Math.floor(score / 10); // 10 score = 1 coin
  if (earned <= 0) {
    setMsg("Score is too low to cash out. Make more matches.");
    return;
  }
  setCoins(getCoins() + earned);
  setMsg(`Cashed out ✅ +${earned} coins added! Go back to Mombasa.`);
  renderHUD();
});

document.getElementById("resetPuzzle").addEventListener("click", () => {
  score = 0;
  moves = 20;
  selected = null;
  createBoard();
  renderHUD();
  draw();
  setMsg("New board ready ✅");
});

// init
createBoard();
renderHUD();
draw();
