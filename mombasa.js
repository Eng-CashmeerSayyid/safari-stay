/* =========================
mombasa.js (FINAL - Mode 3)
Auto: spawn + queue patience
Manual: check-in, snack, checkout, clean
Rooms: 4
Coins shared across hotel + puzzle
========================= */

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ---------- coins (shared) ---------- */
function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}
function setCoins(n) {
  const val = Math.max(0, Number(n) || 0);
  localStorage.setItem("coins", String(val));
  if ($("coins")) $("coins").textContent = String(val);
  if ($("coinsPuzzle")) $("coinsPuzzle").textContent = String(val);
}

/* ---------- tabs ---------- */
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
HOTEL MODE
========================= */
const HOTEL = {
  roomCount: 4,
  maxQueue: 6,
  spawnEveryMs: 3800,
  patienceMs: 14000,
  stayMs: 9000,
  cleanMsBase: 2600,
  snackChance: 0.35,
  snackTip: 3,
  checkinCoin: 1,
  checkoutCoin: 2,
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];

const AUTO = {
  autoSpawn: true
};

let hotelState = {
  served: 0,
  angry: 0,
  queue: [], // {id, face, expiresAt, createdAt}
  rooms: [], // {id, state, guestId, guestFace, snackOrdered, readyAt}
  selectedRoomId: 1,
  upgrades: { cleaner: 0, bellboy: 0 },
};

function saveHotel() {
  localStorage.setItem("mombasaHotel", JSON.stringify({
    served: hotelState.served,
    angry: hotelState.angry,
    queue: hotelState.queue,
    rooms: hotelState.rooms,
    selectedRoomId: hotelState.selectedRoomId,
    upgrades: hotelState.upgrades
  }));
}

function loadHotel() {
  try {
    const raw = localStorage.getItem("mombasaHotel");
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rooms)) return false;

    // If old save had different room count, ignore it
    if (data.rooms.length !== HOTEL.roomCount) return false;

    hotelState.served = Number(data.served) || 0;
    hotelState.angry = Number(data.angry) || 0;
    hotelState.queue = Array.isArray(data.queue) ? data.queue : [];
    hotelState.rooms = data.rooms;
    hotelState.selectedRoomId = Number(data.selectedRoomId) || 1;
    hotelState.upgrades = data.upgrades || hotelState.upgrades;
    return true;
  } catch {
    return false;
  }
}

function setHint(t) {
  if ($("hint")) $("hint").textContent = t;
}

function updateHud() {
  if ($("queueCount")) $("queueCount").textContent = String(hotelState.queue.length);
  if ($("served")) $("served").textContent = String(hotelState.served);
  if ($("angry")) $("angry").textContent = String(hotelState.angry);
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
      snackOrdered: false,
      readyAt: 0
    });
  }
  hotelState.selectedRoomId = 1;
}

function getSelectedRoom() {
  return hotelState.rooms.find(r => r.id === hotelState.selectedRoomId) || null;
}

function firstEmptyRoom() {
  return hotelState.rooms.find(r => r.state === "empty") || null;
}

function roomLabel(r) {
  if (r.state === "empty") return "✅ Empty";
  if (r.state === "occupied") return "🟦 Occupied";
  if (r.state === "ready") return r.snackOrdered ? "🛎️ Ready (Snack!)" : "⭐ Ready";
  if (r.state === "dirty") return "🟥 Dirty";
  if (r.state === "cleaning") return "🧽 Cleaning…";
  return r.state;
}

/* ---------- render rooms ---------- */
function renderRooms() {
  const grid = $("hotelGrid");
  if (!grid) return;

  grid.innerHTML = "";

  hotelState.rooms.forEach((r) => {
    const selected = r.id === hotelState.selectedRoomId;

    const div = document.createElement("div");
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
        <strong>Room ${r.id}</strong>
        <span style="font-size:12px;opacity:.85">${roomLabel(r)}</span>
      </div>
      <div style="font-size:20px">${r.guestFace ? r.guestFace : " "}</div>
      <div style="font-size:12px;opacity:.75">${r.guestId ? ("Guest " + r.guestId) : ""}</div>
    `;

    div.addEventListener("click", () => {
      hotelState.selectedRoomId = r.id;
      renderRooms();
      renderRoomCard();
      saveHotel();
    });

    grid.appendChild(div);
  });
}

/* ---------- render room details ---------- */
function renderRoomCard() {
  const card = $("roomCard");
  if (!card) return;

  const r = getSelectedRoom();
  if (!r) {
    card.innerHTML = `<div class="muted">Select a room.</div>`;
    return;
  }

  const snack = r.snackOrdered ? "🛎️ Snack order pending" : "No snack order";
  const guest = r.guestId ? `${r.guestFace} Guest ${r.guestId}` : "No guest";

  card.innerHTML = `
    <div><strong>Room ${r.id}</strong></div>
    <div class="muted">${roomLabel(r)}</div>
    <div style="margin-top:8px">${guest}</div>
    <div style="margin-top:6px;opacity:.9">${snack}</div>
  `;
}

/* ---------- queue UI ---------- */
function renderQueue() {
  const wrap = $("queueList");
  if (!wrap) return;

  const now = Date.now();
  wrap.innerHTML = "";

  if (hotelState.queue.length === 0) {
    wrap.innerHTML = `<div style="opacity:.75;font-size:13px;">No guests yet…</div>`;
    return;
  }

  hotelState.queue.forEach((g, idx) => {
    const remaining = Math.max(0, g.expiresAt - now);
    const ratio = Math.max(0, Math.min(1, remaining / HOTEL.patienceMs));

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.padding = "10px 10px";
    row.style.borderRadius = "12px";
    row.style.border = "1px solid rgba(255,255,255,.12)";
    row.style.background = "rgba(255,255,255,.05)";

    row.innerHTML = `
      <div style="font-size:18px">${g.face}</div>
      <div style="flex:1">
        <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;">
          <div style="height:100%;width:${Math.round(ratio*100)}%;background:rgba(34,197,94,.85)"></div>
        </div>
        <div style="font-size:12px;opacity:.8;margin-top:4px;">${Math.ceil(remaining/1000)}s • #${idx+1}</div>
      </div>
    `;

    wrap.appendChild(row);
  });
}

/* ---------- spawn + patience ---------- */
function spawnGuest(manual=false) {
  if (hotelState.queue.length >= HOTEL.maxQueue) return;

  const id = Math.random().toString(16).slice(2, 6).toUpperCase();
  const face = faces[randInt(0, faces.length - 1)];
  const now = Date.now();

  hotelState.queue.push({
    id,
    face,
    createdAt: now,
    expiresAt: now + HOTEL.patienceMs
  });

  if (manual) setHint(`New guest arrived ${face} 👤`);
  updateHud();
  renderQueue();
  saveHotel();
}

function tickQueue() {
  const now = Date.now();
  let left = 0;

  const kept = [];
  for (const g of hotelState.queue) {
    if (g.expiresAt > now) kept.push(g);
    else left++;
  }

  if (left > 0) {
    hotelState.angry += left;
    setHint(`${left} guest(s) left 😭 (patience ran out)`);
    hotelState.queue = kept;
    updateHud();
    renderQueue();
    saveHotel();
  } else {
    // still update bars smoothly
    renderQueue();
  }
}

/* ---------- manual actions ---------- */
function checkIn(preferSelected=true) {
  if (hotelState.queue.length === 0) {
    setHint("No guests in queue. Wait for auto-spawn or tap Spawn Guest.");
    return;
  }

  let room = null;
  if (preferSelected) {
    const sel = getSelectedRoom();
    if (sel && sel.state === "empty") room = sel;
  }
  if (!room) room = firstEmptyRoom();

  if (!room) {
    setHint("No empty rooms. Checkout + clean first.");
    return;
  }

  const guest = hotelState.queue.shift();
  room.state = "occupied";
  room.guestId = guest.id;
  room.guestFace = guest.face;
  room.snackOrdered = Math.random() < HOTEL.snackChance;
  room.readyAt = Date.now() + HOTEL.stayMs;

  setCoins(getCoins() + HOTEL.checkinCoin);
  setHint(`Checked in ${guest.face} to Room ${room.id} ✅`);

  hotelState.selectedRoomId = room.id;

  updateHud();
  renderQueue();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function deliverSnack() {
  const r = getSelectedRoom();
  if (!r) return setHint("Select a room first.");
  if (!r.guestId) return setHint("No guest here.");
  if (!r.snackOrdered) return setHint("No snack order for this room.");

  r.snackOrdered = false;
  const bonus = HOTEL.snackTip + (hotelState.upgrades.bellboy ? 2 : 0);
  setCoins(getCoins() + bonus);

  setHint(`Snack delivered 😍 +${bonus} coins`);
  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function checkout() {
  const r = getSelectedRoom();
  if (!r) return setHint("Select a room first.");
  if (!r.guestId) return setHint("No guest to checkout.");

  // must be ready (or allow early checkout if you want)
  if (r.state !== "ready") {
    setHint("Guest not ready yet ⭐ (wait a bit).");
    return;
  }

  hotelState.served += 1;
  setCoins(getCoins() + HOTEL.checkoutCoin);

  r.state = "dirty";
  r.guestId = null;
  r.guestFace = null;
  r.snackOrdered = false;
  r.readyAt = 0;

  setHint(`Checkout complete ✅ Room ${r.id} is dirty 🟥`);
  updateHud();
  renderRooms();
  renderRoomCard();
  saveHotel();
}

function cleaningTimeMs() {
  const reduction = hotelState.upgrades.cleaner ? 700 : 0;
  return Math.max(1200, HOTEL.cleanMsBase - reduction);
}

function cleanSelected() {
  const r = getSelectedRoom();
  if (!r) return setHint("Select a room first.");
  if (r.state !== "dirty") return setHint("Room is not dirty.");

  r.state = "cleaning";
  setHint(`Cleaning Room ${r.id}… 🧽`);
  renderRooms();
  renderRoomCard();
  saveHotel();

  const ms = cleaningTimeMs();
  setTimeout(() => {
    const rr = hotelState.rooms.find(x => x.id === r.id);
    if (!rr) return;
    if (rr.state === "cleaning") {
      rr.state = "empty";
      setHint(`Room ${rr.id} is clean ✅`);
      renderRooms();
      renderRoomCard();
      saveHotel();
    }
  }, ms);
}

/* ---------- room timers (occupied -> ready) ---------- */
function tickRooms() {
  const now = Date.now();
  let changed = false;

  for (const r of hotelState.rooms) {
    if (r.state === "occupied" && r.readyAt && now >= r.readyAt) {
      r.state = "ready";
      changed = true;
    }
  }

  if (changed) {
    renderRooms();
    renderRoomCard();
    saveHotel();
  }
}

/* ---------- shop ---------- */
function buyUpgrade(which) {
  const coins = getCoins();

  if (which === "cleaner") {
    if (hotelState.upgrades.cleaner) return setHint("Cleaner already bought ✅");
    if (coins < 120) return setHint("Not enough coins for Cleaner.");
    setCoins(coins - 120);
    hotelState.upgrades.cleaner = 1;
    setHint("Cleaner purchased 🧹");
  }

  if (which === "bellboy") {
    if (hotelState.upgrades.bellboy) return setHint("Bellboy already bought ✅");
    if (coins < 160) return setHint("Not enough coins for Bellboy.");
    setCoins(coins - 160);
    hotelState.upgrades.bellboy = 1;
    setHint("Bellboy purchased 🛎️");
  }

  saveHotel();
}

function resetMombasaProgress() {
  localStorage.removeItem("mombasaHotel");
  localStorage.removeItem("coins");

  hotelState.served = 0;
  hotelState.angry = 0;
  hotelState.queue = [];
  hotelState.upgrades = { cleaner: 0, bellboy: 0 };

  initRoomsFresh();
  setCoins(0);

  setHint("Progress reset ♻️");
  updateHud();
  renderQueue();
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
    // small shake feedback
    pBoard[i].el.style.transition = "transform 80ms";
    pBoard[i].el.style.transform = "scale(0.96)";
    setTimeout(() => pBoard[i].el.style.transform = "scale(1.03)", 90);
    setTimeout(() => pBoard[i].el.style.transform = "scale(1)", 180);
    return;
  }

  crushMatches(matches);
}

/* ---------- buttons ---------- */
function bindButtons() {
  $("btnSpawnGuest")?.addEventListener("click", () => spawnGuest(true));

  $("btnAutoSpawn")?.addEventListener("click", () => {
    AUTO.autoSpawn = !AUTO.autoSpawn;
    $("btnAutoSpawn").textContent = AUTO.autoSpawn ? "🤖 Auto Spawn: ON" : "🤖 Auto Spawn: OFF";
    setHint(AUTO.autoSpawn ? "Auto spawn ON ✅" : "Auto spawn OFF ⛔");
  });

  $("btnCheckIn")?.addEventListener("click", () => checkIn(true));
  $("btnServeQueue")?.addEventListener("click", () => checkIn(false));

  $("btnDeliverSnack")?.addEventListener("click", deliverSnack);
  $("btnCheckout")?.addEventListener("click", checkout);
  $("btnClean")?.addEventListener("click", cleanSelected);
  $("btnEmergencyClean")?.addEventListener("click", cleanSelected);

  $("buyCleaner")?.addEventListener("click", () => buyUpgrade("cleaner"));
  $("buyBellboy")?.addEventListener("click", () => buyUpgrade("bellboy"));

  $("btnResetMombasa")?.addEventListener("click", resetMombasaProgress);
  $("resetPuzzle")?.addEventListener("click", initPuzzle);
}

/* ---------- boot ---------- */
window.addEventListener("load", () => {
  setCoins(getCoins());
  initTabs();

  const loaded = loadHotel();
  if (!loaded) initRoomsFresh();

  // safety selection
  if (!hotelState.selectedRoomId) hotelState.selectedRoomId = 1;

  updateHud();
  renderQueue();
  renderRooms();
  renderRoomCard();

  bindButtons();

  // ticks
  setInterval(tickQueue, 250);   // patience bars + angry leaves
  setInterval(tickRooms, 300);   // occupied -> ready

  // auto spawn loop (Mode 3)
  setInterval(() => {
    if (AUTO.autoSpawn) spawnGuest(false);
  }, HOTEL.spawnEveryMs);

  // puzzle
  initPuzzle();
});
