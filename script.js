/* ==========================================
   SAFARI STAY – UPGRADED MATCH PUZZLE
   - Matches of 3+ any length
   - Real gravity drop
   - Cascades / combos
   - Coins: +1 per move + tiles-cleared bonus
   - Simple hotel upgrades that spend coins
   ========================================== */

const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;

// Tile set (stable + fun)
const TILES = ["🍓", "🥥", "🌴", "🐚", "⭐", "🍍"];

// Puzzle rules
const START_MOVES = 30;
const COIN_PER_MOVE = 1;
const COIN_PER_TILE_CLEARED = 1; // bonus per tile cleared

// ---------- LocalStorage keys ----------
const KEY_COINS = "coins";
const KEY_ROOM_LVL = "mombasaRoomLevel";
const KEY_BELL = "mombasaBellboy";
const KEY_CLEAN = "mombasaCleaner";

// ---------- Elements (exist on Mombasa page only) ----------
const grid = document.getElementById("grid");
const movesEl = document.getElementById("moves");
const coinsEl = document.getElementById("coins");
const comboEl = document.getElementById("combo");
const clearedEl = document.getElementById("cleared");

const newGameBtn = document.getElementById("newGameBtn");
const resetCoinsBtn = document.getElementById("resetCoinsBtn");

// Upgrades UI
const roomCostEl = document.getElementById("roomCost");
const roomLevelEl = document.getElementById("roomLevel");
const buyRoomBtn = document.getElementById("buyRoomBtn");

const hireBellBtn = document.getElementById("hireBellBtn");
const hireCleanBtn = document.getElementById("hireCleanBtn");
const bellStatusEl = document.getElementById("bellStatus");
const cleanStatusEl = document.getElementById("cleanStatus");

// ---------- State ----------
let board = [];
let selectedIndex = null;
let isBusy = false;

let moves = START_MOVES;
let coins = Number(localStorage.getItem(KEY_COINS)) || 0;

let combo = 0;
let clearedTotal = 0;

// Upgrades
let roomLevel = Number(localStorage.getItem(KEY_ROOM_LVL)) || 0;
let bellHired = localStorage.getItem(KEY_BELL) === "true";
let cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

// ---------- Helpers ----------
function randomTile() {
  return TILES[Math.floor(Math.random() * TILES.length)];
}

function indexToRow(i) { return Math.floor(i / WIDTH); }
function indexToCol(i) { return i % WIDTH; }

function isAdjacent(a, b) {
  const ra = indexToRow(a), rb = indexToRow(b);
  return (
    (a === b - 1 && ra === rb) ||
    (a === b + 1 && ra === rb) ||
    a === b - WIDTH ||
    a === b + WIDTH
  );
}

function updateTopUI() {
  if (movesEl) movesEl.textContent = moves;
  if (coinsEl) coinsEl.textContent = coins;
  if (comboEl) comboEl.textContent = combo;
  if (clearedEl) clearedEl.textContent = clearedTotal;

  localStorage.setItem(KEY_COINS, String(coins));
}

function refreshUpgradesUI() {
  // If upgrades UI not on this page, skip safely
  if (!roomCostEl || !roomLevelEl || !buyRoomBtn) return;

  const cost = getRoomCost();
  roomCostEl.textContent = cost;
  roomLevelEl.textContent = roomLevel;

  if (bellStatusEl) bellStatusEl.textContent = bellHired ? "Hired ✅" : "Not hired";
  if (cleanStatusEl) cleanStatusEl.textContent = cleanerHired ? "Hired ✅" : "Not hired";

  buyRoomBtn.disabled = coins < cost;
  if (hireBellBtn) hireBellBtn.disabled = bellHired || coins < 30;
  if (hireCleanBtn) hireCleanBtn.disabled = cleanerHired || coins < 30;
}

function updateAllUI() {
  updateTopUI();
  refreshUpgradesUI();
}

function clearHighlights() {
  document.querySelectorAll(".cell").forEach(c => c.classList.remove("selected"));
}

function highlight(i) {
  clearHighlights();
  if (grid?.children?.[i]) grid.children[i].classList.add("selected");
}

function render() {
  if (!grid) return;
  for (let i = 0; i < TOTAL; i++) {
    grid.children[i].textContent = board[i] || "";
  }
}

// ---------- Match detection (3+ any length) ----------
function findAllMatches() {
  const toClear = new Set();

  // Rows
  for (let r = 0; r < WIDTH; r++) {
    let runStart = r * WIDTH;
    let runLen = 1;

    for (let c = 1; c < WIDTH; c++) {
      const i = r * WIDTH + c;
      const prev = r * WIDTH + (c - 1);

      if (board[i] && board[i] === board[prev]) runLen++;
      else {
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) toClear.add(runStart + k);
        }
        runStart = i;
        runLen = 1;
      }
    }

    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) toClear.add(runStart + k);
    }
  }

  // Columns
  for (let c = 0; c < WIDTH; c++) {
    let runStart = c;
    let runLen = 1;

    for (let r = 1; r < WIDTH; r++) {
      const i = r * WIDTH + c;
      const prev = (r - 1) * WIDTH + c;

      if (board[i] && board[i] === board[prev]) runLen++;
      else {
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) toClear.add(runStart + k * WIDTH);
        }
        runStart = i;
        runLen = 1;
      }
    }

    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) toClear.add(runStart + k * WIDTH);
    }
  }

  return [...toClear];
}

// ---------- Gravity (real drop) ----------
function applyGravity() {
  for (let c = 0; c < WIDTH; c++) {
    const colTiles = [];
    for (let r = WIDTH - 1; r >= 0; r--) {
      const i = r * WIDTH + c;
      if (board[i]) colTiles.push(board[i]);
    }

    // Refill column bottom-up
    let writeRow = WIDTH - 1;
    for (let t = 0; t < colTiles.length; t++) {
      board[writeRow * WIDTH + c] = colTiles[t];
      writeRow--;
    }
    while (writeRow >= 0) {
      board[writeRow * WIDTH + c] = randomTile();
      writeRow--;
    }
  }
}

// ---------- Clear matches and cascade ----------
function clearMatchesAndCascade() {
  const matches = findAllMatches();
  if (matches.length === 0) return false;

  // Clear
  matches.forEach(i => board[i] = "");
  const clearedNow = matches.length;
  clearedTotal += clearedNow;

  // Bonus coins per cleared tile
  coins += clearedNow * COIN_PER_TILE_CLEARED;

  updateAllUI();
  render();

  // Gravity + next cascade
  setTimeout(() => {
    applyGravity();
    render();

    setTimeout(() => {
      combo += 1;
      updateAllUI();
      clearMatchesAndCascade(); // chain until no more matches
    }, 140);
  }, 160);

  return true;
}

// ---------- Swap ----------
function doSwap(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
}

function attemptMove(a, b) {
  if (isBusy || moves <= 0) return;

  isBusy = true;

  doSwap(a, b);
  render();

  // coins per move
  moves -= 1;
  coins += COIN_PER_MOVE;

  // reset combo for new move
  combo = 0;
  updateAllUI();

  setTimeout(() => {
    const hadMatch = clearMatchesAndCascade();

    // If no match, revert swap (but move + coin still counted)
    if (!hadMatch) {
      setTimeout(() => {
        doSwap(a, b);
        render();
        isBusy = false;
      }, 140);
    } else {
      // End busy after cascades settle
      setTimeout(() => {
        isBusy = false;
      }, 900);
    }
  }, 120);
}

// ---------- Click handling ----------
function handleClick(i) {
  if (isBusy || moves <= 0) return;

  if (selectedIndex === null) {
    selectedIndex = i;
    highlight(i);
    return;
  }

  if (!isAdjacent(selectedIndex, i)) {
    selectedIndex = i;
    highlight(i);
    return;
  }

  // valid adjacency => move
  clearHighlights();
  const a = selectedIndex;
  selectedIndex = null;
  attemptMove(a, i);
}

// ---------- Build board ----------
function buildBoard() {
  if (!grid) return;

  grid.innerHTML = "";
  board = [];
  selectedIndex = null;
  isBusy = false;

  moves = START_MOVES;
  combo = 0;
  clearedTotal = 0;

  for (let i = 0; i < TOTAL; i++) {
    board.push(randomTile());

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.addEventListener("click", () => handleClick(i));
    grid.appendChild(cell);
  }

  render();
  updateAllUI();

  // Remove any starting matches
  clearMatchesAndCascade();
}

// ---------- Upgrades ----------
function getRoomCost() {
  // Increases as you level up (20, 35, 55, 80...)
  return Math.floor(20 + roomLevel * 15 + roomLevel * roomLevel * 5);
}

function spendCoins(amount) {
  if (coins < amount) return false;
  coins -= amount;
  localStorage.setItem(KEY_COINS, String(coins));
  updateAllUI();
  return true;
}

buyRoomBtn?.addEventListener("click", () => {
  const cost = getRoomCost();
  if (!spendCoins(cost)) return;

  roomLevel += 1;
  localStorage.setItem(KEY_ROOM_LVL, String(roomLevel));
  refreshUpgradesUI();
});

hireBellBtn?.addEventListener("click", () => {
  if (bellHired) return;
  if (!spendCoins(30)) return;

  bellHired = true;
  localStorage.setItem(KEY_BELL, "true");
  refreshUpgradesUI();
});

hireCleanBtn?.addEventListener("click", () => {
  if (cleanerHired) return;
  if (!spendCoins(30)) return;

  cleanerHired = true;
  localStorage.setItem(KEY_CLEAN, "true");
  refreshUpgradesUI();
});

// ---------- Buttons ----------
newGameBtn?.addEventListener("click", () => {
  buildBoard();
  refreshUpgradesUI();
});

resetCoinsBtn?.addEventListener("click", () => {
  coins = 0;
  localStorage.setItem(KEY_COINS, "0");
  updateAllUI();
  alert("Coins reset to 0 ✅");
});

// ---------- Start (SAFE) ----------
if (grid && movesEl && coinsEl) {
  buildBoard();
  updateAllUI();
}




