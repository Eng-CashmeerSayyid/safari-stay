// =========================
// puzzle.js — Safari Stay Match-3 (simple + stable)
// Board: 5x5
// Rewards: + coins per cleared tile
// Syncs coins to #coins + localStorage
// =========================

(() => {
  const BOARD_SIZE = 5;
  const START_MOVES = 20;

  // Use emojis for now (you can later swap to images)
  const TILES = ["🌴", "🐚", "🐟", "🥥", "🌊", "☀️"];

  const $ = (id) => document.getElementById(id);

  let grid = [];
  let selected = null;
  let movesLeft = START_MOVES;
  let earned = 0;

  function getCoins() {
    const v = parseInt(localStorage.getItem("safaristay_coins") || "0", 10);
    return Number.isFinite(v) ? v : 0;
  }

  function setCoins(v) {
    localStorage.setItem("safaristay_coins", String(v));
    const coinsEl = $("coins");
    if (coinsEl) coinsEl.textContent = String(v);
  }

  function addCoins(delta) {
    setCoins(getCoins() + delta);
  }

  function updateHud() {
    const m = $("movesLeft");
    const e = $("puzzleEarned");
    if (m) m.textContent = String(movesLeft);
    if (e) e.textContent = String(earned);
  }

  function randTile() {
    return TILES[Math.floor(Math.random() * TILES.length)];
  }

  function buildEmpty() {
    grid = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => randTile())
    );
  }

  function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  function neighbors(a, b) {
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    return (dr + dc) === 1;
  }

  function swap(a, b) {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }

  function findMatches() {
    const matched = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => false)
    );

    // rows
    for (let r = 0; r < BOARD_SIZE; r++) {
      let run = 1;
      for (let c = 1; c <= BOARD_SIZE; c++) {
        const same = c < BOARD_SIZE && grid[r][c] === grid[r][c - 1];
        if (same) run++;
        else {
          if (run >= 3) {
            for (let k = 0; k < run; k++) matched[r][c - 1 - k] = true;
          }
          run = 1;
        }
      }
    }

    // cols
    for (let c = 0; c < BOARD_SIZE; c++) {
      let run = 1;
      for (let r = 1; r <= BOARD_SIZE; r++) {
        const same = r < BOARD_SIZE && grid[r][c] === grid[r - 1][c];
        if (same) run++;
        else {
          if (run >= 3) {
            for (let k = 0; k < run; k++) matched[r - 1 - k][c] = true;
          }
          run = 1;
        }
      }
    }

    return matched;
  }

  function hasAnyMatch(matched) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (matched[r][c]) return true;
      }
    }
    return false;
  }

  function clearAndDrop(matched) {
    let cleared = 0;

    // clear
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (matched[r][c]) {
          grid[r][c] = null;
          cleared++;
        }
      }
    }

    // drop per column
    for (let c = 0; c < BOARD_SIZE; c++) {
      const col = [];
      for (let r = BOARD_SIZE - 1; r >= 0; r--) {
        if (grid[r][c] != null) col.push(grid[r][c]);
      }
      // refill
      while (col.length < BOARD_SIZE) col.push(randTile());

      // write back
      for (let r = BOARD_SIZE - 1, i = 0; r >= 0; r--, i++) {
        grid[r][c] = col[i];
      }
    }

    return cleared;
  }

  function stabilize() {
    // keep clearing until no matches (prevents “instant match” board on start)
    let loops = 0;
    while (loops < 20) {
      const matched = findMatches();
      if (!hasAnyMatch(matched)) break;
      clearAndDrop(matched);
      loops++;
    }
  }

  function render() {
    const board = $("board");
    if (!board) return;

    board.innerHTML = "";
    board.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.type = "button";
        tile.textContent = grid[r][c];
        tile.dataset.r = String(r);
        tile.dataset.c = String(c);

        if (selected && selected.r === r && selected.c === c) {
          tile.classList.add("selected");
        }

        tile.addEventListener("click", () => onTileClick(r, c));
        board.appendChild(tile);
      }
    }
  }

  function onTileClick(r, c) {
    if (movesLeft <= 0) return;

    if (!selected) {
      selected = { r, c };
      render();
      return;
    }

    const next = { r, c };
    if (!neighbors(selected, next)) {
      // selecting another tile (not neighbor) just changes selection
      selected = next;
      render();
      return;
    }

    // attempt swap
    swap(selected, next);
    const matched = findMatches();

    if (!hasAnyMatch(matched)) {
      // invalid move — swap back
      swap(selected, next);
      selected = null;
      render();
      return;
    }

    // valid move
    movesLeft--;
    selected = null;

    // clear chain reactions
    let totalCleared = 0;
    let safety = 0;
    while (safety < 20) {
      const m = findMatches();
      if (!hasAnyMatch(m)) break;
      totalCleared += clearAndDrop(m);
      safety++;
    }

    // reward: 1 coin per cleared tile (simple, feels good)
    earned += totalCleared;
    addCoins(totalCleared);

    updateHud();
    render();
  }

  function newBoard() {
    movesLeft = START_MOVES;
    earned = 0;
    selected = null;
    buildEmpty();
    stabilize();
    updateHud();
    render();
  }

  function setupTabs() {
    const btnHotel = $("tabBtnHotel");
    const btnPuzzle = $("tabBtnPuzzle");
    const panelHotel = $("panel-hotel");
    const panelPuzzle = $("panel-puzzle");

    if (!btnHotel || !btnPuzzle || !panelHotel || !panelPuzzle) return;

    function show(which) {
      const isHotel = which === "hotel";
      panelHotel.classList.toggle("active", isHotel);
      panelPuzzle.classList.toggle("active", !isHotel);
      btnHotel.classList.toggle("active", isHotel);
      btnPuzzle.classList.toggle("active", !isHotel);
    }

    btnHotel.addEventListener("click", () => show("hotel"));
    btnPuzzle.addEventListener("click", () => show("puzzle"));
  }

  function syncCoinsToUI() {
    // On load, display saved coins in the HUD
    const coinsEl = $("coins");
    if (coinsEl) coinsEl.textContent = String(getCoins());
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncCoinsToUI();
    setupTabs();

    const newBtn = $("btnPuzzleNew");
    if (newBtn) newBtn.addEventListener("click", newBoard);

    // create initial board
    newBoard();
  });
})();
