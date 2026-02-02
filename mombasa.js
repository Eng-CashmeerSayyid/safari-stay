/* =========================
mombasa.js (LEVELS + HOTEL MANIA FLOW)
- Manual check-in: click guest -> click EMPTY room
- Auto checkout after ready (always)
- Manual cleaning: click detergent mode -> click dirty room
- Snacks: PREP (time) -> HOLD -> click room to deliver
- Slow patience timers, adjustable per level
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
You can tweak these numbers later.
========================= */
const LEVELS = {
  // region: "mombasa" (levels 1-10)
  1: { goalGuests: 5,  failNoAngry: false, patienceMs: 70000, spawnEveryMs: 8000, snackChance: 0.15 },
  2: { goalGuests: 8,  failNoAngry: false, patienceMs: 68000, spawnEveryMs: 7600, snackChance: 0.20 },
  3: { goalGuests: 10, failNoAngry: false, patienceMs: 65000, spawnEveryMs: 7200, snackChance: 0.25 },
  4: { goalGuests: 10, failNoAngry: false, patienceMs: 65000, spawnEveryMs: 7000, snackChance: 0.35 }, // snacks start
  5: { goalGuests: 12, failNoAngry: false, patienceMs: 63000, spawnEveryMs: 6800, snackChance: 0.40 },
  6: { goalGuests: 12, failNoAngry: true,  patienceMs: 65000, spawnEveryMs: 7200, snackChance: 0.35 }, // no angry
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
(Level overrides will apply)
========================= */
const HOTEL_BASE = {
  roomCount: 4,
  maxQueue: 6,

  // these get overridden per level
  spawnEveryMs: 7000,
  patienceMs: 65000,
  snackChance: 0.35,

  // core timings
  stayMs: 9000,              // time inside room before "ready"
  autoCheckoutDelayMs: 3500, // after ready, auto checkout

  cleanMsBase: 2600,         // cleaning duration
  snackPrepMs: 2200,         // PREP snack duration (hold in hand)

  // money rules
  checkinCoin: 2,
  checkoutCoin: 3,
  snackPay: 4,               // paid when snack delivered
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];
const AUTO = { spawn: true };

let state = {
  level: 1,
  served: 0,
  angry: 0,
  queue: [], // {id, face, createdAt, expiresAt}
  rooms: [], // {id, status, guestId, guestFace, snackOrdered, readyAt, checkoutAt}

  selectedRoomId: 1,
  selectedGuestId: null,

  upgrades: { cleaner: 0, bellboy: 0 },

  // “Hotel Mania” tools / hands (simple version)
  tool: null,           // null | "detergent" | "deliverSnack"
  snackHeld: false,     // prepared snack in hand
  snackPreparing: false // prep timer running
};

let HOTEL = { ...HOTEL_BASE }; // active config for the current level

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
  const cfg = LEVELS[state.level] || LEVELS[1];
  return cfg.goalGuests;
}
function currentFailNoAngry() {
  const cfg = LEVELS[state.level] || LEVELS[1];
  return !!cfg.failNoAngry;
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
    state.snackHeld = !!d.snackHeld;
    state.tool = null;
    state.snackPreparing = false;

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
      readyAt: 0,
      checkoutAt: 0
    });
  }
  state.selectedRoomId = 1;
}

/* ---------- HUD ---------- */
function updateHud() {
  if ($("queueCount")) $("queueCount").textContent = String(state.queue.length);
  if ($("served")) $("served").textContent = String(state.served);
  if ($("angry")) $("angry").textContent = String(state.angry);

  // update level text if exists
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

      // 1) If detergent tool active -> clean dirty room
      if (state.tool === "detergent") {
        if (r.status === "dirty") {
          startCleaningRoom(r.id);
        } else {
          hint("Detergent is ready 🧴 Click a DIRTY room.");
        }
        return;
      }

      // 2) If we have snack held -> deliver to snack room
      if (state.tool === "deliverSnack" && state.snackHeld) {
        if (r.guestId && r.snackOrdered) {
          deliverSnackToRoom(r.id);
        } else {
          hint("Snack ready 🥪 Click a room that says (Snack!).");
        }
        return;
      }

      // 3) guest selected => try check-in first
      if (state.selectedGuestId) {
        if (r.status === "empty") {
          checkInSelectedGuestToRoom(r.id);
          return;
        }
        if (r.status === "dirty") hint("Room is dirty 🧽 Clean it first.");
        else hint("Room not available ❌ Choose an EMPTY room.");
      }

      // 4) otherwise select room
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
      Check-in is manual ✅ • Checkout is automatic ✅ • Cleaning is manual ✅
    </div>
  `;
}

/* ---------- level win/lose ---------- */
function levelWin() {
  hint(`Level ${state.level} complete ✅`);
  // move to next level (cap at 10 for Mombasa)
  if (state.level < 10) {
    state.level += 1;
    applyLevelConfig();
    save();
    hint(`Level up! Now Level ${state.level} 🎉`);
  } else {
    hint("Mombasa complete ✅ Next region: Amboseli (coming next) 🐘");
  }
}
function levelFail(reason) {
  hint(`❌ Level failed: ${reason}`);
  // simple fail behavior: stop auto spawn until reset
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
  r.checkoutAt = r.readyAt + HOTEL.autoCheckoutDelayMs;

  state.selectedGuestId = null;

  // coins for check-in
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

    // fail rule: no angry guests
    if (currentFailNoAngry()) {
      levelFail("A guest left angry 😡");
    }

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

  // guest served
  state.served += 1;

  // coins for checkout
  setCoins(getCoins() + HOTEL.checkoutCoin);

  // level goal check
  if (state.served >= currentGoalGuests()) {
    levelWin();
  }

  r.status = "dirty";
  r.guestId = null;
  r.guestFace = null;
  r.snackOrdered = false;
  r.readyAt = 0;
  r.checkoutAt = 0;
}

function tickRooms() {
  const now = Date.now();
  let changed = false;
  let didCheckout = 0;

  for (const r of state.rooms) {
    if (r.status === "ready" && r.readyAt && now >= r.readyAt + HOTEL.autoCheckoutDelayMs) {

      r.status = "ready";
      changed = true;
    }

    if (r.status === "ready" && r.checkoutAt && now >= r.checkoutAt) {
      autoCheckoutRoom(r);
      didCheckout++;
      changed = true;
    }
  }

  if (didCheckout > 0) {
    hint(`${didCheckout} guest(s) checked out automatically ✅ Room(s) dirty 🟥`);
  }

  if (changed) {
    updateHud();
    renderRooms();
    renderRoomCard();
    save();
  }
}

/* ---------- snack system (prep -> hold -> click room) ---------- */
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
    // toggle into deliver mode
    state.tool = "deliverSnack";
    hint("Snack ready 🥪 Now click a room that needs snack (Snack!).");
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

/* ---------- cleaning system (detergent mode -> click dirty room) ---------- */
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

  // repurposed:
  $("btnDeliverSnack")?.addEventListener("click", prepSnack);
  $("btnClean")?.addEventListener("click", toggleDetergentMode);

  // checkout button is optional now — auto checkout is the main rule
  // You can hide it in CSS if you want.
  $("btnCheckout") && ($("btnCheckout").style.display = "none");

  $("buyCleaner")?.addEventListener("click", () => buyUpgrade("cleaner"));
  $("buyBellboy")?.addEventListener("click", () => buyUpgrade("bellboy"));
  $("btnResetMombasa")?.addEventListener("click", resetAll);

  $("resetPuzzle")?.addEventListener("click", initPuzzle);
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

  setInterval(() => {
    if (AUTO.spawn) spawnGuest(false);
  }, () => HOTEL.spawnEveryMs);

  // NOTE: setInterval cannot take a function delay; use a fixed interval and check time.
  // We’ll implement it properly:
});

/* ---------- proper auto-spawn loop (dynamic spawnEveryMs per level) ---------- */
let _lastSpawn = 0;
setInterval(() => {
  const now = Date.now();
  if (!_lastSpawn) _lastSpawn = now;

  if (!AUTO.spawn) return;
  if (now - _lastSpawn >= HOTEL.spawnEveryMs) {
    spawnGuest(false);
    _lastSpawn = now;
  }
}, 250);

/* ---------- init puzzle after load ---------- */
window.addEventListener("load", () => {
  initPuzzle();
});

