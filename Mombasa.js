/* =========================================================
   Safari Stay – Mombasa.js (UI-WIRED VERSION)
   Works with your UI (screenshot):
   - Top HUD: #coins, #queue, #served
   - Hint line: #hint (optional)
   - Room list items/cards: .roomCard[data-room="A|B|C|D"]
   - Room details text: #roomDetails (or change below)
   - Buttons:
       #btnCheckIn        (Check-In Guest)
       #btnServeQueue     (Serve Queue)
       #btnCleanSelected  (Clean Selected)
       #btnDeliverSnack   (Deliver Snack)
       #btnCheckout       (Checkout Guest)
       #btnStartCleaning  (Start Cleaning)

   Room states:
   empty | occupied | dirty | cleaning
   ========================================================= */

/* ====== TUNING ====== */
const ROOM_KEYS = ["A", "B", "C", "D"];

const GUEST_STAY_MS = 10_000;        // guest stays ~10s
const CLEAN_TIME_MS = 3_000;         // cleaning takes ~3s

const SPAWN_MIN_MS = 2_000;          // queue grows every 2–6s
const SPAWN_MAX_MS = 6_000;

const ORDER_PROB = 0.45;             // 45% of guests order snacks
const ORDER_DELAY_MIN_MS = 1_200;    // order appears later (not instant)
const ORDER_DELAY_MAX_MS = 4_500;

const ORDER_EXPIRE_MS = 12_000;      // order auto-expires if ignored

const COIN_CHECKOUT = 10;
const COIN_SNACK = 20;

/* ====== STORAGE ====== */
function getNum(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function setNum(key, value) {
  localStorage.setItem(key, String(value));
}
function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ====== STATE ====== */
function defaultRooms() {
  return ROOM_KEYS.map(() => ({
    state: "empty",
    stayEndsAt: 0,
    wantsSnack: false,
    snack: null,
    orderCreatedAt: 0,
    cleaningEndsAt: 0,
    loveUntil: 0,
  }));
}

let coins = getNum("coins", 0);
let queue = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

let rooms = getJSON("mombasaRooms_ui_v1", null);
if (!Array.isArray(rooms) || rooms.length !== ROOM_KEYS.length) rooms = defaultRooms();

let selectedRoomIndex = null;

/* ====== DOM ====== */
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const $id = (id) => document.getElementById(id);

const elCoins = $id("coins");
const elQueue = $id("queue");
const elServed = $id("served");
const elHint = $id("hint");
const elRoomDetails = $id("roomDetails"); // change if your ID differs

const btnCheckIn = $id("btnCheckIn");
const btnServeQueue = $id("btnServeQueue");
const btnCleanSelected = $id("btnCleanSelected");

const btnDeliverSnack = $id("btnDeliverSnack");
const btnCheckout = $id("btnCheckout");
const btnStartCleaning = $id("btnStartCleaning");

/* ====== UI HELPERS ====== */
function save() {
  setNum("coins", coins);
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRooms_ui_v1", rooms);
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
  }, 1200);
}

function renderHUD() {
  if (elCoins) elCoins.textContent = String(coins);
  if (elQueue) elQueue.textContent = String(queue);
  if (elServed) elServed.textContent = String(served);
}

function roomLabel(r, idx) {
  const k = ROOM_KEYS[idx];
  if (r.state === "empty") return `Room ${k} • Empty`;
  if (r.state === "dirty") return `Room ${k} • Dirty 🧽`;
  if (r.state === "cleaning") return `Room ${k} • Cleaning…`;
  if (r.state === "occupied") {
    if (r.wantsSnack) return `Room ${k} • Occupied • Order: ${r.snack} 🛎️`;
    return `Room ${k} • Occupied`;
  }
  return `Room ${k}`;
}

function renderRooms() {
  // You must have elements like:
  // <button class="roomCard" data-room="A"></button> ...
  ROOM_KEYS.forEach((k, idx) => {
    const card = $(`.roomCard[data-room="${k}"]`);
    if (!card) return;

    const r = rooms[idx];

    // Selection style
    card.classList.toggle("selected", selectedRoomIndex === idx);

    // State classes (optional, if your CSS uses them)
    card.classList.remove("state-empty","state-occupied","state-dirty","state-cleaning");
    card.classList.add(`state-${r.state}`);

    // Text label
    card.textContent = roomLabel(r, idx);

    // Quick emoji badge (optional)
    if (r.state === "occupied" && Date.now() < r.loveUntil) {
      card.textContent += " 😍";
    }
  });
}

function renderDetailsAndButtons() {
  if (selectedRoomIndex === null) {
    if (elRoomDetails) elRoomDetails.textContent = "Select a room.";
    setButtonsEnabled(false);
    return;
  }

  const r = rooms[selectedRoomIndex];
  const k = ROOM_KEYS[selectedRoomIndex];
  const now = Date.now();

  let details = `Room ${k}\nState: ${r.state.toUpperCase()}\n`;

  if (r.state === "occupied") {
    const left = Math.max(0, r.stayEndsAt - now);
    details += `Guest stay ends in: ${Math.ceil(left / 1000)}s\n`;
    if (r.wantsSnack) {
      details += `Snack order: ${r.snack}\n`;
    } else {
      details += `Snack order: none\n`;
    }
  }

  if (r.state === "cleaning") {
    const left = Math.max(0, r.cleaningEndsAt - now);
    details += `Cleaning ends in: ${Math.ceil(left / 1000)}s\n`;
  }

  if (r.state === "dirty") {
    details += `Needs cleaning.`;
  }

  if (elRoomDetails) elRoomDetails.textContent = details;

  setButtonsEnabled(true);
}

function setButtonsEnabled(hasSelection) {
  // Top row buttons
  if (btnCheckIn) btnCheckIn.disabled = !hasSelection;
  if (btnServeQueue) btnServeQueue.disabled = !hasSelection;
  if (btnCleanSelected) btnCleanSelected.disabled = !hasSelection;

  // Action buttons
  if (btnDeliverSnack) btnDeliverSnack.disabled = !hasSelection;
  if (btnCheckout) btnCheckout.disabled = !hasSelection;
  if (btnStartCleaning) btnStartCleaning.disabled = !hasSelection;

  if (!hasSelection) return;

  const r = rooms[selectedRoomIndex];

  // Smarter enable/disable by state
  if (btnCheckIn) btnCheckIn.disabled = !(r.state === "empty" && queue > 0);
  if (btnServeQueue) btnServeQueue.disabled = !(r.state === "empty" && queue > 0);

  if (btnDeliverSnack) btnDeliverSnack.disabled = !(r.state === "occupied" && r.wantsSnack);
  if (btnCheckout) btnCheckout.disabled = !(r.state === "occupied" && Date.now() >= r.stayEndsAt);
  if (btnStartCleaning) btnStartCleaning.disabled = !(r.state === "dirty");
  if (btnCleanSelected) btnCleanSelected.disabled = !(r.state === "dirty");
}

/* ====== GAMEPLAY ====== */
function randomSnack() {
  const snacks = ["Soda", "Chips", "Juice", "Water", "Cookies", "Burger"];
  return snacks[Math.floor(Math.random() * snacks.length)];
}
function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function checkIn(roomIndex) {
  const r = rooms[roomIndex];
  if (!(r.state === "empty" && queue > 0)) {
    bubble("Pick an empty room + make sure queue > 0");
    return;
  }

  queue -= 1;
  r.state = "occupied";
  r.stayEndsAt = Date.now() + GUEST_STAY_MS;

  r.wantsSnack = false;
  r.snack = null;
  r.orderCreatedAt = 0;
  r.loveUntil = 0;

  // Maybe schedule a snack order later
  if (Math.random() < ORDER_PROB) {
    const delay = rand(ORDER_DELAY_MIN_MS, ORDER_DELAY_MAX_MS);
    const snack = randomSnack();
    const stayStamp = r.stayEndsAt;

    setTimeout(() => {
      const rr = rooms[roomIndex];
      if (rr.state !== "occupied") return;
      if (rr.stayEndsAt !== stayStamp) return;

      rr.wantsSnack = true;
      rr.snack = snack;
      rr.orderCreatedAt = Date.now();
      hint(`Room ${ROOM_KEYS[roomIndex]} ordered: ${snack} 🛎️`);
      bubble(`Order: ${snack} 🛎️`);
      save();
      renderAll();
    }, delay);
  }

  served += 0; // not served yet
  coins += 0;

  hint(`Checked in Room ${ROOM_KEYS[roomIndex]} ✅`);
  bubble(`Checked in: Room ${ROOM_KEYS[roomIndex]} ✅`);

  save();
  renderAll();
}

function deliverSnack(roomIndex) {
  const r = rooms[roomIndex];
  if (!(r.state === "occupied" && r.wantsSnack)) {
    bubble("No snack order here.");
    return;
  }

  // Simple deliver = always correct (no snack picker needed)
  r.wantsSnack = false;
  r.orderCreatedAt = 0;

  coins += COIN_SNACK;
  r.loveUntil = Date.now() + 1200;

  hint(`Snack delivered to Room ${ROOM_KEYS[roomIndex]} ✅ +${COIN_SNACK} coins`);
  bubble(`Delivered ✅ +${COIN_SNACK} coins`);

  save();
  renderAll();
}

function checkout(roomIndex) {
  const r = rooms[roomIndex];
  if (r.state !== "occupied") return;

  if (Date.now() < r.stayEndsAt) {
    bubble("Guest is not ready to checkout yet.");
    return;
  }

  r.state = "dirty";
  r.stayEndsAt = 0;
  r.wantsSnack = false;
  r.snack = null;
  r.orderCreatedAt = 0;
  r.loveUntil = 0;

  served += 1;
  coins += COIN_CHECKOUT;

  hint(`Checked out Room ${ROOM_KEYS[roomIndex]} 🚪 (now dirty)`);
  bubble(`Checkout 🚪 +${COIN_CHECKOUT}`);

  save();
  renderAll();
}

function startCleaning(roomIndex) {
  const r = rooms[roomIndex];
  if (r.state !== "dirty") return;

  r.state = "cleaning";
  r.cleaningEndsAt = Date.now() + CLEAN_TIME_MS;

  hint(`Cleaning Room ${ROOM_KEYS[roomIndex]}… 🧽`);
  bubble("Cleaning… 🧽");

  save();
  renderAll();
}

/* ====== SPAWN QUEUE ====== */
let spawnTimer = null;

function scheduleSpawn() {
  const delay = rand(SPAWN_MIN_MS, SPAWN_MAX_MS);
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    queue += 1;
    save();
    renderAll();
    bubble("New guest arrived 👥");
    scheduleSpawn();
  }, delay);
}

/* ====== TICK LOOP ====== */
function tick() {
  const now = Date.now();

  // Auto-finish cleaning
  rooms.forEach((r, idx) => {
    if (r.state === "cleaning" && now >= r.cleaningEndsAt) {
      r.state = "empty";
      r.cleaningEndsAt = 0;
      r.stayEndsAt = 0;
      r.wantsSnack = false;
      r.snack = null;
      r.orderCreatedAt = 0;
      r.loveUntil = 0;
      bubble(`Room ${ROOM_KEYS[idx]} is clean ✨`);
      save();
    }
  });

  // Auto-expire snack orders
  rooms.forEach((r, idx) => {
    if (r.state === "occupied" && r.wantsSnack && r.orderCreatedAt) {
      if (now - r.orderCreatedAt >= ORDER_EXPIRE_MS) {
        r.wantsSnack = false;
        r.snack = null;
        r.orderCreatedAt = 0;
        hint(`Order expired in Room ${ROOM_KEYS[idx]} 😬`);
        save();
      }
    }
  });

  renderAll();
  requestAnimationFrame(tick);
}

/* ====== RENDER ALL ====== */
function renderAll() {
  renderHUD();
  renderRooms();
  renderDetailsAndButtons();
}

/* ====== EVENTS ====== */
function hookRoomClicks() {
  ROOM_KEYS.forEach((k, idx) => {
    const card = $(`.roomCard[data-room="${k}"]`);
    if (!card) return;

    card.addEventListener("click", () => {
      selectedRoomIndex = idx;
      renderAll();
    });
  });
}

function hookButtons() {
  if (btnCheckIn) btnCheckIn.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    checkIn(selectedRoomIndex);
  });

  // Serve Queue = same as check-in (just a different UX label)
  if (btnServeQueue) btnServeQueue.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    checkIn(selectedRoomIndex);
  });

  if (btnCleanSelected) btnCleanSelected.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    startCleaning(selectedRoomIndex);
  });

  if (btnDeliverSnack) btnDeliverSnack.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    deliverSnack(selectedRoomIndex);
  });

  if (btnCheckout) btnCheckout.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    checkout(selectedRoomIndex);
  });

  if (btnStartCleaning) btnStartCleaning.addEventListener("click", () => {
    if (selectedRoomIndex === null) return;
    startCleaning(selectedRoomIndex);
  });
}

/* ====== INIT ====== */
function init() {
  renderAll();
  hookRoomClicks();
  hookButtons();
  scheduleSpawn();
  requestAnimationFrame(tick);

  hint("Select a room, then use the buttons. Queue will start growing automatically 👥");
  bubble("Mombasa loaded 🏝️");
}

document.addEventListener("DOMContentLoaded", init);
