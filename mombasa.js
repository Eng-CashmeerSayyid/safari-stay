/* =========================
mombasa.js (FULL UPDATED)
✅ Rooms = 4
✅ Auto spawn / check-in / checkout / clean
✅ Shared coins (hotel + puzzle)
✅ Tabs
✅ Match-3 basic (images)
========================= */

/* -------------------------
Helpers
------------------------- */
const $ = (id) => document.getElementById(id);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* -------------------------
Shared Coins (localStorage)
------------------------- */
function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}
function setCoins(n) {
  const val = Math.max(0, Number(n) || 0);
  localStorage.setItem("coins", String(val));
  if ($("coins")) $("coins").textContent = String(val);
  if ($("coinsPuzzle")) $("coinsPuzzle").textContent = String(val);
}

/* -------------------------
Tabs
------------------------- */
function initTabs() {
  const tabs = document.querySelectorAll(".tab[data-tab]");
  const panels = {
    hotel: $("tab-hotel"),
    puzzle: $("tab-puzzle"),
    shop: $("tab-shop"),
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");

      Object.values(panels).forEach((p) => p && p.classList.remove("active"));
      const key = btn.dataset.tab;
      if (panels[key]) panels[key].classList.add("active");
    });
  });
}

/* =========================
HOTEL MODE (Hotel Mania Feel)
========================= */

const HOTEL = {
  roomCount: 4,          // ✅ 4 rooms
  maxQueue: 6,
  patienceMs: 15000,
  stayMs: 9000,
  cleanMsBase: 2600,
  snackChance: 0.35,
  snackTip: 3,
  checkinCoin: 1,
  checkoutCoin: 2,
};

// ✅ Auto-play engine
const AUTO = {
  enabled: true,
  spawnEveryMs: 3500,
  autoCheckInEveryMs: 500,
  autoCheckoutEveryMs: 600,
  autoCleanEveryMs: 700,
  autoDeliverSnack: true,
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];

let hotelState = {
  served: 0,
  queue: [], // {id, face, expiresAt}
  rooms: [], // {id, state, guestId, guestFace, snackOrdered}
  selectedRoomId: null,
  upgrades: { cleaner: 0, bellboy: 0 }
};

function saveHotel() {
  localStorage.setItem("mombasaHotel", JSON.stringify({
    served: hotelState.served,
    queue: hotelState.queue,
    rooms: hotelState.rooms,
    upgrades: hotelState.upgrades
  }));
}

function loadHotel() {
  try {
    const raw = localStorage.getItem("mombasaHotel");
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rooms)) return false;
    hotelState.served = Number(data.served) || 0;
    hotelState.queue = Array.isArray(data.queue) ? data.queue : [];
    hotelState.rooms = data.rooms;
    hotelState.upgrades = data.upgrades || hotelState.upgrades;

    // safety: if old saved room count differs, rebuild
    if (hotelState.rooms.length !== HOTEL.roomCount) return false;

    return true;
  } catch {
    return false;
  }
}

function setHint(text) {
  if ($("hint")) $("hint").textContent = text;
}

function updateHud() {
  if ($("queueCount")) $("queueCount").textContent = String(hotelState.queue.length);
  if ($("served")) $("served").textContent = String(hotelState.served);
  setCoins(getCoins());
}

function initRoomsFresh() {
  hotelState.rooms = [];
  for (let i = 1; i <= HOTEL.roomCount; i++) {
    hotelState.rooms.push({
      id: i,
      state: "empty", // empty | occupied | ready | dirty | cleaning
      guestId: null,
      guestFace: null,
      snackOrdered: false
    });
  }
}

function getSelectedRoom() {
  const id = hotelState.selectedRoomId;
  return hotelState.rooms.find(r => r.id === id) || null;
}
function firstAvailableRoom() {
  return hotelState.rooms.find(r => r.state === "empty") || null;
}

function roomLabel(room) {
  if (room.state === "empty") return "✅ Empty";
  if (room.state === "occupied") return "🟦 Occupied";
  if (room.state === "ready") return room.snackOrdered ? "🛎️ Ready (Snack!)" : "⭐ Ready";
  if (room.state === "dirty") return "🟥 Dirty";
  if (room.state === "cleaning") return "🧽 Cleaning…";
  return room.state;
}

function renderRooms() {
  const grid = $("hotelGrid");
  if (!grid) return;

  grid.innerHTML = "";

  hotelState.rooms.forEach((room) => {
    const div = document.createElement("div");
    const selected = hotelState.selectedRoomId === room.id;

    div.className = "roomTile" + (selected ? " selected" : "");
    div.style.cursor = "pointer";
    div.style.padding = "12px";
    div.style.borderRadius = "14px";
    div.style.border = "1px solid rgba(255,255,255,.15)";
    div.style.background = "rgba(255,255,255,.06)";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.gap = "6px";
    div.style.minHeight = "90px";
    if (selected) div.style.outline = "2px solid rgba(59,130,246,.35)";

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Room ${room.id}</strong>
        <span style="font-size:12px;opacity:.85">${roomLabel(room)}</span>
      </div>
      <div style="font-size:20px">${room.guestFace ? room.guestFace : " "}</div>
      <div style="font-size:12px;opacity:.75">${room.guestId ? ("Guest " + room.guestId) : ""}</div>
    `;

    div.addEventListener("click", () => {
      hotelState.selectedRoomId = room.id;
      renderRooms();
      renderRoomCard();
    });

    grid.appendChild(div);
  });
}

function renderRoomCard() {
  const card = $("roomCard");
  if (!card) return;

  const room = getSelectedRoom();
  if (!room) {
    card.innerHTML = `<div class="muted">Select a room.</div>`;
    return;
  }

  card.innerHTML = `
    <div><strong>Room ${room.id}</strong></div>
    <div class="muted">${roomLabel(room)}</div>
    <div style="margin-top:8px">${room.guestId ? `${room.guestFace} Guest ${room.guestId}` : "No guest"}</div>
    <div style="margin-top:6px;opacity:.9">${room.snackOrdered ? "🛎️ Snack order pending" : "No snack order"}</div>
  `;
}

/* -------------------------
Guest Spawn + Queue
------------------------- */
function spawnGuest(manual = false) {
  if (hotelState.queue.length >= HOTEL.maxQueue) return;

  const id = Math.random().toString(16).slice(2, 6).toUpperCase();
  const face = faces[randInt(0, faces.length - 1)];
  const now = Date.now();

  hotelState.queue.push({ id, face, expiresAt: now + HOTEL.patienceMs });

  if (manual) setHint(`New guest arrived ${face} 👤`);
  updateHud();
  saveHotel();
}

function tickQueue() {
  const now = Date.now();
  const before = hotelState.queue.length;
  hotelState.queue = hotelState.queue.filter(g => g.expiresAt > now);

  if (hotelState.queue.length < before) {
    setHint("Some guests left 😭 (patience ran out)");
    updateHud();
    saveHotel();
  }
}

/* -------------------------
Check-in / Ready / Checkout / Clean
------------------------- */
function checkInGuest(preferSelected = true) {
  if (hotelState.queue.length === 0) return;

  let room = null;

  if (preferSelected) {
    const sel = getSelectedRoom();
    if (sel && sel.state === "empty") room = sel;
  }
  if (!room) room = firstAvailableRoom();
  if (!room) return;

  const guest = hotelState.queue.shift();

  room.state = "occupied";
  room.guestId = guest.id;
  room.guestFace = guest.face;
  room.snackOrdered = Math.random() < HOTEL.snackChance;

  setCoins(getCoins() + HOTEL.checkinCoin);
  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();

  // after stay -> ready
  setTimeout(() => {
    const r = hotelState.rooms.find(x => x.id === room.id);
    if (!r) return;

    if (r.state === "occupied" && r.guestId === guest.id) {
      r.state = "ready";
      // hint only occasionally to avoid spam
      renderRooms();
      renderRoomCard();
      saveHotel();
    }
  }, HOTEL.stayMs);
}

function deliverSnack(roomId) {
  const room = hotelState.rooms.find(r => r.id === roomId);
  if (!room) return;
  if (!room.snackOrdered) return;

  room.snackOrdered = false;
  const bonus = HOTEL.snackTip + (hotelState.upgrades.bellboy ? 2 : 0);
  setCoins(getCoins() + bonus);
  saveHotel();
}

function checkoutRoom(roomId) {
  const room = hotelState.rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.state !== "ready") return;

  // snack first if needed
  if (AUTO.autoDeliverSnack) deliverSnack(roomId);

  hotelState.served += 1;
  setCoins(getCoins() + HOTEL.checkoutCoin);

  room.state = "dirty";
  room.guestId = null;
  room.guestFace = null;
  room.snackOrdered = false;

  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function cleaningTimeMs() {
  const reduction = hotelState.upgrades.cleaner ? 700 : 0;
  return Math.max(1200, HOTEL.cleanMsBase - reduction);
}

function cleanRoomById(roomId) {
  const room = hotelState.rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.state !== "dirty") return;

  room.state = "cleaning";
  renderRooms();
  renderRoomCard();
  saveHotel();

  const ms = cleaningTimeMs();
  setTimeout(() => {
    const r = hotelState.rooms.find(x => x.id === roomId);
    if (!r) return;
    if (r.state === "cleaning") {
      r.state = "empty";
      renderRooms();
      renderRoomCard();
      saveHotel();
    }
  }, ms);
}

/* -------------------------
AUTO ENGINE
------------------------- */
function autoSpawnLoop() {
  if (!AUTO.enabled) return;
  spawnGuest(false);
}

function autoCheckInLoop() {
  if (!AUTO.enabled) return;
  if (hotelState.queue.length === 0) return;
  if (!firstAvailableRoom()) return;
  checkInGuest(false);
}

function autoCheckoutLoop() {
  if (!AUTO.enabled) return;

  const ready = hotelState.rooms.find(r => r.state === "ready");
  if (!ready) return;
  checkoutRoom(ready.id);
}

function autoCleanLoop() {
  if (!AUTO.enabled) return;

  const dirty = hotelState.rooms.find(r => r.state === "dirty");
  if (!dirty) return;
  cleanRoomById(dirty.id);
}

/* -------------------------
Shop
------------------------- */
function buyUpgrade(which) {
  const coins = getCoins();

  if (which === "cleaner") {
    if (hotelState.upgrades.cleaner) return setHint("Cleaner already bought ✅");
    if (coins < 120) return setHint("Not enough coins for Cleaner.");
    setCoins(coins - 120);
    hotelState.upgrades.cleaner = 1;
    setHint("Cleaner purchased 🧹 (cleaning faster)");
  }

  if (which === "bellboy") {
    if (hotelState.upgrades.bellboy) return setHint("Bellboy already bought ✅");
    if (coins < 160) return setHint("Not enough coins for Bellboy.");
    setCoins(coins - 160);
    hotelState.upgrades.bellboy = 1;
    setHint("Bellboy purchased 🛎️ (snack tips higher)");
  }

  saveHotel();
}

function resetMombasaProgress() {
  localStorage.removeItem("mombasaHotel");
  localStorage.removeItem("coins");

  hotelState.served = 0;
  hotelState.queue = [];
  hotelState.selectedRoomId = 1;
  hotelState.upgrades = { cleaner: 0, bellboy: 0 };

  initRoomsFresh();
  setCoins(0);
  setHint("Progress reset ♻️");

  updateHud();
  renderRooms();
  renderRoomCard();
}

/* =========================
PUZZLE (simple match-3 images)
========================= */
const PUZZLE = {
  width: 8,
  tiles: [
    "images/tiles/palm.png",
    "images/tiles/shell.png",
    "images/tiles/fish.png",
    "images/tiles/coconut.png",
    "images/tiles/wave.png",
    "images/tiles/sun.png",
  ],
};

let pBoard = [];
let pSelected = null;

function initPuzzle() {
  const boardEl = $("board");
  if (!boardEl) return;

  boardEl.innerHTML = "";
  pBoard = [];
  pSelected = null;

  const total = PUZZLE.width * PUZZLE.width;

  for (let i = 0; i < total; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.i = String(i);

    const img = document.createElement("img");
    img.alt = "tile";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";

    const src = PUZZLE.tiles[randInt(0, PUZZLE.tiles.length - 1)];
    img.src = src;

    tile.appendChild(img);
    tile.addEventListener("click", () => onTileClick(i));

    $("board").appendChild(tile);
    pBoard.push({ img: src, el: tile });
  }

  if ($("msg")) $("msg").textContent = "Make a match!";
}

function areAdjacent(a, b) {
  const w = PUZZLE.width;
  const ax = a % w, ay = Math.floor(a / w);
  const bx = b % w, by = Math.floor(b / w);
  return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
}

function setTileImg(i, src) {
  const imgEl = pBoard[i].el.querySelector("img");
  if (imgEl) imgEl.src = src;
  pBoard[i].img = src;
}

function swapTiles(a, b) {
  const imgA = pBoard[a].img;
  const imgB = pBoard[b].img;
  setTileImg(a, imgB);
  setTileImg(b, imgA);
}

function findMatches() {
  const w = PUZZLE.width;
  const matches = new Set();

  // horizontal
  for (let r = 0; r < w; r++) {
    let runStart = r * w;
    let runLen = 1;

    for (let c = 1; c < w; c++) {
      const i = r * w + c;
      const prev = r * w + (c - 1);
      if (pBoard[i].img === pBoard[prev].img) runLen++;
      else {
        if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k);
        runStart = i;
        runLen = 1;
      }
    }
    if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k);
  }

  // vertical
  for (let c = 0; c < w; c++) {
    let runStart = c;
    let runLen = 1;

    for (let r = 1; r < w; r++) {
      const i = r * w + c;
      const prev = (r - 1) * w + c;
      if (pBoard[i].img === pBoard[prev].img) runLen++;
      else {
        if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
        runStart = i;
        runLen = 1;
      }
    }
    if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
  }

  return matches;
}

function crushMatches(matches) {
  const earned = matches.size;
  setCoins(getCoins() + earned);
  if ($("msg")) $("msg").textContent = `Crush! +${earned} coins 🪙`;

  matches.forEach(i => {
    const el = pBoard[i].el;
    el.style.transition = "transform 120ms, opacity 120ms";
    el.style.opacity = "0.25";
    el.style.transform = "scale(0.88)";
  });

  setTimeout(() => {
    matches.forEach(i => {
      const src = PUZZLE.tiles[randInt(0, PUZZLE.tiles.length - 1)];
      setTileImg(i, src);
      const el = pBoard[i].el;
      el.style.opacity = "1";
      el.style.transform = "scale(1)";
    });

    const chain = findMatches();
    if (chain.size > 0) crushMatches(chain);
  }, 150);
}

function onTileClick(i) {
  if (pSelected === null) {
    pSelected = i;
    pBoard[i].el.style.outline = "2px solid rgba(34,197,94,.75)";
    return;
  }

  const a = pSelected;
  pBoard[a].el.style.outline = "none";
  pSelected = null;

  if (a === i) return;
  if (!areAdjacent(a, i)) return;

  swapTiles(a, i);
  const matches = findMatches();

  if (matches.size === 0) {
    swapTiles(a, i);
    return;
  }

  crushMatches(matches);
}

/* -------------------------
Buttons
------------------------- */
function bindButtons() {
  $("btnSpawnGuest")?.addEventListener("click", () => spawnGuest(true));

  $("btnAuto")?.addEventListener("click", () => {
    AUTO.enabled = !AUTO.enabled;
    $("btnAuto").textContent = AUTO.enabled ? "🤖 Auto: ON" : "🤖 Auto: OFF";
    setHint(AUTO.enabled ? "Auto mode ON ✅" : "Auto mode OFF ⛔");
  });

  $("btnCheckIn")?.addEventListener("click", () => checkInGuest(true));
  $("btnServeQueue")?.addEventListener("click", () => checkInGuest(false));

  $("btnDeliverSnack")?.addEventListener("click", () => {
    const sel = getSelectedRoom();
    if (!sel) return setHint("Select a room first.");
    deliverSnack(sel.id);
    renderRooms(); renderRoomCard(); updateHud();
  });

  $("btnCheckout")?.addEventListener("click", () => {
    const sel = getSelectedRoom();
    if (!sel) return setHint("Select a room first.");
    checkoutRoom(sel.id);
  });

  $("btnClean")?.addEventListener("click", () => {
    const sel = getSelectedRoom();
    if (!sel) return setHint("Select a room first.");
    cleanRoomById(sel.id);
  });

  $("btnEmergencyClean")?.addEventListener("click", () => {
    const sel = getSelectedRoom();
    if (!sel) return setHint("Select a room first.");
    cleanRoomById(sel.id);
  });

  $("buyCleaner")?.addEventListener("click", () => buyUpgrade("cleaner"));
  $("buyBellboy")?.addEventListener("click", () => buyUpgrade("bellboy"));

  $("btnResetMombasa")?.addEventListener("click", resetMombasaProgress);

  $("resetPuzzle")?.addEventListener("click", initPuzzle);
}

/* -------------------------
BOOT
------------------------- */
window.addEventListener("load", () => {
  setCoins(getCoins());
  initTabs();

  const loaded = loadHotel();
  if (!loaded) initRoomsFresh();

  if (!hotelState.selectedRoomId) hotelState.selectedRoomId = 1;

  updateHud();
  renderRooms();
  renderRoomCard();

  bindButtons();

  // queue patience timer
  setInterval(tickQueue, 350);

  // ✅ Auto loops
  setInterval(autoSpawnLoop, AUTO.spawnEveryMs);
  setInterval(autoCheckInLoop, AUTO.autoCheckInEveryMs);
  setInterval(autoCheckoutLoop, AUTO.autoCheckoutEveryMs);
  setInterval(autoCleanLoop, AUTO.autoCleanEveryMs);

  // puzzle
  initPuzzle();
});
