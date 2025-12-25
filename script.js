/* ================================
   SAFARI STAY – PUZZLE + ISLAND
   FULL CLEAN SCRIPT (WITH AUDIO)
================================ */

/* ---------- GRID SETUP ---------- */
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const COLORS = ["🍓","🥥","🌴","🐚","⭐","🍍"];

/* ---------- GAME STATE ---------- */
let board = new Array(TOTAL).fill(null);
let selectedIndex = null;
let isBusy = false;

let score = 0;
let moves = 30;

/* ---------- ISLAND STATE ---------- */
const BUSH_COST = 100;
let coins = Number(localStorage.getItem("coins")) || 0;
let bushCleared = localStorage.getItem("bushCleared") === "true";

/* ---------- ELEMENTS (MUST EXIST IN index.html) ---------- */
const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");

const islandScreen = document.getElementById("islandScreen");
const gameScreen = document.getElementById("gameScreen");
const coinsEl = document.getElementById("coins");
const bushStatus = document.getElementById("bushStatus");

/* ---------- SAFETY CHECK ---------- */
function mustExist(el, name) {
  if (!el) {
    console.error(`Missing element #${name} in index.html`);
    // Don’t crash hard; just prevent broken behavior
  }
}
mustExist(gridEl, "grid");
mustExist(scoreEl, "score");
mustExist(movesEl, "moves");
mustExist(islandScreen, "islandScreen");
mustExist(gameScreen, "gameScreen");
mustExist(coinsEl, "coins");
mustExist(bushStatus, "bushStatus");

/* ---------- AUDIO (NO OVERLAP) ---------- */
const sounds = {
  swap: new Audio("sounds/swap.mp3"),
  match: new Audio("sounds/match.mp3"),
  break: new Audio("sounds/break.mp3"),
  coin: new Audio("sounds/coin.mp3"),
};

let audioUnlocked = false;

function prepAudio() {
  Object.values(sounds).forEach(a => {
    a.preload = "auto";
    a.volume = 0.7;
  });
}

// Safari/iOS/Chrome: require a user gesture before audio plays
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const a = sounds.swap;
  a.muted = true;
  const p = a.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }).catch(() => {
      a.muted = false;
    });
  } else {
    a.muted = false;
  }
}

function playSound(audio) {
  if (!audioUnlocked) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

/* ---------- HELPERS ---------- */
function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function areNeighbors(a, b) {
  const ar = Math.floor(a / WIDTH), ac = a % WIDTH;
  const br = Math.floor(b / WIDTH), bc = b % WIDTH;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

/* ---------- UI ---------- */
function updateIslandUI() {
  if (coinsEl) coinsEl.textContent = coins;

  if (bushStatus) {
    bushStatus.textContent = bushCleared
      ? "✅ Bush cleared — New path unlocked!"
      : `🌿 Bush is blocking the path — Need ${BUSH_COST} coins to clear it`;
  }
}

function updateUI() {
  if (!gridEl) return;

  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((t, i) => {
    t.classList.toggle("selected", i === selectedIndex);
    t.textContent = board[i] || "";
  });

  if (scoreEl) scoreEl.textContent = score;
  if (movesEl) movesEl.textContent = moves;
}

/* ---------- GRID ---------- */
function buildGrid() {
  if (!gridEl) return;

  gridEl.innerHTML = "";
  for (let i = 0; i < TOTAL; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = i;
    tile.addEventListener("click", onTileClick);
    gridEl.appendChild(tile);
  }
}

/* ---------- MATCHING ---------- */
function findMatches() {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < WIDTH; r++) {
    for (let c = 0; c < WIDTH - 2; c++) {
      const i = r * WIDTH + c;
      const a = board[i];
      if (a && a === board[i + 1] && a === board[i + 2]) {
        matched.add(i); matched.add(i + 1); matched.add(i + 2);
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
      }
    }
  }

  return matched;
}

function animateCrash(matched) {
  if (!gridEl) return;
  const tiles = gridEl.querySelectorAll(".tile");
  matched.forEach(i => tiles[i]?.classList.add("crash"));
  setTimeout(() => matched.forEach(i => tiles[i]?.classList.remove("crash")), 180);
}

function clearMatches(matched) {
  if (matched.size === 0) return false;

  animateCrash(matched);
  playSound(sounds.break);

  matched.forEach(i => board[i] = null);

  score += matched.size * 10;
  coins += matched.size * 5;

  playSound(sounds.match);
  setTimeout(() => playSound(sounds.coin), 80);

  localStorage.setItem("coins", String(coins));
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

    for (let r = writeRow; r >= 0; r--) {
      board[r * WIDTH + c] = null;
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
  unlockAudioOnce();

  if (isBusy || moves <= 0) return;

  const idx = Number(e.currentTarget.dataset.index);

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
  const a = selectedIndex;
  const b = idx;

  // swap
  [board[a], board[b]] = [board[b], board[a]];
  playSound(sounds.swap);

  selectedIndex = null;
  updateUI();
  await sleep(80);

  // validate move
  const matches = findMatches();
  if (matches.size === 0) {
    [board[a], board[b]] = [board[b], board[a]];
    updateUI();
    isBusy = false;
    return;
  }

  // successful move
  moves--;
  await resolveBoard();
  updateIslandUI();

  // Hint to clear bush once you can afford it
  if (!bushCleared && coins >= BUSH_COST) {
    alert("🎉 You have enough coins! Go back and clear the bush!");
  }

  // Optional: when moves end, auto send player to island
  if (moves <= 0) {
    alert("Moves finished! Returning to Island Tasks.");
    backToIsland();
  }

  isBusy = false;
}

/* ---------- ISLAND NAV (BUTTONS CALL THESE) ---------- */
window.goToGame = function goToGame() {
  if (!islandScreen || !gameScreen) return;
  islandScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
};

window.backToIsland = function backToIsland() {
  if (!islandScreen || !gameScreen) return;
  gameScreen.classList.add("hidden");
  islandScreen.classList.remove("hidden");
  updateIslandUI();
};

window.clearBush = function clearBush() {
  // If already cleared, go straight to Mombasa
  if (bushCleared) {
    window.location.href = "Mombasa.html";
    return;
  }

  if (coins < BUSH_COST) {
    alert("Not enough coins!");
    return;
  }

  coins -= BUSH_COST;
  bushCleared = true;

  localStorage.setItem("coins", String(coins));
  localStorage.setItem("bushCleared", "true");

  alert("🌴 Path cleared! Welcome to Mombasa!");
  window.location.href = "Mombasa.html";
};


/* ---------- START ---------- */
function newGame() {
  board = Array.from({ length: TOTAL }, randColor);
  score = 0;
  moves = 30;
  updateUI();
  resolveBoard();
}

prepAudio();
buildGrid();
newGame();
updateIslandUI();
