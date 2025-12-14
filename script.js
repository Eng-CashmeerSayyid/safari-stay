/* ================================
   SAFARI STAY – PUZZLE + ISLAND
   ================================ */

/* ---------- GLOBAL STATE ---------- */
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;

const COLORS = ["#ff5c5c","#4aa3ff","#2ed47a","#ffd166","#b388ff","#ff8a3d"];

let board = new Array(TOTAL).fill(null);
let selectedIndex = null;
let isBusy = false;

let score = 0;
let moves = 30;

// Island economy
let coins = Number(localStorage.getItem("coins")) || 0;
let bushCleared = localStorage.getItem("bushCleared") === "true";

/* ---------- ELEMENTS ---------- */
const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");

const islandScreen = document.getElementById("islandScreen");
const gameScreen = document.getElementById("gameScreen");
const coinsEl = document.getElementById("coins");
const bushStatus = document.getElementById("bushStatus");

/* ---------- HELPERS ---------- */
function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function areNeighbors(a, b) {
  const ar = Math.floor(a / WIDTH), ac = a % WIDTH;
  const br = Math.floor(b / WIDTH), bc = b % WIDTH;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

/* ---------- UI ---------- */
function updateIslandUI() {
  coinsEl.textContent = coins;
  bushStatus.textContent = bushCleared
    ? "✅ Bush cleared"
    : "🌿 Bush is blocking the path";
}

function updateUI() {
  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((t, i) => {
    t.classList.toggle("selected", i === selectedIndex);
    t.style.background = board[i] || "rgba(255,255,255,.08)";
  });
  scoreEl.textContent = score;
  movesEl.textContent = moves;
}

/* ---------- GRID ---------- */
function buildGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < TOTAL; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = i;
    tile.onclick = onTileClick;
    gridEl.appendChild(tile);
  }
}

/* ---------- MATCH LOGIC ---------- */
function findMatches() {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < WIDTH; r++) {
    for (let c = 0; c < WIDTH - 2; c++) {
      const i = r * WIDTH + c;
      const a = board[i];
      if (a && a === board[i+1] && a === board[i+2]) {
        matched.add(i); matched.add(i+1); matched.add(i+2);
      }
    }
  }

  // Vertical
  for (let c = 0; c < WIDTH; c++) {
    for (let r = 0; r < WIDTH - 2; r++) {
      const i = r * WIDTH + c;
      const a = board[i];
      if (a && a === board[i+WIDTH] && a === board[i+2*WIDTH]) {
        matched.add(i); matched.add(i+WIDTH); matched.add(i+2*WIDTH);
      }
    }
  }

  return matched;
}

function clearMatches(matched) {
  if (matched.size === 0) return false;

  matched.forEach(i => board[i] = null);

  score += matched.size * 10;
  coins += matched.size * 5;

  localStorage.setItem("coins", coins);
  return true;
}

function applyGravity() {
  for (let c = 0; c < WIDTH; c++) {
    let writeRow = WIDTH - 1;
    for (let r = WIDTH - 1; r >= 0; r--) {
      const i = r * WIDTH + c;
      if (board[i]) {
        board[writeRow * WIDTH + c] = board[i];
        if (writeRow !== r) board[i] = null;
        writeRow--;
      }
    }
  }
}

function refill() {
  for (let i = 0; i < TOTAL; i++) {
    if (!board[i]) board[i] = randColor();
  }
}

async function resolveBoard() {
  while (true) {
    const matches = findMatches();
    if (matches.size === 0) break;
    clearMatches(matches);
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

/* ---------- GAMEPLAY ---------- */
async function onTileClick(e) {
  if (isBusy || moves <= 0) return;

  const idx = Number(e.target.dataset.index);

  if (selectedIndex === null) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  if (!areNeighbors(selectedIndex, idx)) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  isBusy = true;
  [board[selectedIndex], board[idx]] = [board[idx], board[selectedIndex]];
  selectedIndex = null;
  updateUI();
  await sleep(80);

  const matches = findMatches();
  if (matches.size === 0) {
    [board[selectedIndex], board[idx]] = [board[idx], board[selectedIndex]];
    updateUI();
    isBusy = false;
    return;
  }

  moves--;
  await resolveBoard();
  isBusy = false;
}

/* ---------- ISLAND ---------- */
function goToGame() {
  islandScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function backToIsland() {
  gameScreen.classList.add("hidden");
  islandScreen.classList.remove("hidden");
  updateIslandUI();
}

function clearBush() {
  if (bushCleared) return alert("Bush already cleared");
  if (coins < 100) return alert("Not enough coins. Play puzzle!");

  coins -= 100;
  bushCleared = true;
  localStorage.setItem("coins", coins);
  localStorage.setItem("bushCleared", "true");
  updateIslandUI();
}

/* ---------- START ---------- */
function newGame() {
  board = board.map(() => randColor());
  score = 0;
  moves = 30;
  updateUI();
  resolveBoard();
}

buildGrid();
newGame();
updateIslandUI();
