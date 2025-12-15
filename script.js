/* ================================
   SAFARI STAY – PUZZLE + ISLAND
   ================================ */

/* ---------- GLOBAL STATE ---------- */
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;

const COLORS = ["🍓","🥥","🌴","🐚","⭐","🍍"];

let board = new Array(TOTAL).fill(null);
let selectedIndex = null;
let isBusy = false;

let score = 0;
let moves = 30;

const BUSH_COST = 100;

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
  const br = Math.floor(a / WIDTH), bc = b % WIDTH;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

/* ---------- UI ---------- */
function updateIslandUI() {
  if (!coinsEl || !bushStatus) return;

  coinsEl.textContent = coins;

  bushStatus.textContent = bushCleared
    ? "✅ Bush cleared"
    : `🌿 Bush is blocking the path — Need ${BUSH_COST} coins to clear it`;
}

function updateUI() {
  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((t, i) => {
    t.classList.toggle("selected", i === selectedIndex);
    t.textContent = board[i] || "";
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
    tile.addEventListener("click", onTileClick);
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
      if (a && a === board[i + 1] && a === board[i + 2]) {
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
      const a = board[i];
      if (a && a === board[i + WIDTH] && a === board[i + 2 * WIDTH]) {
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

  matched.forEach(i => board[i] = null);

  score += matched.size * 10;
  coins += matched.size * 5;

  localStorage.setItem("coins", String(coins));
  return true;
}

function applyGravity() {
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

  const idx = Number(e.currentTarget.dataset.index);

  if (selectedIndex === null) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  if (selectedIndex === idx) {
    selectedIndex = null;
    updateUI();
    return;
  }

  if (!areNeighbors(selectedIndex, idx)) {
    selectedIndex = idx;
    updateUI();
    return;
  }

  isBusy = true;
  const a = selectedIndex;
  const b = idx;

  // swap
  [board[a], board[b]] = [board[b], board[a]];
  selectedIndex = null;
  updateUI();
  await sleep(80);

  // validate move
  const matches = findMatches();
  if (matches.size === 0) {
    // swap back
    [board[a], board[b]] = [board[b], board[a]];
    updateUI();
    isBusy = false;
    return;
  }

  moves--;
  updateUI();

  await resolveBoard();
  updateIslandUI();

  // 🎯 Goal reached message
  if (!bushCleared && coins >= BUSH_COST) {
    alert("🎉 Goal reached! You have enough coins to clear the bush. Go back to the island!");
  }

  isBusy = false;
}

/* ---------- ISLAND ---------- */
window.goToGame = function goToGame() {
  islandScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
};

window.backToIsland = function backToIsland() {
  gameScreen.classList.add("hidden");
  islandScreen.classList.remove("hidden");
  updateIslandUI();
};

window.clearBush = function clearBush() {
  if (bushCleared) return alert("Bush already cleared");
  if (coins < BUSH_COST) return alert("Not enough coins. Play puzzle!");

  coins -= BUSH_COST;
  bushCleared = true;

  localStorage.setItem("coins", String(coins));
  localStorage.setItem("bushCleared", "true");
  updateIslandUI();
};

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
