/* =========================
Safari Stay – mombasa.js (FULL)
Match-3, 5x5, swap adjacent
- Crush animation
- Invalid swap shake + vibration
- Coins + target + win popup
Works with image tiles (paths below) or emoji fallback
========================= */

(() => {
  "use strict";

  // ====== SETTINGS ======
  const SIZE = 5;                 // 5x5
  const TYPES = 6;                // number of tile types (repeat allowed)
  const TARGET_COINS = 300;       // win target
  const COINS_PER_TILE = 5;       // reward per crushed tile
  const ANIM_MS = 220;            // base animation duration
  const CASCADE_DELAY = 80;       // small delay between cascades

  // ====== TILE ASSETS ======
  // Put your images in: ./assets/tiles/
  // Example names (change to match YOUR files):
  // palm.png, shell.png, fish.png, coconut.png, wave.png, sun.png
  const TILE_ASSETS = [
  "images/tiles/palm.png",
  "images/tiles/shell.png",
  "images/tiles/fish.png",
  "images/tiles/coconut.png",
  "images/tiles/wave.png",
  "images/tiles/sun.png",
];


  // Emoji fallback (if images missing)
  const TILE_EMOJI = ["🌴","🐚","🐟","🥥","🌊","☀️"];

  // ====== DOM ======
  const boardEl = document.getElementById("board");
  const coinsEl = document.getElementById("coins");
  const targetEl = document.getElementById("target");
  const msgEl = document.getElementById("msg");
  const resetBtn = document.getElementById("resetPuzzle");

  if (!boardEl) {
    console.warn("Match-3: #board not found. Add the puzzle HTML container.");
    return;
  }

  targetEl.textContent = String(TARGET_COINS);

  // ====== STATE ======
  let grid = [];         // 2D array of tile types (0..TYPES-1), -1 = empty
  let selected = null;   // {r,c}
  let locked = false;    // prevents input during animations
  let coins = 0;

  // ====== HELPERS ======
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  const neighbors = (a, b) =>
    (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;

  function vibrate(ms = 60) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function setMsg(text) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
  }

  function addCoins(tileCount) {
    coins += tileCount * COINS_PER_TILE;
    coinsEl.textContent = String(coins);
    if (coins >= TARGET_COINS) {
      showWin();
    }
  }

  function showWin() {
    // simple win overlay
    const overlay = document.createElement("div");
    overlay.className = "winOverlay";
    overlay.innerHTML = `
      <div class="winCard">
        <div class="winTitle">Level Complete! 🎉</div>
        <div class="winText">You reached <b>${coins}</b> coins.</div>
        <button class="btn" id="winClose">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("winClose").onclick = () => overlay.remove();
  }

  function randomType() {
    return Math.floor(Math.random() * TYPES);
  }

  // Create a type that does not immediately create a match at (r,c)
  function safeRandomType(r, c) {
    // Try a few times; TYPES=6 is enough to avoid infinite loops
    for (let tries = 0; tries < 20; tries++) {
      const t = randomType();

      // Check horizontal potential match
      const left1 = c - 1 >= 0 ? grid[r][c - 1] : null;
      const left2 = c - 2 >= 0 ? grid[r][c - 2] : null;
      if (left1 === t && left2 === t) continue;

      // Check vertical potential match
      const up1 = r - 1 >= 0 ? grid[r - 1][c] : null;
      const up2 = r - 2 >= 0 ? grid[r - 2][c] : null;
      if (up1 === t && up2 === t) continue;

      return t;
    }
    return randomType();
  }

  // ====== RENDER ======
  function buildBoardDOM() {
    boardEl.style.setProperty("--size", SIZE);
    boardEl.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.className = "tile";
        cell.type = "button";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("aria-label", `tile ${r},${c}`);
        boardEl.appendChild(cell);
      }
    }

    boardEl.addEventListener("click", onBoardClick);
  }

  function paint() {
    const tiles = boardEl.querySelectorAll(".tile");
    tiles.forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const t = grid[r][c];

      el.classList.toggle("selected", selected && selected.r === r && selected.c === c);

      // Empty slot
      if (t === -1) {
        el.classList.add("empty");
        el.style.backgroundImage = "";
        el.textContent = "";
        return;
      }

      el.classList.remove("empty");

      // Use image if available
      const imgPath = TILE_ASSETS[t];
      el.style.backgroundImage = `url("${imgPath}")`;

      // Also keep an emoji text fallback (in case image fails)
      el.textContent = TILE_EMOJI[t];
      el.classList.add("hasEmoji");
    });
  }

  // ====== MATCH DETECTION ======
  function findMatches() {
    const toCrush = new Set();

    // Horizontal matches
    for (let r = 0; r < SIZE; r++) {
      let runStart = 0;
      while (runStart < SIZE) {
        const t = grid[r][runStart];
        if (t === -1) { runStart++; continue; }
        let runEnd = runStart + 1;
        while (runEnd < SIZE && grid[r][runEnd] === t) runEnd++;
        const runLen = runEnd - runStart;
        if (runLen >= 3) {
          for (let c = runStart; c < runEnd; c++) {
            toCrush.add(`${r},${c}`);
          }
        }
        runStart = runEnd;
      }
    }

    // Vertical matches
    for (let c = 0; c < SIZE; c++) {
      let runStart = 0;
      while (runStart < SIZE) {
        const t = grid[runStart][c];
        if (t === -1) { runStart++; continue; }
        let runEnd = runStart + 1;
        while (runEnd < SIZE && grid[runEnd][c] === t) runEnd++;
        const runLen = runEnd - runStart;
        if (runLen >= 3) {
          for (let r = runStart; r < runEnd; r++) {
            toCrush.add(`${r},${c}`);
          }
        }
        runStart = runEnd;
      }
    }

    return [...toCrush].map(s => {
      const [r, c] = s.split(",").map(Number);
      return { r, c };
    });
  }

  function anyMatchExists() {
    return findMatches().length > 0;
  }

  // ====== SWAP ======
  function swap(a, b) {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }

  function getTileEl(r, c) {
    return boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  }

  async function animateSwap(a, b) {
    const elA = getTileEl(a.r, a.c);
    const elB = getTileEl(b.r, b.c);
    if (!elA || !elB) return;

    elA.classList.add("swap");
    elB.classList.add("swap");
    await sleep(ANIM_MS);
    elA.classList.remove("swap");
    elB.classList.remove("swap");
  }

  async function invalidSwapFeedback(a, b) {
    const elA = getTileEl(a.r, a.c);
    const elB = getTileEl(b.r, b.c);
    [elA, elB].forEach(el => el && el.classList.add("shake"));
    vibrate(70);
    await sleep(ANIM_MS);
    [elA, elB].forEach(el => el && el.classList.remove("shake"));
  }

  // ====== CRUSH + GRAVITY + REFILL ======
  async function crush(matches) {
    // animate crush
    matches.forEach(({ r, c }) => {
      const el = getTileEl(r, c);
      if (el) el.classList.add("crush");
    });

    vibrate(35);
    await sleep(ANIM_MS);

    // remove
    matches.forEach(({ r, c }) => {
      grid[r][c] = -1;
      const el = getTileEl(r, c);
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
      // above writeRow becomes empty already
      for (let r = writeRow; r >= 0; r--) grid[r][c] = -1;
    }
  }

  function refill() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === -1) {
          // avoid immediate matches when refilling
          grid[r][c] = safeRandomType(r, c);
        }
      }
    }
  }

  async function resolveBoard() {
    // handle cascades until no matches exist
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

  // ====== INPUT ======
  async function onBoardClick(e) {
    if (locked) return;

    const tileBtn = e.target.closest(".tile");
    if (!tileBtn) return;

    const r = Number(tileBtn.dataset.r);
    const c = Number(tileBtn.dataset.c);

    // select first
    if (!selected) {
      selected = { r, c };
      paint();
      return;
    }

    const prev = selected;
    selected = null; // clear selection by default

    // same tile = just deselect
    if (prev.r === r && prev.c === c) {
      paint();
      return;
    }

    // not neighbors -> select new
    if (!neighbors(prev, { r, c })) {
      selected = { r, c };
      paint();
      return;
    }

    // attempt swap
    locked = true;
    setMsg("");

    await animateSwap(prev, { r, c });
    swap(prev, { r, c });
    paint();

    // if swap creates match, resolve
    if (anyMatchExists()) {
      await resolveBoard();
      locked = false;
      paint();
      return;
    }

    // invalid: swap back + shake/vibrate
    await invalidSwapFeedback(prev, { r, c });
    await animateSwap(prev, { r, c });
    swap(prev, { r, c });
    paint();

    locked = false;
  }

  // ====== INIT / RESET ======
  function initGrid() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
    coins = 0;
    coinsEl.textContent = "0";
    setMsg("");

    // Fill without initial matches
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        grid[r][c] = safeRandomType(r, c);
      }
    }
  }

  async function reset() {
    locked = true;
    selected = null;
    initGrid();
    paint();
    // Just in case: remove any accidental match
    await resolveBoard();
    locked = false;
  }

  // ====== START ======
  buildBoardDOM();
  resetBtn && (resetBtn.onclick = reset);
  reset();

})();
