/* ================================
   SAFARI STAY – PUZZLE + ISLAND
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

/* ---------- AUDIO ---------- */
const sounds = {
  swap: new Audio("sounds/swap.mp3"),
  match: new Audio("sounds/match.mp3"),
  break: new Audio("sounds/break.mp3"),
  coin: new Audio("sounds/coin.mp3")
};

Object.values(sounds).forEach(s => s.preload = "auto");

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

  sounds.match.currentTime = 0;
  sounds.match.play();
  sounds.coin.currentTime = 0;
  sounds.coin.play();

  localStorage.setItem("coins", coins);
  return true;
}

function applyGravity() {
  for (let c = 0; c < WIDTH; c++) {
    let write = WIDTH - 1;
    for (let r = WIDTH - 1; r >= 0; r--) {
      const i = r * WIDTH + c;
      if (board[i]) {
        board[write * WIDTH + c] = board[i];
        if (write !== r) board[i] = null;
        write--;
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

    sounds.break.currentTime = 0;
    sounds.break.play();

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
