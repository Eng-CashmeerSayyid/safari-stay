// ===============================
// SAFARI STAY – Mombasa Hotel (FULL)
// Auto spawn + patience + moods
// Manual check-in
// Auto checkout -> dirty
// Manual cleaning
// Optional snack requests
// localStorage keys: coins, snacks
// ===============================

// ---------- LocalStorage helpers ----------
function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}
function setCoins(n) {
  localStorage.setItem("coins", String(Math.max(0, Math.floor(n))));
}
function addCoins(n) {
  setCoins(getCoins() + Number(n || 0));
}

function getSnacks() {
  return Number(localStorage.getItem("snacks")) || 0;
}
function setSnacks(n) {
  localStorage.setItem("snacks", String(Math.max(0, Math.floor(n))));
}
function addSnacks(n) {
  setSnacks(getSnacks() + Number(n || 0));
}

// ---------- UI elements ----------
const coinsEl = document.getElementById("coins");
const snacksEl = document.getElementById("snacks");
const servedEl = document.getElementById("served");
const angryEl = document.getElementById("angry");
const queueCountEl = document.getElementById("queueCount");

const queueListEl = document.getElementById("queueList");
const roomsGridEl = document.getElementById("roomsGrid");
const hintEl = document.getElementById("hint");

const resetRunBtn = document.getElementById("resetRunBtn");

// ---------- Game constants (tweak anytime) ----------
const MAX_QUEUE = 6;

// spawn
const SPAWN_EVERY_MS = 8500; // slower = calmer
const SPAWN_JITTER_MS = 2500;

// queue patience
const PATIENCE_TOTAL = 50;     // seconds total patience in queue
const MOOD_IMPATIENT_AT = 0.55; // when timeLeft <= 55% => 😐
const MOOD_ANGRY_AT = 0.25;     // when timeLeft <= 25% => 😡

// room stay
const STAY_MIN = 28; // seconds
const STAY_MAX = 50;

// snack requests (some guests only)
const SNACK_REQUEST_CHANCE = 0.45; // not all guests
const SNACK_GRACE = 18;            // seconds to deliver snack once requested

// cleaning
const CLEAN_TIME = 5; // seconds

// coins
const COINS_CHECKIN = 1;
const COINS_CHECKOUT = 3;
const COINS_SNACK_FAST = 3;
const COINS_SNACK_LATE = 1;

// ---------- State ----------
let served = 0;
let angryLeft = 0;

let queue = []; // guests waiting
let selectedGuestId = null;

let rooms = [
  makeRoom(1),
  makeRoom(2),
  makeRoom(3),
  makeRoom(4),
];

let tickTimer = null;
let spawnTimer = null;

// ---------- Models ----------
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function makeGuest() {
  const names = ["Amina", "Zuri", "Maya", "Imani", "Kato", "Jabari", "Nia", "Tala", "Safi", "Kesi"];
  const name = names[Math.floor(Math.random() * names.length)];
  return {
    id: uid(),
    name,
    patienceLeft: PATIENCE_TOTAL,
    mood: "🙂", // 🙂 😐 😡
    selected: false,
  };
}

function makeRoom(no) {
  return {
    no,
    status: "empty", // empty | occupied | dirty | cleaning
    guest: null,     // guest object when occupied
    stayLeft: 0,
    wantsSnack: false,
    snackLeft: 0,
    snackResolved: true,  // false when requesting
    willRequestSnack: false,
    requestAt: 0,         // seconds into stay to request snack
    cleanLeft: 0,
  };
}

// ---------- Core loop ----------
function start() {
  stop();

  // initial spawn so screen isn't empty
  if (queue.length === 0) {
    for (let i = 0; i < 2; i++) queue.push(makeGuest());
  }

  tickTimer = setInterval(tick, 1000);
  scheduleNextSpawn();
  renderAll();
}

function stop() {
  if (tickTimer) clearInterval(tickTimer);
  if (spawnTimer) clearTimeout(spawnTimer);
  tickTimer = null;
  spawnTimer = null;
}

function scheduleNextSpawn() {
  const delay = SPAWN_EVERY_MS + Math.floor(Math.random() * SPAWN_JITTER_MS);
  spawnTimer = setTimeout(() => {
    spawnGuest();
    scheduleNextSpawn();
  }, delay);
}

function spawnGuest() {
  // only spawn if queue has space and at least one room can eventually accept
  if (queue.length >= MAX_QUEUE) return;

  queue.push(makeGuest());
  renderQueue();
  renderHUD();
}

// ---------- Tick updates ----------
function tick() {
  updateQueueMoods();
  updateRooms();
  renderHUD();
  renderQueue();
  renderRooms();
}

function updateQueueMoods() {
  // patience decreases for everyone in queue
  for (let i = queue.length - 1; i >= 0; i--) {
    const g = queue[i];
    g.patienceLeft -= 1;

    const ratio = g.patienceLeft / PATIENCE_TOTAL;
    if (ratio <= MOOD_ANGRY_AT) g.mood = "😡";
    else if (ratio <= MOOD_IMPATIENT_AT) g.mood = "😐";
    else g.mood = "🙂";

    // if patience finishes -> leaves angry
    if (g.patienceLeft <= 0) {
      // if selected, unselect
      if (selectedGuestId === g.id) selectedGuestId = null;
      queue.splice(i, 1);
      angryLeft += 1;
    }
  }

  // keep selection consistent
  queue.forEach(qg => (qg.selected = (qg.id === selectedGuestId)));
}

function updateRooms() {
  for (const r of rooms) {
    if (r.status === "occupied") {
      r.stayLeft -= 1;

      // handle snack request moment
      if (r.willRequestSnack && r.snackResolved && r.stayLeft > 0) {
        const secondsStayed = (r.guest._stayTotal - r.stayLeft);
        if (secondsStayed >= r.requestAt) {
          r.wantsSnack = true;
          r.snackResolved = false;
          r.snackLeft = SNACK_GRACE;
        }
      }

      // if snack is requested and not resolved, countdown
      if (r.wantsSnack && !r.snackResolved) {
        r.snackLeft -= 1;

        // if snack timer ends -> guest gets angry, may reduce reward
        if (r.snackLeft <= 0) {
          // they "give up" on snack; could ask again later (small chance)
          r.wantsSnack = false;
          r.snackResolved = true;

          // 30% chance they request again after some time
          if (Math.random() < 0.3 && r.stayLeft > 10) {
            r.willRequestSnack = true;
            r.requestAt = (r.guest._stayTotal - r.stayLeft) + 6; // try again in 6s
            r.snackResolved = true;
          }
        }
      }

      // checkout
      if (r.stayLeft <= 0) {
        checkoutRoom(r.no);
      }
    }

    if (r.status === "cleaning") {
      r.cleanLeft -= 1;
      if (r.cleanLeft <= 0) {
        r.status = "empty";
        r.cleanLeft = 0;
      }
    }
  }
}

// ---------- Actions ----------
function selectGuest(id) {
  selectedGuestId = id;
  queue.forEach(g => (g.selected = (g.id === id)));
  hintEl.textContent = "Now click an EMPTY room to check-in.";
  renderQueue();
  renderRooms();
}

function tryCheckIn(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r) return;

  if (!selectedGuestId) {
    hintEl.textContent = "Click a guest first, then click an EMPTY room.";
    return;
  }

  if (r.status !== "empty") {
    hintEl.textContent = "That room is not empty. Choose an EMPTY room.";
    return;
  }

  const idx = queue.findIndex(g => g.id === selectedGuestId);
  if (idx === -1) {
    selectedGuestId = null;
    hintEl.textContent = "Guest not found. Click a guest again.";
    return;
  }

  const guest = queue.splice(idx, 1)[0];
  selectedGuestId = null;

  // set up room stay
  r.status = "occupied";
  r.guest = guest;

  const stay = randInt(STAY_MIN, STAY_MAX);
  r.stayLeft = stay;
  r.guest._stayTotal = stay;

  // snack plan for this guest
  r.willRequestSnack = (Math.random() < SNACK_REQUEST_CHANCE);
  r.snackResolved = true;
  r.wantsSnack = false;
  r.snackLeft = 0;

  if (r.willRequestSnack) {
    // ask sometime after check-in (not immediately)
    r.requestAt = randInt(6, Math.max(7, stay - 8));
  } else {
    r.requestAt = 0;
  }

  addCoins(COINS_CHECKIN);
  hintEl.textContent = "Nice! A guest checked in. Watch for snack requests 🍪.";
  renderAll();
}

function checkoutRoom(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "occupied") return;

  served += 1;

  // base checkout reward
  addCoins(COINS_CHECKOUT);

  // if snack request was active and never resolved, reduce vibe (we won’t subtract coins, just no bonus)
  // (keeps gameplay positive)

  // go dirty
  r.status = "dirty";
  r.guest = null;
  r.stayLeft = 0;

  // reset snack state
  r.wantsSnack = false;
  r.snackLeft = 0;
  r.snackResolved = true;
  r.willRequestSnack = false;
  r.requestAt = 0;

  renderAll();
}

function startCleaning(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "dirty") return;

  r.status = "cleaning";
  r.cleanLeft = CLEAN_TIME;
  renderRooms();
}

function deliverSnack(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "occupied") return;

  if (!r.wantsSnack || r.snackResolved) return;

  const snacks = getSnacks();
  if (snacks <= 0) {
    hintEl.textContent = "No snacks left 😭 Play puzzle to earn snacks, or add snacks from your puzzle rewards.";
    return;
  }

  // consume snack
  setSnacks(snacks - 1);

  // reward based on remaining time
  const deliveredFast = r.snackLeft > Math.floor(SNACK_GRACE * 0.35);
  addCoins(deliveredFast ? COINS_SNACK_FAST : COINS_SNACK_LATE);

  r.wantsSnack = false;
  r.snackResolved = true;

  hintEl.textContent = deliveredFast ? "Snack delivered fast! Bonus coins ✅" : "Snack delivered (late) 😅";
  renderAll();
}

// ---------- Rendering ----------
function renderHUD() {
  coinsEl.textContent = String(getCoins());
  snacksEl.textContent = String(getSnacks());
  servedEl.textContent = String(served);
  angryEl.textContent = String(angryLeft);
  queueCountEl.textContent = String(queue.length);
}

function renderQueue() {
  queueListEl.innerHTML = "";

  if (queue.length === 0) {
    const empty = document.createElement("div");
    empty.className = "smallMuted";
    empty.textContent = "No guests right now. They will spawn automatically…";
    queueListEl.appendChild(empty);
    return;
  }

  queue.forEach((g) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "queueItem" + (g.selected ? " selected" : "");
    card.onclick = () => selectGuest(g.id);

    // patience bar percent
    const pct = Math.max(0, Math.min(100, Math.round((g.patienceLeft / PATIENCE_TOTAL) * 100)));

    card.innerHTML = `
      <div class="rowBetween">
        <div class="qName">${g.mood} ${escapeHtml(g.name)}</div>
        <div class="qTime">${Math.max(0, g.patienceLeft)}s</div>
      </div>
      <div class="bar"><div class="barFill" style="width:${pct}%"></div></div>
      <div class="smallMuted">${g.selected ? "Selected • Click an empty room" : "Click to select"}</div>
    `;
    queueListEl.appendChild(card);
  });
}

function renderRooms() {
  roomsGridEl.innerHTML = "";

  rooms.forEach((r) => {
    const box = document.createElement("div");
    box.className = "roomCard";

    if (r.status === "empty") {
      box.classList.add("clickable");
      box.onclick = () => tryCheckIn(r.no);
      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">EMPTY</div>
        </div>
        <div class="roomBody smallMuted">Click to check-in selected guest</div>
      `;
    }

    if (r.status === "occupied") {
      const snackLine = (r.wantsSnack && !r.snackResolved)
        ? `<div class="snackLine">🍪 Snack needed: <b>${Math.max(0, r.snackLeft)}s</b></div>`
        : `<div class="smallMuted">No snack request right now</div>`;

      const snackBtn = (r.wantsSnack && !r.snackResolved)
        ? `<button class="btn mini" type="button" data-room="${r.no}">Deliver Snack</button>`
        : `<button class="btn mini ghost" type="button" disabled>Deliver Snack</button>`;

      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">OCCUPIED</div>
        </div>

        <div class="roomBody">
          <div class="guestLine">👤 ${escapeHtml(r.guest.name)}</div>
          <div class="smallMuted">Checkout in: <b>${Math.max(0, r.stayLeft)}s</b></div>
          ${snackLine}
          <div class="roomActions">${snackBtn}</div>
        </div>
      `;

      // bind snack button
      const btn = box.querySelector("button[data-room]");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          deliverSnack(r.no);
        });
      }
    }

    if (r.status === "dirty") {
      box.classList.add("dirty");
      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">DIRTY</div>
        </div>
        <div class="roomBody">
          <div class="smallMuted">Needs cleaning before next guest</div>
          <div class="roomActions">
            <button class="btn mini" type="button" data-clean="${r.no}">Clean</button>
          </div>
        </div>
      `;

      const cbtn = box.querySelector("button[data-clean]");
      cbtn.addEventListener("click", () => startCleaning(r.no));
    }

    if (r.status === "cleaning") {
      box.classList.add("cleaning");
      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">CLEANING</div>
        </div>
        <div class="roomBody">
          <div class="smallMuted">Cleaning… <b>${Math.max(0, r.cleanLeft)}s</b></div>
        </div>
      `;
    }

    roomsGridEl.appendChild(box);
  });
}

function renderAll() {
  renderHUD();
  renderQueue();
  renderRooms();
}

// ---------- Reset run (keeps coins/snacks) ----------
resetRunBtn.addEventListener("click", () => {
  // only reset the hotel run counters + state, NOT coins/snacks
  served = 0;
  angryLeft = 0;
  selectedGuestId = null;

  queue = [];
  rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

  hintEl.textContent = "Run reset. Guests will spawn automatically. Click a guest, then an EMPTY room.";
  start();
});

// ---------- utils ----------
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// ---------- boot ----------
start();
