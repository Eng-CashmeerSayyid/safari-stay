/* ==========================================
   SAFARI STAY – UPGRADED MATCH PUZZLE
   + TAB SWITCHER (single source of truth)
   + Staff hire events -> hotel.js updates live
   ========================================== */

// =================== TAB SWITCHER (SAFE) ===================
(function initTabs(){
  const tabPuzzle = document.getElementById("tabPuzzle");
  const tabHotel  = document.getElementById("tabHotel");
  const viewPuzzle = document.getElementById("viewPuzzle");
  const viewHotel  = document.getElementById("viewHotel");

  if (!tabPuzzle || !tabHotel || !viewPuzzle || !viewHotel) return;

  function showPuzzle(){
    tabPuzzle.classList.add("active");
    tabHotel.classList.remove("active");
    viewPuzzle.classList.remove("hidden");
    viewHotel.classList.add("hidden");
  }

  function showHotel(){
    tabHotel.classList.add("active");
    tabPuzzle.classList.remove("active");
    viewHotel.classList.remove("hidden");
    viewPuzzle.classList.add("hidden");
  }

  tabPuzzle.addEventListener("click", showPuzzle);
  tabHotel.addEventListener("click", showHotel);

  // default view
  showPuzzle();
})();

/* =================== PUZZLE CORE =================== */
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;

// Tile set
const TILES = ["🍓", "🥥", "🌴", "🐚", "⭐", "🍍"];

// Rules
const START_MOVES = 30;
const COIN_PER_MOVE = 1;
const COIN_PER_TILE_CLEARED = 1;

// Storage keys
const KEY_COINS = "coins";
const KEY_ROOM_LVL = "mombasaRoomLevel";
const KEY_BELL = "mombasaBellboy";
const KEY_CLEAN = "mombasaCleaner";

// Elements
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

// Guard: if someone opens index.html, these may not exist
if (!grid || !movesEl || !coinsEl) {
  // Do nothing on pages without the puzzle UI
} else {

  // State
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

  function randomTile() {
    return TILES[Math.floor(Math.random() * TILES.length)];
  }

  function indexToRow(i) { return Math.floor(i / WIDTH); }

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
    movesEl.textContent = moves;
    coinsEl.textContent = coins;
    if (comboEl) comboEl.textContent = combo;
    if (clearedEl) clearedEl.textContent = clearedTotal;
    localStorage.setItem(KEY_COINS, String(coins));
  }

  function clearHighlights() {
    document.querySelectorAll(".cell").forEach(c => c.classList.remove("selected"));
  }

  function highlight(i) {
    clearHighlights();
    if (grid.children[i]) grid.children[i].classList.add("selected");
  }

  function render() {
    for (let i = 0; i < TOTAL; i++) {
      if (grid.children[i]) grid.children[i].textContent = board[i] || "";
    }
  }

  // Find matches (3+ rows/cols)
  function findAllMatches() {
    const toClear = new Set();

    // rows
    for (let r = 0; r < WIDTH; r++) {
      let runStart = r * WIDTH;
      let runLen = 1;
      for (let c = 1; c < WIDTH; c++) {
        const i = r * WIDTH + c;
        const prev = r * WIDTH + (c - 1);
        if (board[i] && board[i] === board[prev]) runLen++;
        else {
          if (runLen >= 3) for (let k = 0; k < runLen; k++) toClear.add(runStart + k);
          runStart = i;
          runLen = 1;
        }
      }
      if (runLen >= 3) for (let k = 0; k < runLen; k++) toClear.add(runStart + k);
    }

    // cols
    for (let c = 0; c < WIDTH; c++) {
      let runStart = c;
      let runLen = 1;
      for (let r = 1; r < WIDTH; r++) {
        const i = r * WIDTH + c;
        const prev = (r - 1) * WIDTH + c;
        if (board[i] && board[i] === board[prev]) runLen++;
        else {
          if (runLen >= 3) for (let k = 0; k < runLen; k++) toClear.add(runStart + k * WIDTH);
          runStart = i;
          runLen = 1;
        }
      }
      if (runLen >= 3) for (let k = 0; k < runLen; k++) toClear.add(runStart + k * WIDTH);
    }

    return [...toClear];
  }

  function applyGravity() {
    for (let c = 0; c < WIDTH; c++) {
      const colTiles = [];
      for (let r = WIDTH - 1; r >= 0; r--) {
        const i = r * WIDTH + c;
        if (board[i]) colTiles.push(board[i]);
      }
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

  function clearMatchesAndCascade() {
    const matches = findAllMatches();
    if (matches.length === 0) return false;

    matches.forEach(i => board[i] = "");
    const clearedNow = matches.length;
    clearedTotal += clearedNow;

    coins += clearedNow * COIN_PER_TILE_CLEARED;

    updateTopUI();
    render();

    setTimeout(() => {
      applyGravity();
      render();

      setTimeout(() => {
        combo += 1;
        updateTopUI();
        clearMatchesAndCascade();
      }, 140);
    }, 160);

    return true;
  }

  function doSwap(a, b) {
    [board[a], board[b]] = [board[b], board[a]];
  }

  function attemptMove(a, b) {
    if (isBusy || moves <= 0) return;

    isBusy = true;

    doSwap(a, b);
    render();

    moves -= 1;
    coins += COIN_PER_MOVE;

    combo = 0;
    updateTopUI();
    refreshUpgradesUI();

    setTimeout(() => {
      const hadMatch = clearMatchesAndCascade();

      if (!hadMatch) {
        setTimeout(() => {
          doSwap(a, b);
          render();
          isBusy = false;
        }, 140);
      } else {
        setTimeout(() => {
          isBusy = false;
          refreshUpgradesUI();
        }, 900);
      }
    }, 120);
  }

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

    clearHighlights();
    const a = selectedIndex;
    selectedIndex = null;
    attemptMove(a, i);
  }

  function buildBoard() {
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
    updateTopUI();

    clearMatchesAndCascade(); // remove starting matches
  }

  // ---------- Upgrades ----------
  function getRoomCost() {
    return Math.floor(20 + roomLevel * 15 + roomLevel * roomLevel * 5);
  }

  function refreshUpgradesUI() {
    if (!roomCostEl || !roomLevelEl) return;

    const cost = getRoomCost();
    roomCostEl.textContent = cost;
    roomLevelEl.textContent = roomLevel;

    if (bellStatusEl) bellStatusEl.textContent = bellHired ? "Hired ✅" : "Not hired";
    if (cleanStatusEl) cleanStatusEl.textContent = cleanerHired ? "Hired ✅" : "Not hired";

    if (buyRoomBtn) buyRoomBtn.disabled = coins < cost;
    if (hireBellBtn) hireBellBtn.disabled = bellHired || coins < 30;
    if (hireCleanBtn) hireCleanBtn.disabled = cleanerHired || coins < 30;
  }

  function spendCoins(amount) {
    if (coins < amount) return false;
    coins -= amount;
    localStorage.setItem(KEY_COINS, String(coins));
    updateTopUI();
    return true;
  }

  // Fire event so hotel.js updates live
  function notifyStaffUpdate(){
    window.dispatchEvent(new Event("staffUpdated"));
  }

  if (buyRoomBtn) buyRoomBtn.addEventListener("click", () => {
    const cost = getRoomCost();
    if (!spendCoins(cost)) return;

    roomLevel += 1;
    localStorage.setItem(KEY_ROOM_LVL, String(roomLevel));
    refreshUpgradesUI();
  });

  if (hireBellBtn) hireBellBtn.addEventListener("click", () => {
    if (bellHired) return;
    if (!spendCoins(30)) return;

    bellHired = true;
    localStorage.setItem(KEY_BELL, "true");
    refreshUpgradesUI();
    notifyStaffUpdate();
  });

  if (hireCleanBtn) hireCleanBtn.addEventListener("click", () => {
    if (cleanerHired) return;
    if (!spendCoins(30)) return;

    cleanerHired = true;
    localStorage.setItem(KEY_CLEAN, "true");
    refreshUpgradesUI();
    notifyStaffUpdate();
  });

  if (newGameBtn) newGameBtn.addEventListener("click", () => {
    buildBoard();
    refreshUpgradesUI();
  });

  if (resetCoinsBtn) resetCoinsBtn.addEventListener("click", () => {
    coins = 0;
    localStorage.setItem(KEY_COINS, "0");
    updateTopUI();
    refreshUpgradesUI();
    alert("Coins reset to 0 ✅");
  });

  // Start
  buildBoard();
  updateTopUI();
  refreshUpgradesUI();
  notifyStaffUpdate(); // initial sync on page load
}





