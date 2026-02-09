/* =========================
Safari Stay – puzzle.js (MATCH-3 - UPDATED & SAFEST)
- 5×5 board
- Swap adjacent tiles
- Match 3+ clears + cascades
- Earn coins per cleared tile
- Invalid swap = shake + vibrate
- Uses <img> inside tiles (prevents "?" reveal issues)
- Tries both asset paths: assets/puzzle/* OR images/tiles/*
========================= */

(() => {
  "use strict";

  // ---------- SETTINGS ----------
  const SIZE = 5;
  const TARGET_COINS = 300;
  const COINS_PER_TILE = 5;
  const ANIM_MS = 220;
  const CASCADE_DELAY = 80;

  const NAMES = ["palm","shell","fish","coconut","wave","sun"];
  const TILE_EMOJI = ["🌴","🐚","🐟","🥥","🌊","☀️"];

  // Try these base folders in order (GitHub Pages case-sensitive)
  const BASE_PATHS = ["assets/puzzle", "images/tiles"];

  // ---------- DOM ----------
  const boardEl  = document.getElementById("board");
  const coinsEl  = document.getElementById("coins");
  const targetEl = document.getElementById("target");
  const msgEl    = document.getElementById("msg");
  const resetBtn = document.getElementById("resetPuzzle");

  if (!boardEl) {
    console.warn("Puzzle: #board not found. Add <div id='board' class='board'></div>.");
    return;
  }
  if (targetEl) targetEl.textContent = String(TARGET_COINS);

  // ---------- STATE ----------
  let grid = [];
  let selected = null;   // {r,c}
  let locked = false;
  let coins = 0;

  // ---------- STORAGE ----------
  function loadCoins() {
    const v = Number(localStorage.getItem("coins") || "0");
    return Number.isFinite(v) ? v : 0;
  }
  function saveCoins(n) {
    localStorage.setItem("coins", String(n));
  }

  // ---------- HELPERS ----------
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));
  const inBounds = (r,c) => r>=0 && r<SIZE && c>=0 && c<SIZE;

  function vibrate(ms = 60) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function setMsg(t) {
    if (msgEl) msgEl.textContent = t || "";
  }

  function addCoins(tileCount) {
  coins += tileCount * COINS_PER_TILE;
  saveCoins(coins);
  if (coinsEl) coinsEl.textContent = String(coins);

  // ===== PUZZLE → HOTEL BOOSTS =====
  if (tileCount >= 4) unlockBoost("snackBoost");
  if (tileCount >= 5) unlockBoost("cleanerBoost");
  if (tileCount >= 6) unlockBoost("patienceBoost");

  if (coins >= TARGET_COINS) showWin();
}

  function randomType() {
    return Math.floor(Math.random() * NAMES.length);
  }

  function safeRandomType(r, c) {
    for (let tries = 0; tries < 30; tries++) {
      const t = randomType();

      const l1 = c - 1 >= 0 ? grid[r][c - 1] : null;
      const l2 = c - 2 >= 0 ? grid[r][c - 2] : null;
      if (l1 === t && l2 === t) continue;

      const u1 = r - 1 >= 0 ? grid[r - 1][c] : null;
      const u2 = r - 2 >= 0 ? grid[r - 2][c] : null;
      if (u1 === t && u2 === t) continue;

      return t;
    }
    return randomType();
  }

  function neighbors(a, b) {
    return (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;
  }

  // ---------- ASSET RESOLUTION ----------
  function buildSrc(name, baseIndex) {
    return `${BASE_PATHS[baseIndex]}/${name}.png`;
  }

  // ---------- BUILD BOARD DOM ----------
  function buildBoardDOM() {
    boardEl.style.setProperty("--size", SIZE);
    boardEl.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tile";
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);

        // real image element (prevents "?" reveal issues)
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        btn.appendChild(img);

        // emoji fallback text (if you want to show it via CSS)
        const span = document.createElement("span");
        span.className = "emojiFallback";
        btn.appendChild(span);

        boardEl.appendChild(btn);
      }
    }

    boardEl.addEventListener("click", onBoardClick);
  }

  function getTileEl(r,c) {
    return boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  }

  // Try base paths until one loads
  function setImgWithFallback(imgEl, name, emoji) {
    let baseTry = 0;

    function tryNext() {
      if (baseTry >= BASE_PATHS.length) {
        // no image worked -> rely on emoji
        imgEl.removeAttribute("src");
        imgEl.style.display = "none";
        return;
      }
      imgEl.style.display = "";
      imgEl.src = buildSrc(name, baseTry);
      baseTry++;
    }

    imgEl.onerror = () => tryNext();
    imgEl.onload = () => { /* ok */ };
    tryNext();
  }

  function paint() {
    const tiles = boardEl.querySelectorAll(".tile");
    tiles.forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const t = grid[r][c];

      el.classList.toggle("selected", !!selected && selected.r === r && selected.c === c);

      const img = el.querySelector("img");
      const span = el.querySelector(".emojiFallback");

      if (t === -1) {
        el.classList.add("empty");
        if (img) { img.removeAttribute("src"); img.style.display = "none"; }
        if (span) span.textContent = "";
        return;
      }

      el.classList.remove("empty");
      const name = NAMES[t];

      if (span) span.textContent = TILE_EMOJI[t];

      if (img) {
        img.alt = name;
        setImgWithFallback(img, name, TILE_EMOJI[t]);
      }
    });
  }

  // ---------- MATCHING ----------
  function findMatches() {
    const toCrush = new Set();

    // horizontal
    for (let r = 0; r < SIZE; r++) {
      let start = 0;
      while (start < SIZE) {
        const t = grid[r][start];
        if (t === -1) { start++; continue; }
        let end = start + 1;
        while (end < SIZE && grid[r][end] === t) end++;
        if (end - start >= 3) {
          for (let c = start; c < end; c++) toCrush.add(`${r},${c}`);
        }
        start = end;
      }
    }

    // vertical
    for (let c = 0; c < SIZE; c++) {
      let start = 0;
      while (start < SIZE) {
        const t = grid[start][c];
        if (t === -1) { start++; continue; }
        let end = start + 1;
        while (end < SIZE && grid[end][c] === t) end++;
        if (end - start >= 3) {
          for (let r = start; r < end; r++) toCrush.add(`${r},${c}`);
        }
        start = end;
      }
    }

    return [...toCrush].map(s => {
      const [r,c] = s.split(",").map(Number);
      return {r,c};
    });
  }

  function anyMatchExists() {
    return findMatches().length > 0;
  }

  function swap(a, b) {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }

  // ---------- ANIMATIONS ----------
  async function invalidSwapFeedback(a, b) {
    const elA = getTileEl(a.r, a.c);
    const elB = getTileEl(b.r, b.c);
    if (elA) elA.classList.add("shake");
    if (elB) elB.classList.add("shake");
    vibrate(70);
    await sleep(ANIM_MS);
    if (elA) elA.classList.remove("shake");
    if (elB) elB.classList.remove("shake");
  }

  async function crush(matches) {
    matches.forEach(({r,c}) => {
      const el = getTileEl(r,c);
      if (el) el.classList.add("crush");
    });

    vibrate(35);
    await sleep(ANIM_MS);

    matches.forEach(({r,c}) => {
      grid[r][c] = -1;
      const el = getTileEl(r,c);
      if (el) el.classList.remove("crush");
    });

    addCoins(matches.length);
  }

  function applyGravity() {
    for (let c = 0; c < SIZE; c++) {
      let writeRow = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        if (grid[r][c] !== -1) {
          grid[writeRow][c] = grid[r][c];
          if (writeRow !== r) grid[r][c] = -1;
          writeRow--;
        }
      }
      for (let r = writeRow; r >= 0; r--) grid[r][c] = -1;
    }
  }

  function refill() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === -1) grid[r][c] = safeRandomType(r, c);
      }
    }
  }

  async function resolveBoard() {
    while (true) {
      const matches = findMatches();
      if (matches.length === 0) break;

      await crush(matches);
      applyGravity();
      refill();
      paint();
      await sleep(CASCADE_DELAY);
    }
  }

  // ---------- INPUT ----------
  async function onBoardClick(e) {
    if (locked) return;

    const tile = e.target.closest(".tile");
    if (!tile || !boardEl.contains(tile)) return;

    const r = Number(tile.dataset.r);
    const c = Number(tile.dataset.c);

    if (!selected) {
      selected = { r, c };
      paint();
      return;
    }

    const prev = selected;
    selected = null;

    if (prev.r === r && prev.c === c) {
      paint();
      return;
    }

    if (!neighbors(prev, { r, c })) {
      selected = { r, c };
      paint();
      return;
    }

    locked = true;
    setMsg("");

    swap(prev, { r, c });
    paint();

    if (anyMatchExists()) {
      await resolveBoard();
      locked = false;
      paint();
      return;
    }

    await invalidSwapFeedback(prev, { r, c });
    swap(prev, { r, c });
    paint();

    locked = false;
    setMsg("No match ❌ Try a different swap.");
  }

  // ---------- INIT / RESET ----------
  function initGrid() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        grid[r][c] = safeRandomType(r, c);
      }
    }
  }

  async function reset() {
    locked = true;
    selected = null;
    setMsg("New board ready ✅");
    initGrid();
    paint();
    await resolveBoard();
    locked = false;
  }

  if (resetBtn) resetBtn.addEventListener("click", reset);

  coins = loadCoins();
  if (coinsEl) coinsEl.textContent = String(coins);

  buildBoardDOM();
  reset();
})();
