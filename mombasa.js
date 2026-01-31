/* =========================
mombasa.js (FULL)
- Tabs switching
- Shared coins (hotel + puzzle)
- HOTEL MANIA A: spawn guest -> queue -> check-in -> checkout -> dirty -> clean
- Simple match-3 puzzle using tile images
========================= */

/* -------------------------
Helpers
------------------------- */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
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
HOTEL MODE (A)
========================= */

const HOTEL = {
  roomCount: 6,
  patienceMs: 15000,
  stayMs: 10000,
  cleanMsBase: 3000,
  snackChance: 0.35,
  snackTip: 3,
  checkinCoin: 1,
  checkoutCoin: 2,
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];

let hotelState = {
  served: 0,
  queue: [], // {id, face, expiresAt}
  rooms: [], // {id, state, guestId, guestFace, ready, snackOrdered, cleaningUntil}
  selectedRoomId: null,
  upgrades: {
    cleaner: 0,  // reduces cleaning time
    bellboy: 0,  // increases snack tip
  }
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
  setCoins(getCoins()); // refresh both coins displays
}

function initRoomsFresh() {
  hotelState.rooms = [];
  for (let i = 1; i <= HOTEL.roomCount; i++) {
    hotelState.rooms.push({
      id: i,
      state: "empty", // empty | occupied | ready | dirty | cleaning
      guestId: null,
      guestFace: null,
      ready: false,
      snackOrdered: false,
      cleaningUntil: 0
    });
  }
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
      <div style="font-size:18px">${room.guestFace ? room.guestFace : " "}</div>
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

  const status = roomLabel(room);
  const guestText = room.guestId ? `${room.guestFace} Guest ${room.guestId}` : "No guest";
  const snackText = room.snackOrdered ? "🛎️ Snack order pending" : "No snack order";
  const readyText = room.state === "ready" ? "✅ Ready for checkout" : "";

  card.innerHTML = `
    <div><strong>Room ${room.id}</strong></div>
    <div class="muted">${status}</div>
    <div style="margin-top:8px">${guestText}</div>
    <div style="margin-top:6px;opacity:.9">${snackText}</div>
    <div style="margin-top:6px;opacity:.9">${readyText}</div>
  `;
}

function getSelectedRoom() {
  const id = hotelState.selectedRoomId;
  return hotelState.rooms.find(r => r.id === id) || null;
}

function firstAvailableRoom() {
  return hotelState.rooms.find(r => r.state === "empty") || null;
}

function spawnGuest() {
  if (hotelState.queue.length >= 6) {
    setHint("Queue full 😅 Serve guests first.");
    return;
  }
  const id = Math.random().toString(16).slice(2, 6).toUpperCase();
  const face = faces[randInt(0, faces.length - 1)];
  const now = Date.now();
  hotelState.queue.push({
    id,
    face,
    expiresAt: now + HOTEL.patienceMs
  });
  setHint(`New guest arrived ${face} (Queue: ${hotelState.queue.length})`);
  updateHud();
  saveHotel();
}

function tickQueue() {
  const now = Date.now();
  const before = hotelState.queue.length;
  hotelState.queue = hotelState.queue.filter(g => g.expiresAt > now);

  if (hotelState.queue.length < before) {
    setHint("Some guests left 😭 (patience ran out).");
    updateHud();
    saveHotel();
  }
}

function checkInGuest(preferSelected = true) {
  if (hotelState.queue.length === 0) {
    setHint("No guests in queue. Tap “Spawn Guest”.");
    return;
  }

  let room = null;
  if (preferSelected) {
    const sel = getSelectedRoom();
    if (sel && sel.state === "empty") room = sel;
  }
  if (!room) room = firstAvailableRoom();

  if (!room) {
    setHint("No empty rooms! Checkout + clean first.");
    return;
  }

  const guest = hotelState.queue.shift();
  room.state = "occupied";
  room.guestId = guest.id;
  room.guestFace = guest.face;
  room.ready = false;
  room.snackOrdered = Math.random() < HOTEL.snackChance;
  room.cleaningUntil = 0;

  setCoins(getCoins() + HOTEL.checkinCoin);
  setHint(`Checked in ${guest.face} to Room ${room.id} ✅`);
  hotelState.selectedRoomId = room.id;

  // After stay, mark ready
  setTimeout(() => {
    const r = hotelState.rooms.find(x => x.id === room.id);
    if (!r) return;
    // only if still occupied with same guest
    if (r.state === "occupied" && r.guestId === guest.id) {
      r.state = "ready";
      r.ready = true;
      setHint(r.snackOrdered ? `Room ${r.id}: Guest wants snacks 🛎️` : `Room ${r.id}: Ready to checkout ⭐`);
      renderRooms();
      renderRoomCard();
      saveHotel();
    }
  }, HOTEL.stayMs);

  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function deliverSnack() {
  const room = getSelectedRoom();
  if (!room) return setHint("Select a room first.");
  if (!room.guestId) return setHint("No guest in this room.");
  if (!room.snackOrdered) return setHint("No snack order here.");

  room.snackOrdered = false;
  const bonus = HOTEL.snackTip + (hotelState.upgrades.bellboy ? 2 : 0);
  setCoins(getCoins() + bonus);
  setHint(`Snack delivered! +${bonus} coins 😍`);
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function checkoutGuest() {
  const room = getSelectedRoom();
  if (!room) return setHint("Select a room first.");
  if (!room.guestId) return setHint("No guest to checkout.");
  if (room.state !== "ready" && room.state !== "occupied") {
    return setHint("This room is not ready for checkout.");
  }

  // checkout
  hotelState.served += 1;
  setCoins(getCoins() + HOTEL.checkoutCoin);

  setHint(`Guest checked out! Room ${room.id} is now dirty 🟥`);
  room.state = "dirty";
  room.ready = false;

  // keep guest visible briefly? we clear it now:
  room.guestId = null;
  room.guestFace = null;
  room.snackOrdered = false;

  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function cleaningTimeMs() {
  // cleaner upgrade reduces time
  const reduction = hotelState.upgrades.cleaner ? 800 : 0;
  return Math.max(1400, HOTEL.cleanMsBase - reduction);
}

function cleanRoom(selectedOnly = true) {
  const room = selectedOnly ? getSelectedRoom() : null;
  if (!room) return setHint("Select a room first.");
  if (room.state !== "dirty") return setHint("Room is not dirty.");

  room.state = "cleaning";
  const ms = cleaningTimeMs();
  room.cleaningUntil = Date.now() + ms;
  setHint(`Cleaning Room ${room.id}… 🧽`);

  renderRooms();
  renderRoomCard();
  saveHotel();

  setTimeout(() => {
    const r = hotelState.rooms.find(x => x.id === room.id);
    if (!r) return;
    if (r.state === "cleaning") {
      r.state = "empty";
      r.cleaningUntil = 0;
      setHint(`Room ${r.id} is clean ✅`);
      renderRooms();
      renderRoomCard();
      saveHotel();
    }
  }, ms);
}

/* -------------------------
Shop buttons (simple)
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
  hotelState.selectedRoomId = null;
  hotelState.upgrades = { cleaner: 0, bellboy: 0 };
  initRoomsFresh();
  setCoins(0);
  setHint("Progress reset ♻️");
  updateHud();
  renderRooms();
  renderRoomCard();
}

/* =========================
PUZZLE (simple match-3)
- uses <div id="board">
- images in images/tiles/
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

let pBoard = [];      // array of {img, el}
let pSelected = null; // index

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

    // If your CSS expects img inside tiles:
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
    boardEl.appendChild(tile);

    pBoard.push({ img: src, el: tile });
  }

  if ($("msg")) $("msg").textContent = "Make a match!";
}

function onTileClick(i) {
  if (pSelected === null) {
    pSelected = i;
    highlightTile(i, true);
    return;
  }

  if (pSelected === i) {
    highlightTile(i, false);
    pSelected = null;
    return;
  }

  const a = pSelected;
  const b = i;

  // Must be adjacent
  const ok = areAdjacent(a, b);
  highlightTile(a, false);
  pSelected = null;

  if (!ok) {
    pulseTile(b);
    return;
  }

  swapTiles(a, b);

  // Check matches after swap
  const matches = findMatches();
  if (matches.size === 0) {
    // swap back
    swapTiles(a, b);
    pulseTile(b);
    return;
  }

  crushMatches(matches);
}

function highlightTile(i, on) {
  const el = pBoard[i]?.el;
  if (!el) return;
  el.style.outline = on ? "2px solid rgba(34,197,94,.7)" : "none";
}

function pulseTile(i) {
  const el = pBoard[i]?.el;
  if (!el) return;
  el.style.transition = "transform 80ms";
  el.style.transform = "scale(0.96)";
  setTimeout(() => el.style.transform = "scale(1.03)", 90);
  setTimeout(() => el.style.transform = "scale(1.0)", 180);
}

function areAdjacent(a, b) {
  const w = PUZZLE.width;
  const ax = a % w, ay = Math.floor(a / w);
  const bx = b % w, by = Math.floor(b / w);
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) === 1;
}

function tileImg(i) {
  const imgEl = pBoard[i].el.querySelector("img");
  return imgEl?.src || "";
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
  const total = w * w;
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
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) matches.add(runStart + k);
        }
        runStart = i;
        runLen = 1;
      }
    }
    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) matches.add(runStart + k);
    }
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
        if (runLen >= 3) {
          for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
        }
        runStart = i;
        runLen = 1;
      }
    }
    if (runLen >= 3) {
      for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
    }
  }

  return matches;
}

function crushMatches(matches) {
  // coins reward: +1 per tile crushed
  const earned = matches.size;
  setCoins(getCoins() + earned);

  if ($("msg")) $("msg").textContent = `Crush! +${earned} coins 🪙`;

  // "crush" animation
  matches.forEach(i => {
    const el = pBoard[i].el;
    el.style.transition = "transform 120ms, opacity 120ms";
    el.style.opacity = "0.2";
    el.style.transform = "scale(0.85)";
  });

  setTimeout(() => {
    // replace matched tiles with random new tiles
    matches.forEach(i => {
      const src = PUZZLE.tiles[randInt(0, PUZZLE.tiles.length - 1)];
      setTileImg(i, src);
      const el = pBoard[i].el;
      el.style.opacity = "1";
      el.style.transform = "scale(1)";
    });

    // chain reaction
    const chain = findMatches();
    if (chain.size > 0) crushMatches(chain);
  }, 150);
}

/* -------------------------
Wire up buttons
------------------------- */
function bindHotelButtons() {
  $("btnSpawnGuest")?.addEventListener("click", spawnGuest);

  $("btnCheckIn")?.addEventListener("click", () => checkInGuest(true));
  $("btnServeQueue")?.addEventListener("click", () => checkInGuest(false));

  $("btnDeliverSnack")?.addEventListener("click", deliverSnack);
  $("btnCheckout")?.addEventListener("click", checkoutGuest);
  $("btnClean")?.addEventListener("click", () => cleanRoom(true));
  $("btnEmergencyClean")?.addEventListener("click", () => cleanRoom(true));

  $("buyCleaner")?.addEventListener("click", () => buyUpgrade("cleaner"));
  $("buyBellboy")?.addEventListener("click", () => buyUpgrade("bellboy"));

  $("btnResetMombasa")?.addEventListener("click", resetMombasaProgress);
}

function bindPuzzleButtons() {
  $("resetPuzzle")?.addEventListener("click", initPuzzle);
}

/* -------------------------
Boot
------------------------- */
window.addEventListener("load", () => {
  // coins render
  setCoins(getCoins());

  initTabs();

  // hotel load/init
  const loaded = loadHotel();
  if (!loaded) initRoomsFresh();

  // If rooms array missing (safety)
  if (!Array.isArray(hotelState.rooms) || hotelState.rooms.length === 0) initRoomsFresh();

  // Select first room by default
  if (!hotelState.selectedRoomId) hotelState.selectedRoomId = 1;

  updateHud();
  renderRooms();
  renderRoomCard();

  bindHotelButtons();

  // queue patience tick
  setInterval(tickQueue, 300);

  // puzzle init
  initPuzzle();
  bindPuzzleButtons();
});
