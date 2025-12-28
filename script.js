/* ==========================================================
   SAFARI STAY – MOMBASA PUZZLE (SAFE, NO CONFLICTS)
   - 8x8 match-3 style
   - +1 coin per MOVE (always)
   - bonus coins: +1 per tile cleared in matches
   - updates #coins and #moves in top bar
   - uses localStorage key: "coins" (shared with hotel.js)
   - DOES NOT control tabs (hotel.js controls tabs)
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const gridEl = document.getElementById("grid");
  if (!gridEl) return;

  // Top bar
  const coinsEl = document.getElementById("coins");
  const movesEl = document.getElementById("moves");

  // Mini stats
  const comboEl = document.getElementById("combo");
  const clearedEl = document.getElementById("cleared");

  // Buttons
  const newGameBtn = document.getElementById("newGameBtn");
  const resetCoinsBtn = document.getElementById("resetCoinsBtn");

  // Shared coins with hotel.js
  let coins = Number(localStorage.getItem("coins")) || 0;

  // Puzzle state
  const WIDTH = 8;
  const TOTAL = WIDTH * WIDTH;
  const ICONS = ["🍍","🥥","🐚","⭐","🍓","🌴"];

  let board = new Array(TOTAL).fill(null);
  let selected = null;
  let moves = 30;

  let combo = 0;
  let clearedTotal = 0;

  let busy = false;

  function saveCoins() {
    localStorage.setItem("coins", String(coins));
  }

  function renderTopBar() {
    if (coinsEl) coinsEl.textContent = String(coins);
    if (movesEl) movesEl.textContent = String(moves);
  }

  function renderMiniStats() {
    if (comboEl) comboEl.textContent = String(combo);
    if (clearedEl) clearedEl.textContent = String(clearedTotal);
  }

  function randIcon() {
    return ICONS[Math.floor(Math.random() * ICONS.length)];
  }

  function initBoard() {
    board = new Array(TOTAL).fill(null).map(() => randIcon());
    selected = null;
    moves = 30;
    combo = 0;
    clearedTotal = 0;
    // Clean starting matches
    while (crushMatches(true) > 0) {
      dropAndFill();
    }
    renderAll();
  }

  function renderAll() {
    renderTopBar();
    renderMiniStats();
    renderGrid();
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
      const cell = document.createElement("div");
      cell.className = "cell"; // IMPORTANT: matches your CSS
      cell.textContent = board[i] ?? " ";
      if (selected === i) cell.classList.add("selected");
      cell.addEventListener("click", () => onCellClick(i));
      gridEl.appendChild(cell);
    }
  }

  function neighbors(a, b) {
    const ax = a % WIDTH, ay = Math.floor(a / WIDTH);
    const bx = b % WIDTH, by = Math.floor(b / WIDTH);
    return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
  }

  function swap(a, b) {
    const t = board[a];
    board[a] = board[b];
    board[b] = t;
  }

  function hasAnyMatch() {
    // rows
    for (let r = 0; r < WIDTH; r++) {
      for (let c = 0; c < WIDTH - 2; c++) {
        const i = r * WIDTH + c;
        const v = board[i];
        if (v && v === board[i+1] && v === board[i+2]) return true;
      }
    }
    // cols
    for (let c = 0; c < WIDTH; c++) {
      for (let r = 0; r < WIDTH - 2; r++) {
        const i = r * WIDTH + c;
        const v = board[i];
        if (v && v === board[i+WIDTH] && v === board[i+2*WIDTH]) return true;
      }
    }
    return false;
  }

  function onCellClick(i) {
    if (busy) return;
    if (moves <= 0) return;

    if (selected === null) {
      selected = i;
      renderGrid();
      return;
    }

    if (selected === i) {
      selected = null;
      renderGrid();
      return;
    }

    if (!neighbors(selected, i)) {
      selected = i;
      renderGrid();
      return;
    }

    // attempt swap
    busy = true;
    const a = selected, b = i;
    swap(a, b);

    if (!hasAnyMatch()) {
      // invalid swap -> swap back
      swap(a, b);
      selected = null;
      busy = false;
      renderAll();
      return;
    }

    // VALID move: spend move + earn +1 coin
    moves -= 1;
    coins += 1;
    saveCoins();
    renderTopBar();

    selected = null;

    // resolve matches chain
    combo = 0;
    setTimeout(() => resolveChain(), 60);
  }

  // Crush matches. If silent=true, no coin bonus.
  function crushMatches(silent=false) {
    let crushed = 0;

    // Row runs
    for (let r = 0; r < WIDTH; r++) {
      let start = r * WIDTH;
      let runVal = board[start];
      let runLen = 1;

      for (let c = 1; c < WIDTH; c++) {
        const idx = r * WIDTH + c;
        const v = board[idx];
        if (v && v === runVal) runLen++;
        else {
          if (runVal && runLen >= 3) {
            for (let k = 0; k < runLen; k++) {
              board[start + k] = null;
              crushed++;
            }
          }
          start = idx;
          runVal = v;
          runLen = 1;
        }
      }
      if (runVal && runLen >= 3) {
        for (let k = 0; k < runLen; k++) {
          board[start + k] = null;
          crushed++;
        }
      }
    }

    // Col runs
    for (let c = 0; c < WIDTH; c++) {
      let start = c;
      let runVal = board[start];
      let runLen = 1;

      for (let r = 1; r < WIDTH; r++) {
        const idx = r * WIDTH + c;
        const v = board[idx];
        if (v && v === runVal) runLen++;
        else {
          if (runVal && runLen >= 3) {
            for (let k = 0; k < runLen; k++) {
              board[start + k*WIDTH] = null;
              crushed++;
            }
          }
          start = idx;
          runVal = v;
          runLen = 1;
        }
      }
      if (runVal && runLen >= 3) {
        for (let k = 0; k < runLen; k++) {
          board[start + k*WIDTH] = null;
          crushed++;
        }
      }
    }

    if (crushed > 0) {
      combo += 1;
      clearedTotal += crushed;

      // bonus: +1 coin per tile cleared
      if (!silent) {
        coins += crushed;
        saveCoins();
      }
    }

    return crushed;
  }

  function dropAndFill() {
    for (let c = 0; c < WIDTH; c++) {
      let write = (WIDTH - 1) * WIDTH + c;
      for (let r = WIDTH - 1; r >= 0; r--) {
        const read = r * WIDTH + c;
        if (board[read] !== null) {
          board[write] = board[read];
          if (write !== read) board[read] = null;
          write -= WIDTH;
        }
      }
      for (let r = Math.floor(write / WIDTH); r >= 0; r--) {
        const idx = r * WIDTH + c;
        if (board[idx] === null) board[idx] = randIcon();
      }
    }
  }

  function resolveChain() {
    const crushed = crushMatches(false);
    if (crushed > 0) {
      dropAndFill();
      renderAll();
      setTimeout(resolveChain, 120);
    } else {
      busy = false;
      renderAll();
    }
  }

  // Buttons
  newGameBtn?.addEventListener("click", () => {
    initBoard();
  });

  resetCoinsBtn?.addEventListener("click", () => {
    coins = 0;
    saveCoins();
    renderTopBar();
  });

  // Boot
  renderTopBar();
  renderMiniStats();
  initBoard();
});






