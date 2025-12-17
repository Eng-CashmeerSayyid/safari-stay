/* ================================
   SAFARI STAY – PUZZLE + ISLAND
   + AUDIO (Safari-friendly)
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

/* ---------- ELEMENTS ---------- */
const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");

const islandScreen = document.getElementById("islandScreen");
const gameScreen = document.getElementById("gameScreen");
const coinsEl = document.getElementById("coins");
const bushStatus = document.getElementById("bushStatus");

/* ---------- AUDIO ---------- */
// Put these in /sounds/ exactly:
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

// iOS/Safari often needs a user gesture before sound can play
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Try to play/pause silently to unlock
  const a = sounds.swap;
  a.muted = true;
  const p = a.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }).catch(() => {
      // still locked; no worries — next click usually unlocks
      a.muted = false;
    });
  } else {
    // fallback
    a.muted = false;
  }
}

function playSound(audio) {
  if (!audioUnlocked) return; // will start after first user gesture
  try {
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
  coinsEl.textContent = coins;
  bushStatus.textContent = bushCleared
    ? "✅ Bush cleared — New path unlocked!"
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
  const tiles = gridEl.querySelectorAll(".tile");
  matched.forEach(i => tiles[i]?.classList.add("crash"));
  setTimeout(() => {
    matched.forEach(i => tiles[i]?.classList.remove("crash"));
  }, 180);
}

function clearMatches(matched) {
  if (matched.size === 0) return false;

  // visual effect (optional, works with your CSS .tile.crash)
  animateCrash(matched);

  // sound effect
  playSound(sounds.break);

  // remove matched tiles
  matched.forEach(i => board[i] = null);

  // scoring + coins
  score += matched.size * 10;
  coins += matched.size * 5;

  // sounds for reward
  playSound(sounds.match);
  playSound(sounds.coin);

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

    // clear the rest above
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
  // unlock audio on first click
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
    // swap back
    [board[a], board[b]] = [board[b], board[a]];
    updateUI();
    isBusy = false;
    return;
  }

  // successful move
  moves--;
  await resolveBoard();
  updateIslandUI();

  if (!bushCleared && coins >= BUSH_COST) {
    alert("🎉 Goal reached! Go back and clear the bush!");
  }

  isBusy = false;
}

/* ---------- ISLAND ---------- */
window.goToGame = () => {
  islandScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
};

window.backToIsland = () => {
  gameScreen.classList.add("hidden");
  islandScreen.classList.remove("hidden");
  updateIslandUI();
};

window.clearBush = () => {
  if (bushCleared) return alert("Bush already cleared");
  if (coins < BUSH_COST) return alert("Not enough coins!");

  coins -= BUSH_COST;
  bushCleared = true;

  localStorage.setItem("coins", String(coins));
  localStorage.setItem("bushCleared", "true");

  alert("🌴 Path cleared! New area unlocked!");
  updateIslandUI();
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
