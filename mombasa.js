/* =========================
mombasa.js (AUTO CHECKOUT + MANUAL CLEANING)
- Queue patience slow
- Click guest -> click EMPTY room to check-in
- ✅ Auto checkout after ready
- ❌ Cleaning is manual
- Rooms = 4
- Puzzle uses background-image tiles
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
HOTEL CONFIG
========================= */
const HOTEL = {
  roomCount: 4,
  maxQueue: 6,

  spawnEveryMs: 7000,      // guest arrival speed
  patienceMs: 65000,       // patience total time

  stayMs: 9000,            // time inside room before ready
  autoCheckoutDelayMs: 3500, // ✅ after ready, guest checks out automatically

  cleanMsBase: 2600,       // manual clean duration
  snackChance: 0.35,
  snackTip: 3,

  checkinCoin: 1,
  checkoutCoin: 2,
};

const faces = ["🧑🏾‍🦱","👩🏾‍🦰","🧑🏿‍🦱","👨🏾‍🦲","👩🏿‍🦱","🧑🏾","👨🏿","👩🏾","🧑🏿","👨🏾‍🦱"];
const AUTO = { spawn: true };

let state = {
  served: 0,
  angry: 0,
  queue: [], // {id, face, createdAt, expiresAt}
  rooms: [], // {id, status, guestId, guestFace, snackOrdered, readyAt, checkoutAt}
  selectedRoomId: 1,
  selectedGuestId: null,
  upgrades: { cleaner: 0, bellboy: 0 },
};

function hint(t) { if ($("hint")) $("hint").textContent = t; }

/* ---------- save/load ---------- */
function save() {
  localStorage.setItem("mombasaHotel", JSON.stringify({
    served: state.served,
    angry: state.angry,
    queue: state.queue,
    rooms: state.rooms,
    selectedRoomId: state.selectedRoomId,
    selectedGuestId: state.selectedGuestId,
    upgrades: state.upgrades
  }));
}

function load() {
  try {
    const raw = localStorage.getItem("mombasaHotel");
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.rooms)) return false;
    if (d.rooms.length !== HOTEL.roomCount) return false;

    state.served = Number(d.served) || 0;
    state.angry = Number(d.angry) || 0;
    state.queue = Array.isArray(d.queue) ? d.queue : [];
    state.rooms = d.rooms;
    state.selectedRoomId = Number(d.selectedRoomId) || 1;
    state.selectedGuestId = d.selectedGuestId || null;
    state.upgrades = d.upgrades || state.upgrades;
    return true;
  } catch { return false; }
}

function initRooms() {
  state.rooms = [];
  for (let i = 1; i <= HOTEL.roomCount; i++) {
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
  $("queueCount") && ($("queueCount").textContent = String(state.queue.length));
  $("served") && ($("served").textContent = String(state.served));
  $("angry") && ($("angry").textContent = String(state.angry));
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

      // guest selected => try check-in first
      if (state.selectedGuestId) {
        if (r.status === "empty") {
          checkInSelectedGuestToRoom(r.id);
          return;
        }
        if (r.status === "dirty") hint("Room is dirty 🧽 Clean it first.");
        else hint("Room not available ❌ Choose an EMPTY room.");
      }

      // otherwise select room
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
      Checkout is automatic ✅ (room becomes dirty).
    </div>
  `;
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
  r.checkoutAt = r.readyAt + HOTEL.autoCheckoutDelayMs; // ✅ auto checkout schedule

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
  // ✅ Only auto checkout if ready + has guest
  if (!r.guestId) return;
  if (r.status !== "ready") return;

  state.served += 1;
  setCoins(getCoins() + HOTEL.checkoutCoin);

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
    // occupied -> ready
    if (r.status === "occupied" && r.readyAt && now >= r.readyAt) {
      r.status = "ready";
      changed = true;
    }

    // ready -> auto checkout
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

function deliverSnack() {
  const r = getSelectedRoom();
  if (!r) return;
  if (!r.guestId) return hint("No guest here.");
  if (!r.snackOrdered) return hint("No snack order here.");

  r.snackOrdered = false;
  const bonus = HOTEL.snackTip + (state.upgrades.bellboy ? 2 : 0);
  setCoins(getCoins() + bonus);

  hint(`Snack delivered 😍 +${bonus} coins`);
  updateHud();
  renderRooms();
  renderRoomCard();
  save();
}

/* ✅ Checkout button now optional (manual override) */
function checkout() {
  const r = getSelectedRoom();
  if (!r) return;
  if (!r.guestId) return hint("No guest to checkout.");
  if (r.status !== "ready") return hint("Guest not ready yet ⭐");

  autoCheckoutRoom(r);
  hint(`Manual checkout ✅ Room ${r.id} dirty 🟥`);

  updateHud();
  renderRooms();
  renderRoomCard();
  save();
}

function cleaningTimeMs() {
  const reduction = state.upgrades.cleaner ? 700 : 0;
  return Math.max(1200, HOTEL.cleanMsBase - reduction);
}

function cleanSelected() {
  const r = getSelectedRoom();
  if (!r) return;
  if (r.status !== "dirty") return hint("Room is not dirty.");

  r.status = "cleaning";
  hint(`Cleaning Room ${r.id}… 🧽`);
  renderRooms();
  renderRoomCard();
  save();

  const ms = cleaningTimeMs();
  setTimeout(() => {
    const rr = getRoomById(r.id);
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

function resetAll() {
  localStorage.removeItem("mombasaHotel");
  localStorage.removeItem("coins");

  state.served = 0;
  state.angry = 0;
  state.queue = [];
  state.selectedGuestId = null;
  state.upgrades = { cleaner: 0, bellboy: 0 };

  initRooms();
  setCoins(0);

  hint("Progress reset ♻️");
  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();
}

/* =========================
PUZZLE (MATCH-3) background-image tiles
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

  $("btnDeliverSnack")?.addEventListener("click", deliverSnack);
  $("btnCheckout")?.addEventListener("click", checkout);  // optional manual override
  $("btnClean")?.addEventListener("click", cleanSelected);

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
  if (!ok) initRooms();

  updateHud();
  renderQueue();
  renderSelectedGuest();
  renderRooms();
  renderRoomCard();

  bindButtons();

  setInterval(tickQueue, 1000);
  setInterval(tickRooms, 300); // faster room tick so auto checkout feels smooth

  setInterval(() => {
    if (AUTO.spawn) spawnGuest(false);
  }, HOTEL.spawnEveryMs);

  initPuzzle();
});
