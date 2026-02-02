/* =========================
mombasa.js (LEVELS + MODAL + HOTEL MANIA FLOW)
- Manual check-in: click guest -> click EMPTY room
- Auto checkout after ready (always)
- Manual cleaning: click detergent mode -> click dirty room
- Snacks: PREP (time) -> HOLD -> click room to deliver
- Slow patience timers (per level)
- Rooms = 4
- Puzzle unchanged (background-image tiles)
========================= */

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ---------- coins ---------- */
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
  const panels = { hotel: $("tab-hotel"), puzzle: $("tab-puzzle"), shop: $("tab-shop") };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      Object.values(panels).forEach((p) => p && p.classList.remove("active"));
      panels[btn.dataset.tab]?.classList.add("active");
    });
  });
}

/* =========================
LEVELS (Mombasa 1–10)
========================= */
const LEVELS = {
  1: { goalGuests: 5,  failNoAngry: false, patienceMs: 70000, spawnEveryMs: 8000, snackChance: 0.15 },
  2: { goalGuests: 8,  failNoAngry: false, patienceMs: 68000, spawnEveryMs: 7600, snackChance: 0.20 },
  3: { goalGuests: 10, failNoAngry: false, patienceMs: 65000, spawnEveryMs: 7200, snackChance: 0.25 },
  4: { goalGuests: 10, failNoAngry: false, patienceMs: 65000, spawnEveryMs: 7000, snackChance: 0.35 },
  5: { goalGuests: 12, failNoAngry: false, patienceMs: 63000, spawnEveryMs: 6800, snackChance: 0.40 },
  6: { goalGuests: 12, failNoAngry: true,  patienceMs: 65000, spawnEveryMs: 7200, snackChance: 0.35 },
  7: { goalGuests: 14, failNoAngry: true,  patienceMs: 62000, spawnEveryMs: 6800, snackChance: 0.45 },
  8: { goalGuests: 15, failNoAngry: true,  patienceMs: 60000, spawnEveryMs: 6500, snackChance: 0.50 },
  9: { goalGuests: 16, failNoAngry: true,  patienceMs: 58000, spawnEveryMs: 6200, snackChance: 0.55 },
  10:{ goalGuests: 18, failNoAngry: true,  patienceMs: 58000, spawnEveryMs: 6000, snackChance: 0.60 },
};

function clampLevel(n) {
  const x = Number(n) || 1;
  if (x < 1) return 1;
  if (x > 10) return 10;
  return x;
}

/* =========================
HOTEL BASE CONFIG
(Level overrides apply)
========================= */
const HOTEL_BASE = {
  roomCount: 4,
  maxQueue: 6,

  spawnEveryMs: 7000,
  patienceMs: 65000,
  snackChance: 0.35,

  stayMs: 9000,
  autoCheckoutDelayMs: 3500,

  cleanMsBase: 2600,
  snackPrepMs: 2200,

  checkinCoin: 2,
  checkoutCoin: 3,
  snackPay: 4,
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];
const AUTO = { spawn: true };

let HOTEL = { ...HOTEL_BASE };

let state = {
  level: 1,
  served: 0,
  angry: 0,
  queue: [],
  rooms: [],

  selectedRoomId: 1,
  selectedGuestId: null,

  upgrades: { cleaner: 0, bellboy: 0 },

  tool: null, // null | "detergent" | "deliverSnack"
  snackHeld: false,
  snackPreparing: false
};

let levelStartAt = Date.now();

function hint(t) { if ($("hint")) $("hint").textContent = t; }

function applyLevelConfig() {
  state.level = clampLevel(state.level);
  const cfg = LEVELS[state.level] || LEVELS[1];

  HOTEL = { ...HOTEL_BASE };
  HOTEL.spawnEveryMs = cfg.spawnEveryMs ?? HOTEL_BASE.spawnEveryMs;
  HOTEL.patienceMs   = cfg.patienceMs ?? HOTEL_BASE.patienceMs;
  HOTEL.snackChance  = cfg.snackChance ?? HOTEL_BASE.snackChance;

  if ($("levelNo")) $("levelNo").textContent = String(state.level);
  if ($("levelGoal")) $("levelGoal").textContent = String(cfg.goalGuests);
}

function currentGoalGuests() {
  return (LEVELS[state.level] || LEVELS[1]).goalGuests;
}
function currentFailNoAngry() {
  return !!(LEVELS[state.level] || LEVELS[1]).failNoAngry;
}

/* ---------- save/load ---------- */
function save() {
  localStorage.setItem("mombasaHotel", JSON.stringify({
    level: state.level,
    served: state.served,
    angry: state.angry,
    queue: state.queue,
    rooms: state.rooms,
    selectedRoomId: state.selectedRoomId,
    selectedGuestId: state.selectedGuestId,
    upgrades: state.upgrades,
    snackHeld: state.snackHeld
  }));
}

function load() {
  try {
    const raw = localStorage.getItem("mombasaHotel");
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.rooms)) return false;
    if (d.rooms.length !== HOTEL_BASE.roomCount) return false;

    state.level = clampLevel(d.level || 1);
    state.served = Number(d.served) || 0;
    state.angry = Number(d.angry) || 0;
    state.queue = Array.isArray(d.queue) ? d.queue : [];
    state.rooms = d.rooms;

    state.selectedRoomId = Number(d.selectedRoomId) || 1;
    state.selectedGuestId = d.selectedGuestId || null;
    state.upgrades = d.upgrades || state.upgrades;

    state.tool = null;
    state.snackPreparing = false;
    state.snackHeld = !!d.snackHeld;

    applyLevelConfig();
    return true;
  } catch {
    return false;
  }
}

function initRooms() {
  state.rooms = [];
  for (let i = 1; i <= HOTEL_BASE.roomCount; i++) {
    state.rooms.push({
      id: i,
      status: "empty", // empty | occupied | ready | dirty | cleaning
      guestId: null,
      guestFace: null,
      snackOrdered: false,
      readyAt: 0
    });
  }
  state.selectedRoomId = 1;
}

/* ---------- HUD ---------- */
function updateHud() {
  if ($("queueCount")) $("queueCount").textContent = String(state.queue.length);
  if ($("served")) $("served").textContent = String(state.served);
  if ($("angry")) $("angry").textContent = String(state.angry);
  if ($("levelNo")) $("levelNo").textContent = String(state.level);
  if ($("levelGoal")) $("levelGoal").textContent = String(currentGoalGuests());
  setCoins(getCoins());
}

/* ---------- mood ---------- */
function guestMood(remainingMs) {
  const t = remainingMs / HOTEL.patienceMs;
  if (t > 0.70) return "🙂";
  if (t > 0.40) return "😐";
  if (t > 0.18) return "😤";
  return "😡";
}

/* ---------- queue render ---------- */
function renderQueue() {
  const wrap = $("queueList");
  if (!wrap) return;

  const now = Date.now();
  wrap.innerHTML = "";

  if (state.queue.length === 0) {
    wrap.innerHTML = `<div style="opacity:.75;font-size:13px;">No guests yet…</div>`;
    return;
  }

  state.queue.forEach((g, idx) => {
    const remaining = Math.max(0, g.expiresAt - now);
    const ratio = Math.max(0, Math.min(1, remaining / HOTEL.patienceMs));
    const mood = guestMood(remaining);
    const selected = state.selectedGuestId === g.id;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.padding = "10px";
    row.style.borderRadius = "12px";
    row.style.border = "1px solid rgba(255,255,255,.12)";
    row.style.background = "rgba(255,255,255,.05)";
    row.style.cursor = "pointer";
    row.style.userSelect = "none";
    if (selected) row.style.outline = "2px solid rgba(34,197,94,.55)";

    row.innerHTML = `
      <div style="font-size:18px">${g.face}</div>
      <div style="font-size:18px">${mood}</div>
      <div style="flex:1">
        <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;">
          <div style="height:100%;width:${Math.round(ratio*100)}%;background:rgba(34,197,94,.85)"></div>
        </div>
        <div style="font-size:12px;opacity:.8;margin-top:4px;">${Math.ceil(remaining/1000)}s • #${idx+1}</div>
      </div>
    `;

    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.selectedGuestId = g.id;
      renderSelectedGuest();
      renderQueue();
      hint("Guest selected ✅ Now click an EMPTY room to check in.");
      save();
    });

    wrap.appendChild(row);
  });
}

function renderSelectedGuest() {
  const card = $("guestCard");
  if (!card) return;

  if (!state.selectedGuestId) {
    card.innerHTML = `<div class="muted">No guest selected. Click one in the queue.</div>`;
    return;
  }

  const g = state.queue.find(x => x.id === state.selectedGuestId);
  if (!g) {
    state.selectedGuestId = null;
    card.innerHTML = `<div class="muted">No guest selected. Click one in the queue.</div>`;
    return;
  }

  const remaining = Math.max(0, g.expiresAt - Date.now());
  card.innerHTML = `
    <div><strong>${g.face} Guest ${g.id}</strong></div>
    <div class="muted">Mood: ${guestMood(remaining)} • Patience: ${Math.ceil(remaining/1000)}s</div>
    <div style="margin-top:8px;opacity:.85">Click an empty room to assign.</div>
  `;
}

/* ---------- rooms ---------- */
function roomLabel(r) {
  if (r.status === "empty") return "✅ Empty";
  if (r.status === "occupied") return "🟦 Occupied";
  if (r.status === "ready") return r.snackOrdered ? "🛎️ Ready (Snack!)" : "⭐ Ready";
  if (r.status === "dirty") return "🟥 Dirty";
  if (r.status === "cleaning") return "🧽 Cleaning…";
  return r.status;
}

function getRoomById(id) {
  return state.rooms.find(r => r.id === id) || null;
}
function getSelectedRoom() {
  return getRoomById(state.selectedRoomId);
}

function renderRooms() {
  const grid = $("hotelGrid");
  if (!grid) return;
  grid.innerHTML = "";

  state.rooms.forEach((r) => {
    const selected = r.id === state.selectedRoomId;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "roomBtn";
    btn.classList.add("state-" + r.status);
    if (selected) btn.classList.add("selected");

    const badge = r.guestFace ? r.guestFace : "";
    const guestLine = r.guestId ? `Guest ${r.guestId}` : "";
    const stateLine = roomLabel(r);

    btn.innerHTML = `
      <div class="rRow">
        <div class="rTitle">Room ${r.id}</div>
        <div class="rBadge">${badge}</div>
      </div>
      <div class="rState">${stateLine}</div>
      <div class="smallMuted">${guestLine}</div>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // detergent mode
      if (state.tool === "detergent") {
        if (r.status === "dirty") startCleaningRoom(r.id);
        else hint("Detergent ready 🧴 Click a DIRTY room.");
        return;
      }

      // snack delivery mode
      if (state.tool === "deliverSnack" && state.snackHeld) {
        if (r.guestId && r.snackOrdered) deliverSnackToRoom(r.id);
        else hint("Snack ready 🥪 Click a room that needs snack (Snack!).");
        return;
      }

      // guest selected => check in
      if (state.selectedGuestId) {
        if (r.status === "empty") {
          checkInSelectedGuestToRoom(r.id);
          return;
        }
        if (r.status === "dirty") hint("Room is dirty 🧽 Clean it first.");
        else hint("Room not available ❌ Choose an EMPTY room.");
      }

      state.selectedRoomId = r.id;
      renderRooms();
      renderRoomCard();
      save();
    });

    grid.appendChild(btn);
  });
}

function renderRoomCard() {
  const card = $("roomCard");
  if (!card) return;
  const r = getSelectedRoom();
  if (!r) return;

  const guest = r.guestId ? `${r.guestFace} Guest ${r.guestId}` : "No guest";
  const snack = r.snackOrdered ? "🛎️ Snack order pending" : "No snack order";

  card.innerHTML = `
    <div><strong>Room ${r.id}</strong></div>
    <div class="muted">${roomLabel(r)}</div>
    <div style="margin-top:8px">${guest}</div>
    <div style="margin-top:6px;opacity:.9">${snack}</div>
    <div style="margin-top:10px;" class="smallMuted">
      Check-in manual ✅ • Checkout automatic ✅ • Cleaning manual ✅
    </div>
  `;
}

/* ---------- Level Modal ---------- */
function openLevelModal(stars, served, angry, seconds) {
  const modal = $("levelModal");
  if (!modal) return;

  $("modalLevelNo").textContent = String(state.level);
  $("modalServed").textContent = String(served);
  $("modalAngry").textContent = String(angry);
  $("modalTime").textContent = String(seconds);

  const starsWrap = $("modalStars");
  if (starsWrap) {
    starsWrap.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("span");
      s.className = "star";
      s.textContent = i < stars ? "⭐" : "☆";
      starsWrap.appendChild(s);
    }
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeLevelModal() {
  const modal = $("levelModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function computeStars(served, angry, seconds) {
  if (angry === 0 && seconds <= 60) return 3;
  if (angry <= 1 && seconds <= 90) return 2;
  return 1;
}

function resetLevelState() {
  state.served = 0;
  state.angry = 0;
  state.queue = [];
  state.selectedGuestId = null;
  state.tool = null;
  state.snackHeld = false;
  state.snackPreparing = false;
  initRooms();
  levelStartAt = Date.now();
  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();
  save();
}

function levelWin() {
  AUTO.spawn = false;
  const seconds = Math.max(0, Math.round((Date.now() - levelStartAt) / 1000));
  const stars = computeStars(state.served, state.angry, seconds);
  hint(`Level ${state.level} complete ✅`);
  openLevelModal(stars, state.served, state.angry, seconds);
}

function levelFail(reason) {
  hint(`❌ Level failed: ${reason}`);
  AUTO.spawn = false;
  const btn = $("btnAutoSpawn");
  if (btn) btn.textContent = "👤 Auto Spawn: OFF";
}

/* ---------- actions ---------- */
function checkInSelectedGuestToRoom(roomId) {
  const r = getRoomById(roomId);
  if (!r || r.status !== "empty") return;

  const idx = state.queue.findIndex(g => g.id === state.selectedGuestId);
  if (idx === -1) {
    state.selectedGuestId = null;
    renderSelectedGuest();
    renderQueue();
    hint("That guest is gone. Select another guest.");
    return;
  }

  const g = state.queue.splice(idx, 1)[0];

  r.status = "occupied";
  r.guestId = g.id;
  r.guestFace = g.face;
  r.snackOrdered = Math.random() < HOTEL.snackChance;

  const now = Date.now();
  r.readyAt = now + HOTEL.stayMs;

  state.selectedGuestId = null;

  setCoins(getCoins() + HOTEL.checkinCoin);

  hint(`Checked in ${g.face} to Room ${r.id} ✅`);

  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();
  save();
}

function tickQueue() {
  const now = Date.now();
  let left = 0;

  const kept = [];
  for (const g of state.queue) {
    if (g.expiresAt > now) kept.push(g);
    else left++;
  }

  if (left > 0) {
    state.angry += left;

    if (currentFailNoAngry()) levelFail("A guest left angry 😡");

    if (state.selectedGuestId && !kept.some(x => x.id === state.selectedGuestId)) {
      state.selectedGuestId = null;
      renderSelectedGuest();
    }

    hint(`${left} guest(s) left 😡`);
    state.queue = kept;
    updateHud();
    renderQueue();
    save();
  } else {
    renderQueue();
  }
}

function autoCheckoutRoom(r) {
  if (!r.guestId) return;
  if (r.status !== "ready") return;

  state.served += 1;
  setCoins(getCoins() + HOTEL.checkoutCoin);

  if (state.served >= currentGoalGuests()) {
    levelWin();
  }

  r.status = "dirty";
  r.guestId = null;
  r.guestFace = null;
  r.snackOrdered = false;
  r.readyAt = 0;
}

function tickRooms() {
  const now = Date.now();
  let changed = false;
  let didCheckout = 0;

  for (const r of state.rooms) {
    if (r.status === "occupied" && r.readyAt && now >= r.readyAt) {
      r.status = "ready";
      changed = true;
    }

    // ✅ FIXED: uses readyAt always
    if (r.status === "ready" && r.readyAt && now >= r.readyAt + HOTEL.autoCheckoutDelayMs) {
      autoCheckoutRoom(r);
      didCheckout++;
      changed = true;
    }
  }

  if (didCheckout > 0) {
    hint(`${didCheckout} guest(s) checked out ✅ Rooms dirty 🟥`);
  }

  if (changed) {
    updateHud();
    renderRooms();
    renderRoomCard();
    save();
  }
}

/* ---------- snack (prep -> hold -> deliver) ---------- */
function updateSnackButton() {
  const btn = $("btnDeliverSnack");
  if (!btn) return;

  if (state.snackPreparing) {
    btn.textContent = "⏳ Preparing…";
    btn.disabled = true;
    return;
  }
  if (state.snackHeld) {
    btn.textContent = "🥪 Snack Ready";
    btn.disabled = false;
    return;
  }
  btn.textContent = "🛎️ Prep Snack";
  btn.disabled = false;
}

function prepSnack() {
  if (state.snackPreparing) return;

  if (state.snackHeld) {
    state.tool = "deliverSnack";
    hint("Snack ready 🥪 Click a room that needs snack (Snack!).");
    save();
    return;
  }

  state.snackPreparing = true;
  state.tool = null;
  updateSnackButton();
  hint("Preparing snack… 🥪");

  setTimeout(() => {
    state.snackPreparing = false;
    state.snackHeld = true;
    state.tool = "deliverSnack";
    updateSnackButton();
    hint("Snack ready 🥪 Click a room that needs snack!");
    save();
  }, HOTEL.snackPrepMs);
}

function deliverSnackToRoom(roomId) {
  const r = getRoomById(roomId);
  if (!r || !r.guestId || !r.snackOrdered) return;

  r.snackOrdered = false;
  state.snackHeld = false;
  state.tool = null;

  const pay = HOTEL.snackPay + (state.upgrades.bellboy ? 2 : 0);
  setCoins(getCoins() + pay);

  hint(`Snack delivered 😍 +${pay} coins`);
  updateHud();
  renderRooms();
  renderRoomCard();
  updateSnackButton();
  save();
}

/* ---------- cleaning (detergent mode) ---------- */
function cleaningTimeMs() {
  const reduction = state.upgrades.cleaner ? 700 : 0;
  return Math.max(1200, HOTEL.cleanMsBase - reduction);
}

function toggleDetergentMode() {
  if (state.tool === "detergent") {
    state.tool = null;
    hint("Detergent mode OFF.");
  } else {
    state.tool = "detergent";
    hint("Detergent ready 🧴 Click a DIRTY room to clean.");
  }
  save();
}

function startCleaningRoom(roomId) {
  const r = getRoomById(roomId);
  if (!r || r.status !== "dirty") return;

  r.status = "cleaning";
  state.tool = null;
  hint(`Cleaning Room ${r.id}… 🧽`);

  renderRooms();
  renderRoomCard();
  save();

  const ms = cleaningTimeMs();
  setTimeout(() => {
    const rr = getRoomById(roomId);
    if (!rr) return;
    if (rr.status === "cleaning") {
      rr.status = "empty";
      hint(`Room ${rr.id} is clean ✅`);
      renderRooms();
      renderRoomCard();
      save();
    }
  }, ms);
}

/* ---------- spawning ---------- */
function spawnGuest(manual=false) {
  if (state.queue.length >= HOTEL.maxQueue) {
    if (manual) hint("Queue is full ❌");
    return;
  }

  const id = Math.random().toString(16).slice(2, 6).toUpperCase();
  const face = faces[randInt(0, faces.length - 1)];
  const now = Date.now();

  state.queue.push({ id, face, createdAt: now, expiresAt: now + HOTEL.patienceMs });

  if (manual) hint(`New guest arrived ${face} 👤`);
  updateHud();
  renderQueue();
  save();
}

/* ---------- shop ---------- */
function buyUpgrade(which) {
  const coins = getCoins();

  if (which === "cleaner") {
    if (state.upgrades.cleaner) return hint("Cleaner already bought ✅");
    if (coins < 120) return hint("Not enough coins for Cleaner.");
    setCoins(coins - 120);
    state.upgrades.cleaner = 1;
    hint("Cleaner purchased 🧹");
  }

  if (which === "bellboy") {
    if (state.upgrades.bellboy) return hint("Bellboy already bought ✅");
    if (coins < 160) return hint("Not enough coins for Bellboy.");
    setCoins(coins - 160);
    state.upgrades.bellboy = 1;
    hint("Bellboy purchased 🛎️");
  }

  save();
}

/* ---------- reset ---------- */
function resetAll() {
  localStorage.removeItem("mombasaHotel");
  localStorage.removeItem("coins");

  state.level = 1;
  state.served = 0;
  state.angry = 0;
  state.queue = [];
  state.selectedGuestId = null;
  state.upgrades = { cleaner: 0, bellboy: 0 };
  state.tool = null;
  state.snackHeld = false;
  state.snackPreparing = false;

  applyLevelConfig();
  initRooms();
  levelStartAt = Date.now();
  setCoins(0);

  hint("Progress reset ♻️");
  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();
  updateSnackButton();

  AUTO.spawn = true;
  const btn = $("btnAutoSpawn");
  if (btn) btn.textContent = "👤 Auto Spawn: ON";
}

/* =========================
PUZZLE (MATCH-3) background-image tiles (UNCHANGED)
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

function setBoardSizeCSS() {
  const boardEl = $("board");
  if (boardEl) boardEl.style.setProperty("--size", String(PUZZLE.width));
}

function initPuzzle() {
  const boardEl = $("board");
  if (!boardEl) return;

  setBoardSizeCSS();
  boardEl.innerHTML = "";
  pBoard = [];
  pSelected = null;

  const total = PUZZLE.width * PUZZLE.width;

  for (let i = 0; i < total; i++) {
    const tileBtn = document.createElement("button");
    tileBtn.type = "button";
    tileBtn.className = "tile";

    const src = PUZZLE.tiles[randInt(0, PUZZLE.tiles.length - 1)];
    tileBtn.style.backgroundImage = `url("${src}")`;

    tileBtn.addEventListener("click", () => onTileClick(i));

    boardEl.appendChild(tileBtn);
    pBoard.push({ src, el: tileBtn });
  }

  $("msg") && ($("msg").textContent = "Make a match!");
}

function areAdjacent(a, b) {
  const w = PUZZLE.width;
  const ax = a % w, ay = Math.floor(a / w);
  const bx = b % w, by = Math.floor(b / w);
  return (Math.abs(ax - bx) + Math.abs(ay - by)) === 1;
}

function setTileSrc(i, src) {
  pBoard[i].src = src;
  pBoard[i].el.style.backgroundImage = `url("${src}")`;
}

function swapTiles(a, b) {
  const srcA = pBoard[a].src;
  const srcB = pBoard[b].src;
  setTileSrc(a, srcB);
  setTileSrc(b, srcA);
}

function findMatches() {
  const w = PUZZLE.width;
  const matches = new Set();

  for (let r = 0; r < w; r++) {
    let runStart = r * w;
    let runLen = 1;
    for (let c = 1; c < w; c++) {
      const i = r * w + c;
      const prev = r * w + (c - 1);
      if (pBoard[i].src === pBoard[prev].src) runLen++;
      else {
        if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k);
        runStart = i; runLen = 1;
      }
    }
    if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k);
  }

  for (let c = 0; c < w; c++) {
    let runStart = c;
    let runLen = 1;
    for (let r = 1; r < w; r++) {
      const i = r * w + c;
      const prev = (r - 1) * w + c;
      if (pBoard[i].src === pBoard[prev].src) runLen++;
      else {
        if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
        runStart = i; runLen = 1;
      }
    }
    if (runLen >= 3) for (let k = 0; k < runLen; k++) matches.add(runStart + k * w);
  }

  return matches;
}

function crushMatches(matches) {
  const earned = matches.size;
  setCoins(getCoins() + earned);
  $("msg") && ($("msg").textContent = `Crush! +${earned} coins 🪙`);

  matches.forEach(i => pBoard[i].el.classList.add("crush"));

  setTimeout(() => {
    matches.forEach(i => {
      pBoard[i].el.classList.remove("crush");
      const src = PUZZLE.tiles[randInt(0, PUZZLE.tiles.length - 1)];
      setTileSrc(i, src);
    });

    const chain = findMatches();
    if (chain.size > 0) crushMatches(chain);
  }, 230);
}

function onTileClick(i) {
  if (pSelected === null) {
    pSelected = i;
    pBoard[i].el.classList.add("selected");
    return;
  }

  const a = pSelected;
  pBoard[a].el.classList.remove("selected");
  pSelected = null;

  if (a === i) return;
  if (!areAdjacent(a, i)) return;

  swapTiles(a, i);
  const matches = findMatches();

  if (matches.size === 0) {
    swapTiles(a, i);
    pBoard[i].el.classList.add("shake");
    setTimeout(() => pBoard[i].el.classList.remove("shake"), 250);
    return;
  }

  crushMatches(matches);
}

/* ---------- buttons ---------- */
function bindButtons() {
  $("btnSpawnGuest")?.addEventListener("click", () => spawnGuest(true));

  $("btnAutoSpawn")?.addEventListener("click", () => {
    AUTO.spawn = !AUTO.spawn;
    $("btnAutoSpawn").textContent = AUTO.spawn ? "👤 Auto Spawn: ON" : "👤 Auto Spawn: OFF";
    hint(AUTO.spawn ? "Auto spawn ON ✅" : "Auto spawn OFF ⛔");
  });

  $("btnDeliverSnack")?.addEventListener("click", prepSnack);
  $("btnClean")?.addEventListener("click", toggleDetergentMode);

  // hide manual checkout (auto checkout is main rule)
  $("btnCheckout") && ($("btnCheckout").style.display = "none");

  $("buyCleaner")?.addEventListener("click", () => buyUpgrade("cleaner"));
  $("buyBellboy")?.addEventListener("click", () => buyUpgrade("bellboy"));
  $("btnResetMombasa")?.addEventListener("click", resetAll);

  $("resetPuzzle")?.addEventListener("click", initPuzzle);

  // modal buttons
  $("btnRetryLevel")?.addEventListener("click", () => {
    closeLevelModal();
    resetLevelState();
    AUTO.spawn = true;
    hint(`Retry Level ${state.level} 🔁`);
  });

  $("btnNextLevel")?.addEventListener("click", () => {
    closeLevelModal();
    if (state.level < 10) {
      state.level += 1;
      applyLevelConfig();
      resetLevelState();
      AUTO.spawn = true;
      hint(`Level ${state.level} 🎉 Let’s go!`);
    } else {
      hint("Mombasa complete ✅ Next: Amboseli unlock coming next 🐘");
    }
  });
}

/* ---------- boot ---------- */
window.addEventListener("load", () => {
  setCoins(getCoins());
  initTabs();

  const ok = load();
  if (!ok) {
    state.level = 1;
    applyLevelConfig();
    initRooms();
  }

  applyLevelConfig();
  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();
  updateSnackButton();

  bindButtons();

  setInterval(tickQueue, 1000);
  setInterval(tickRooms, 300);

  // dynamic auto-spawn
  let lastSpawn = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (!AUTO.spawn) return;
    if (now - lastSpawn >= HOTEL.spawnEveryMs) {
      spawnGuest(false);
      lastSpawn = now;
    }
  }, 250);

  initPuzzle();
});
