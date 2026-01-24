const ROOM_KEYS = ["A", "B", "C", "D"];

// Base tuning (will be adjusted by upgrades)
let GUEST_STAY_MS = 10000;
let CLEAN_TIME_MS = 3000;

const SPAWN_MIN_MS = 2000;
const SPAWN_MAX_MS = 6000;

const ORDER_PROB = 0.45;
const ORDER_DELAY_MIN_MS = 1200;
const ORDER_DELAY_MAX_MS = 4500;
const ORDER_EXPIRE_MS = 12000;

const ACTIVE_ORDERS_MIN = 1;
const ACTIVE_ORDERS_MAX = 2;

const KEY = {
  coins: "coins",
  queue: "mombasaQueue",
  served: "mombasaServed",
  rooms: "mombasaRooms_full_v1",
  upgrades: "mombasaUpgrades_full_v1",
  puzzle: "mombasaPuzzle_full_v1",
};

// ---------- storage helpers ----------
function getNum(k, fallback = 0) {
  const v = Number(localStorage.getItem(k));
  return Number.isFinite(v) ? v : fallback;
}
function setNum(k, v) {
  localStorage.setItem(k, String(v));
}
function getJSON(k, fallback) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function setJSON(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

// ---------- state ----------
function defaultRooms() {
  return ROOM_KEYS.map(() => ({
    state: "empty", // empty | occupied | dirty | cleaning
    stayEndsAt: 0,
    wantsSnack: false,
    snack: null,
    orderCreatedAt: 0,
    cleaningEndsAt: 0,
    loveUntil: 0,
  }));
}

let coins = getNum(KEY.coins, 0);
let queue = getNum(KEY.queue, 0);
let served = getNum(KEY.served, 0);

let rooms = getJSON(KEY.rooms, null);
if (!Array.isArray(rooms) || rooms.length !== ROOM_KEYS.length) rooms = defaultRooms();

let upgrades = getJSON(KEY.upgrades, { cleaner: false, bellboy: false });
if (!upgrades || typeof upgrades !== "object") upgrades = { cleaner: false, bellboy: false };

let selectedRoomIndex = null;
let spawnTimer = null;

// ---------- DOM ----------
const $id = (id) => document.getElementById(id);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

const elCoins = $id("coins");
const elQueue = $id("queue");
const elServed = $id("served");
const elHint = $id("hint");
const elHotelGrid = $id("hotelGrid");
const elRoomCard = $id("roomCard");

const btnCheckIn = $id("btnCheckIn");
const btnServeQueue = $id("btnServeQueue");
const btnEmergencyClean = $id("btnEmergencyClean");

const btnDeliverSnack = $id("btnDeliverSnack");
const btnCheckout = $id("btnCheckout");
const btnClean = $id("btnClean");

const btnReset = $id("btnResetMombasa");
const buyCleaner = $id("buyCleaner");
const buyBellboy = $id("buyBellboy");

// Puzzle hooks (safe)
const btnShuffle = $id("btnShuffle");
const elPuzzleGrid = $id("puzzleGrid");

// Tabs
const tabButtons = $all(".tab");
const panels = $all(".panel");

// ---------- UI helpers ----------
function save() {
  setNum(KEY.coins, coins);
  setNum(KEY.queue, queue);
  setNum(KEY.served, served);
  setJSON(KEY.rooms, rooms);
  setJSON(KEY.upgrades, upgrades);
  setJSON(KEY.puzzle, puzzle);
}

function hint(msg) {
  if (elHint) elHint.textContent = msg;
}

function bubble(msg) {
  const b = document.createElement("div");
  b.textContent = msg;
  b.style.position = "fixed";
  b.style.left = "50%";
  b.style.bottom = "24px";
  b.style.transform = "translateX(-50%)";
  b.style.padding = "10px 14px";
  b.style.borderRadius = "14px";
  b.style.background = "rgba(0,0,0,0.78)";
  b.style.color = "#fff";
  b.style.fontSize = "14px";
  b.style.zIndex = "9999";
  b.style.opacity = "0";
  b.style.transition = "opacity 200ms ease, transform 200ms ease";
  document.body.appendChild(b);

  requestAnimationFrame(() => {
    b.style.opacity = "1";
    b.style.transform = "translateX(-50%) translateY(-6px)";
  });

  setTimeout(() => {
    b.style.opacity = "0";
    b.style.transform = "translateX(-50%) translateY(6px)";
    setTimeout(() => b.remove(), 250);
  }, 1100);
}

function renderHUD() {
  if (elCoins) elCoins.textContent = String(coins);
  if (elQueue) elQueue.textContent = String(queue);
  if (elServed) elServed.textContent = String(served);
}

function roomTitle(idx) {
  return "Room " + ROOM_KEYS[idx];
}

function stateLabel(r) {
  if (r.state === "empty") return "Empty";
  if (r.state === "occupied") return r.wantsSnack ? ("Occupied • Order 🛎️") : "Occupied";
  if (r.state === "dirty") return "Dirty 🧽";
  if (r.state === "cleaning") return "Cleaning…";
  return r.state;
}

function statusBadge(r) {
  if (r.state === "empty") return "✨";
  if (r.state === "occupied") return r.wantsSnack ? "🛎️" : "😌";
  if (r.state === "dirty") return "🧽";
  if (r.state === "cleaning") return "🫧";
  return "•";
}

function createRoomButtons() {
  if (!elHotelGrid) return;
  elHotelGrid.innerHTML = "";

  ROOM_KEYS.forEach((k, idx) => {
    const btn = document.createElement("button");
    btn.className = "roomBtn state-empty";
    btn.dataset.roomIndex = String(idx);

    btn.addEventListener("click", () => {
      selectedRoomIndex = idx;
      renderAll();
    });

    elHotelGrid.appendChild(btn);
  });
}

function renderRooms() {
  if (!elHotelGrid) return;
  const buttons = $all("#hotelGrid .roomBtn");

  buttons.forEach((btn) => {
    const idx = Number(btn.dataset.roomIndex);
    const r = rooms[idx];

    btn.classList.toggle("selected", idx === selectedRoomIndex);
    btn.classList.remove("state-empty", "state-occupied", "state-dirty", "state-cleaning");
    btn.classList.add("state-" + r.state);

    // Clean compact card (NO long paragraphs)
    btn.innerHTML =
      '<div class="rRow">' +
        '<div class="rLeft">' +
          '<div class="rTitle">' + roomTitle(idx) + '</div>' +
          '<div class="rState">' + stateLabel(r) + '</div>' +
        '</div>' +
        '<div class="rBadge">' + statusBadge(r) + '</div>' +
      "</div>";
  });
}

function renderRoomDetails() {
  if (!elRoomCard) return;

  if (selectedRoomIndex === null) {
    elRoomCard.innerHTML = '<div class="muted">Select a room.</div>';
    return;
  }

  const r = rooms[selectedRoomIndex];
  const now = Date.now();

  let html = "";
  html += '<div class="detailTitle">' + roomTitle(selectedRoomIndex) + "</div>";
  html += '<div class="muted">' + stateLabel(r) + "</div>";

  if (r.state === "occupied") {
    const left = Math.max(0, r.stayEndsAt - now);
    html += '<div class="detailLine">Checkout in: <strong>' + Math.ceil(left / 1000) + "s</strong></div>";
    html += '<div class="detailLine">Snack: <strong>' + (r.wantsSnack ? (r.snack || "Ordered") : "None") + "</strong></div>";
  }
  if (r.state === "cleaning") {
    const left = Math.max(0, r.cleaningEndsAt - now);
    html += '<div class="detailLine">Cleaning ends in: <strong>' + Math.ceil(left / 1000) + "s</strong></div>";
  }
  if (r.state === "dirty") {
    html += '<div class="detailLine"><strong>Needs cleaning</strong> 🧽</div>';
  }

  elRoomCard.innerHTML = html;
}

function setButtonStates() {
  const hasSel = selectedRoomIndex !== null;

  const disableAll = () => {
    [btnCheckIn, btnServeQueue, btnEmergencyClean, btnDeliverSnack, btnCheckout, btnClean].forEach((b) => {
      if (b) b.disabled = true;
    });
  };

  if (!hasSel) return disableAll();

  const r = rooms[selectedRoomIndex];

  if (btnCheckIn) btnCheckIn.disabled = !(r.state === "empty" && queue > 0);
  if (btnServeQueue) btnServeQueue.disabled = !(r.state === "empty" && queue > 0);

  if (btnDeliverSnack) btnDeliverSnack.disabled = !(r.state === "occupied" && r.wantsSnack);
  if (btnCheckout) btnCheckout.disabled = !(r.state === "occupied" && Date.now() >= r.stayEndsAt);

  if (btnClean) btnClean.disabled = !(r.state === "dirty");
  if (btnEmergencyClean) btnEmergencyClean.disabled = !(r.state === "dirty");
}

function renderAll() {
  renderHUD();
  renderRooms();
  renderRoomDetails();
  setButtonStates();
}

// ---------- gameplay ----------
function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomSnack() {
  const snacks = ["Soda", "Chips", "Juice", "Water", "Cookies", "Burger"];
  return snacks[Math.floor(Math.random() * snacks.length)];
}

function activeOrdersCount() {
  return rooms.reduce((n, r) => n + (r.state === "occupied" && r.wantsSnack ? 1 : 0), 0);
}

function scheduleSnackOrder(roomIndex) {
  const stayStamp = rooms[roomIndex].stayEndsAt;
  const delay = rand(ORDER_DELAY_MIN_MS, ORDER_DELAY_MAX_MS);
  const snack = randomSnack();

  setTimeout(() => {
    const rr = rooms[roomIndex];
    if (rr.state !== "occupied") return;
    if (rr.stayEndsAt !== stayStamp) return;

    const maxActive = upgrades.bellboy ? ACTIVE_ORDERS_MAX : ACTIVE_ORDERS_MIN;
    if (activeOrdersCount() >= maxActive) return;

    rr.wantsSnack = true;
    rr.snack = snack;
    rr.orderCreatedAt = Date.now();

    hint(roomTitle(roomIndex) + " ordered snacks 🛎️");
    bubble("Order: " + snack + " 🛎️");
    save();
    renderAll();
  }, delay);
}

function checkInSelected() {
  if (selectedRoomIndex === null) return bubble("Select a room first.");

  const r = rooms[selectedRoomIndex];
  if (!(r.state === "empty" && queue > 0)) return bubble("Need empty room + queue > 0.");

  queue -= 1;

  r.state = "occupied";
  r.stayEndsAt = Date.now() + GUEST_STAY_MS;
  r.wantsSnack = false;
  r.snack = null;
  r.orderCreatedAt = 0;
  r.loveUntil = 0;

  if (Math.random() < ORDER_PROB) scheduleSnackOrder(selectedRoomIndex);

  hint("Checked in to " + roomTitle(selectedRoomIndex) + " ✅");
  bubble("Checked in ✅");
  save();
  renderAll();
}

function deliverSnackSelected() {
  if (selectedRoomIndex === null) return bubble("Select a room first.");

  const r = rooms[selectedRoomIndex];
  if (!(r.state === "occupied" && r.wantsSnack)) return bubble("No active snack order.");

  r.wantsSnack = false;
  r.orderCreatedAt = 0;
  r.snack = null;

  coins += upgrades.bellboy ? 30 : 20;
  r.loveUntil = Date.now() + 1200;

  hint("Snack delivered ✅");
  bubble("Delivered ✅");
  save();
  renderAll();
}

function checkoutSelected() {
  if (selectedRoomIndex === null) return bubble("Select a room first.");

  const r = rooms[selectedRoomIndex];
  if (r.state !== "occupied") return bubble("Room is not occupied.");
  if (Date.now() < r.stayEndsAt) return bubble("Not ready to checkout.");

  r.state = "dirty";
  r.stayEndsAt = 0;
  r.wantsSnack = false;
  r.snack = null;
  r.orderCreatedAt = 0;
  r.loveUntil = 0;

  served += 1;
  coins += 10;

  hint("Checked out 🚪 (now dirty)");
  bubble("Checkout 🚪");
  save();
  renderAll();
}

function startCleaningSelected() {
  if (selectedRoomIndex === null) return bubble("Select a room first.");

  const r = rooms[selectedRoomIndex];
  if (r.state !== "dirty") return bubble("Room is not dirty.");

  r.state = "cleaning";
  r.cleaningEndsAt = Date.now() + CLEAN_TIME_MS;

  hint("Cleaning… 🧽");
  bubble("Cleaning… 🧽");
  save();
  renderAll();
}

// ---------- queue spawn ----------
function scheduleSpawn() {
  const delay = rand(SPAWN_MIN_MS, SPAWN_MAX_MS);
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    queue += 1;
    save();
    renderAll();
    scheduleSpawn();
  }, delay);
}

// ---------- tick loop ----------
function tick() {
  const now = Date.now();

  // Finish cleaning
  rooms.forEach((r, idx) => {
    if (r.state === "cleaning" && now >= r.cleaningEndsAt) {
      r.state = "empty";
      r.cleaningEndsAt = 0;
      r.stayEndsAt = 0;
      r.wantsSnack = false;
      r.snack = null;
      r.orderCreatedAt = 0;
      r.loveUntil = 0;
      hint(roomTitle(idx) + " is clean ✨");
      save();
    }
  });

  // Expire snack orders
  rooms.forEach((r, idx) => {
    if (r.state === "occupied" && r.wantsSnack && r.orderCreatedAt) {
      if (now - r.orderCreatedAt >= ORDER_EXPIRE_MS) {
        r.wantsSnack = false;
        r.snack = null;
        r.orderCreatedAt = 0;
        hint("Order expired in " + roomTitle(idx) + " 😬");
        save();
      }
    }
  });

  renderAll();
  requestAnimationFrame(tick);
}

// ---------- upgrades ----------
function applyUpgradesToTuning() {
  CLEAN_TIME_MS = upgrades.cleaner ? 2200 : 3000;
}
applyUpgradesToTuning();

function buyUpgrade(name) {
  if (name === "cleaner") {
    if (upgrades.cleaner) return bubble("Cleaner already purchased.");
    if (coins < 120) return bubble("Not enough coins.");
    coins -= 120;
    upgrades.cleaner = true;
    applyUpgradesToTuning();
    bubble("Cleaner purchased ✅");
  }

  if (name === "bellboy") {
    if (upgrades.bellboy) return bubble("Bellboy already purchased.");
    if (coins < 160) return bubble("Not enough coins.");
    coins -= 160;
    upgrades.bellboy = true;
    bubble("Bellboy purchased ✅");
  }

  save();
  renderAll();
}

// ---------- reset ----------
function resetMombasa() {
  if (!confirm("Reset Mombasa progress?")) return;

  coins = 0;
  queue = 0;
  served = 0;
  rooms = defaultRooms();
  upgrades = { cleaner: false, bellboy: false };
  selectedRoomIndex = null;

  applyUpgradesToTuning();
  save();
  renderAll();
  hint("Welcome to Mombasa 🌴");
  bubble("Reset done ✅");
}

// ---------- tabs ----------
function hookTabs() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab; // hotel | puzzle | shop
      panels.forEach((p) => p.classList.remove("active"));
      const panel = $id("tab-" + tab);
      if (panel) panel.classList.add("active");
    });
  });
}

// ---------- puzzle (safe, simple) ----------
const PUZZLE_TILES = ["palm", "shell", "fish", "coconut", "wave", "sun"];

function buildPuzzleDeck() {
  const deck = [];
  PUZZLE_TILES.forEach((t) => deck.push(t, t));
  return shuffle(deck);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let puzzle = getJSON(KEY.puzzle, null);
if (!puzzle || !Array.isArray(puzzle.deck) || puzzle.deck.length !== 12) {
  puzzle = { deck: buildPuzzleDeck(), revealed: Array(12).fill(false), matched: Array(12).fill(false) };
}

let firstPick = null;
let lock = false;

function renderPuzzle() {
  if (!elPuzzleGrid) return;
  elPuzzleGrid.innerHTML = "";

  puzzle.deck.forEach((tile, idx) => {
    const card = document.createElement("button");
    card.className = "pCard";
    card.disabled = lock || puzzle.matched[idx];

    const show = puzzle.revealed[idx] || puzzle.matched[idx];

    // Try show image; if missing, show emoji fallback text
    card.innerHTML = show
      ? `<img src="assets/puzzle/${tile}.png" alt="${tile}" onerror="this.style.display='none'; this.parentElement.textContent='${tile.toUpperCase()}'" />`
      : `<div class="pBack">?</div>`;

    card.addEventListener("click", () => onPuzzlePick(idx));
    elPuzzleGrid.appendChild(card);
  });
}

function onPuzzlePick(idx) {
  if (lock) return;
  if (puzzle.revealed[idx] || puzzle.matched[idx]) return;

  puzzle.revealed[idx] = true;
  renderPuzzle();
  save();

  if (firstPick === null) {
    firstPick = idx;
    return;
  }

  const a = firstPick;
  const b = idx;
  firstPick = null;

  if (puzzle.deck[a] === puzzle.deck[b]) {
    puzzle.matched[a] = true;
    puzzle.matched[b] = true;
    coins += 15;
    bubble("Match! +15 coins ✅");
    renderHUD();
    save();
    renderPuzzle();
  } else {
    lock = true;
    setTimeout(() => {
      puzzle.revealed[a] = false;
      puzzle.revealed[b] = false;
      lock = false;
      save();
      renderPuzzle();
    }, 600);
  }
}

function shufflePuzzle() {
  puzzle = { deck: buildPuzzleDeck(), revealed: Array(12).fill(false), matched: Array(12).fill(false) };
  firstPick = null;
  lock = false;
  save();
  renderPuzzle();
  bubble("Shuffled 🔀");
}

// ---------- buttons ----------
function hookButtons() {
  if (btnCheckIn) btnCheckIn.addEventListener("click", checkInSelected);
  if (btnServeQueue) btnServeQueue.addEventListener("click", checkInSelected);

  if (btnDeliverSnack) btnDeliverSnack.addEventListener("click", deliverSnackSelected);
  if (btnCheckout) btnCheckout.addEventListener("click", checkoutSelected);

  if (btnClean) btnClean.addEventListener("click", startCleaningSelected);
  if (btnEmergencyClean) btnEmergencyClean.addEventListener("click", startCleaningSelected);

  if (btnReset) btnReset.addEventListener("click", resetMombasa);

  if (buyCleaner) buyCleaner.addEventListener("click", () => buyUpgrade("cleaner"));
  if (buyBellboy) buyBellboy.addEventListener("click", () => buyUpgrade("bellboy"));

  if (btnShuffle) btnShuffle.addEventListener("click", shufflePuzzle);
}

// ---------- init ----------
function init() {
  hookTabs();
  createRoomButtons();
  hookButtons();

  renderAll();
  renderPuzzle();

  scheduleSpawn();
  requestAnimationFrame(tick);

  hint("Tap a room to select it. Then use the buttons below.");
  bubble("Mombasa loaded 🏝️");
}

document.addEventListener("DOMContentLoaded", init);
