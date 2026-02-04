// ===============================
// SAFARI STAY – mombasa.js (FULL v2)
// Lowercase filenames
// - Auto guest spawn + patience moods (queue)
// - Manual check-in (click guest -> click empty room)
// - SHORTER stay time (Hotel Mania vibe)
// - Auto checkout -> dirty room
// - Manual cleaning
// - Snacks: soda/coconut/sandwich
//   * Sandwich takes 5s to prepare
//   * While waiting, mood drops; if angry -> cancels order
// - Inventory stored in localStorage:
//   snacks_soda, snacks_coconut, snacks_sandwich
//   coins in localStorage: coins
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

// Inventory keys
const INV_KEYS = {
  soda: "snacks_soda",
  coconut: "snacks_coconut",
  sandwich: "snacks_sandwich",
};

function getInv(item) {
  return Number(localStorage.getItem(INV_KEYS[item])) || 0;
}
function setInv(item, n) {
  localStorage.setItem(INV_KEYS[item], String(Math.max(0, Math.floor(n))));
}
function addInv(item, n) {
  setInv(item, getInv(item) + Number(n || 0));
}

// ✅ Initialize stock if user has none (so snacks actually exist)
function ensureInventoryInitialized() {
  const hasAny =
    localStorage.getItem(INV_KEYS.soda) !== null ||
    localStorage.getItem(INV_KEYS.coconut) !== null ||
    localStorage.getItem(INV_KEYS.sandwich) !== null;

  if (!hasAny) {
    // starter stock (tweak anytime)
    setInv("soda", 3);
    setInv("coconut", 3);
    setInv("sandwich", 2);
  }
}

// ---------- UI elements ----------
const coinsEl = document.getElementById("coins");
const snacksEl = document.getElementById("snacks"); // we'll show total of all items here
const servedEl = document.getElementById("served");
const angryEl = document.getElementById("angry");
const queueCountEl = document.getElementById("queueCount");

const queueListEl = document.getElementById("queueList");
const roomsGridEl = document.getElementById("roomsGrid");
const hintEl = document.getElementById("hint");

const resetRunBtn = document.getElementById("resetRunBtn");

// ---------- Game constants ----------
const MAX_QUEUE = 6;

// spawn
const SPAWN_EVERY_MS = 8000;
const SPAWN_JITTER_MS = 2000;

// queue patience (slower, nicer)
const PATIENCE_TOTAL = 50;        // seconds
const MOOD_IMPATIENT_AT = 0.55;   // 😐
const MOOD_ANGRY_AT = 0.25;       // 😡

// ✅ room stay (SHORTER like Hotel Mania)
const STAY_MIN = 12; // seconds
const STAY_MAX = 20;

// snack request chance
const SNACK_REQUEST_CHANCE = 0.55; // some guests (not all)

// snack waiting timer (how long guest tolerates waiting for snack)
const SNACK_WAIT_TOTAL = 18; // seconds until cancel

// sandwich prep time
const SANDWICH_PREP = 5; // seconds

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

let rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

let tickTimer = null;
let spawnTimer = null;

let guestCounter = 0;

// ---------- Models ----------
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ✅ Generic Hotel Mania-style guests (no names)
function makeGuest() {
  guestCounter += 1;
  return {
    id: uid(),
    label: `Guest ${guestCounter}`,
    patienceLeft: PATIENCE_TOTAL,
    mood: "🙂", // queue mood
    selected: false,
  };
}

function makeRoom(no) {
  return {
    no,
    status: "empty", // empty | occupied | dirty | cleaning

    guest: null,
    stayLeft: 0,

    // snack order state
    order: null,          // { item: 'soda'|'coconut'|'sandwich', emoji }
    orderWaitLeft: 0,     // countdown until cancel
    preparing: false,     // sandwich prep in progress
    prepLeft: 0,          // seconds left to prep sandwich

    cleanLeft: 0,
  };
}

function randomSnackItem() {
  const items = [
    { item: "soda", emoji: "🥤" },
    { item: "coconut", emoji: "🥥" },
    { item: "sandwich", emoji: "🥪" },
  ];
  return items[Math.floor(Math.random() * items.length)];
}

// Mood for snack waiting (in-room)
function snackMood(waitLeft) {
  const ratio = waitLeft / SNACK_WAIT_TOTAL;
  if (ratio <= MOOD_ANGRY_AT) return "😡";
  if (ratio <= MOOD_IMPATIENT_AT) return "😐";
  return "🙂";
}

// ---------- Core loop ----------
function start() {
  stop();

  ensureInventoryInitialized();

  // starter queue so it isn't empty
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
  for (let i = queue.length - 1; i >= 0; i--) {
    const g = queue[i];
    g.patienceLeft -= 1;

    const ratio = g.patienceLeft / PATIENCE_TOTAL;
    if (ratio <= MOOD_ANGRY_AT) g.mood = "😡";
    else if (ratio <= MOOD_IMPATIENT_AT) g.mood = "😐";
    else g.mood = "🙂";

    if (g.patienceLeft <= 0) {
      if (selectedGuestId === g.id) selectedGuestId = null;
      queue.splice(i, 1);
      angryLeft += 1;
    }
  }

  queue.forEach(qg => (qg.selected = (qg.id === selectedGuestId)));
}

function updateRooms() {
  for (const r of rooms) {
    if (r.status === "occupied") {
      // stay countdown
      r.stayLeft -= 1;

      // If they have an active order, countdown waiting
      if (r.order) {
        // If preparing sandwich, countdown prep
        if (r.preparing) {
          r.prepLeft -= 1;

          // While preparing, also their wait time ticks
          r.orderWaitLeft -= 1;

          // If becomes angry (wait finished), cancel order immediately
          if (r.orderWaitLeft <= 0) {
            cancelOrder(r, "Guest got angry and canceled the order 😡");
          } else if (r.prepLeft <= 0) {
            // prep done -> auto deliver sandwich (if still waiting)
            completeDelivery(r, true);
          }
        } else {
          // not preparing (soda/coconut waiting)
          r.orderWaitLeft -= 1;
          if (r.orderWaitLeft <= 0) {
            cancelOrder(r, "Guest got angry and canceled the order 😡");
          }
        }
      } else {
        // maybe create a snack request during stay (one order max at a time)
        // chance each second is small; overall about SNACK_REQUEST_CHANCE
        // and not too late in the stay
        const canRequest = r.stayLeft > 5 && r.stayLeft < (r.guest._stayTotal - 3);
        if (canRequest && Math.random() < (SNACK_REQUEST_CHANCE / 18)) {
          r.order = randomSnackItem();
          r.orderWaitLeft = SNACK_WAIT_TOTAL;
          r.preparing = false;
          r.prepLeft = 0;
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

  r.status = "occupied";
  r.guest = guest;

  const stay = randInt(STAY_MIN, STAY_MAX);
  r.stayLeft = stay;
  r.guest._stayTotal = stay;

  // reset snack state
  r.order = null;
  r.orderWaitLeft = 0;
  r.preparing = false;
  r.prepLeft = 0;

  addCoins(COINS_CHECKIN);
  hintEl.textContent = "Checked in! Guests may request snacks 🥤🥥🥪.";
  renderAll();
}

function checkoutRoom(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "occupied") return;

  served += 1;
  addCoins(COINS_CHECKOUT);

  r.status = "dirty";
  r.guest = null;
  r.stayLeft = 0;

  // clear snack order
  r.order = null;
  r.orderWaitLeft = 0;
  r.preparing = false;
  r.prepLeft = 0;

  renderAll();
}

function startCleaning(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "dirty") return;

  r.status = "cleaning";
  r.cleanLeft = CLEAN_TIME;
  renderRooms();
}

// Deliver snack button
function deliverSnack(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r || r.status !== "occupied") return;
  if (!r.order) return;

  const item = r.order.item;

  // Check inventory
  if (getInv(item) <= 0) {
    hintEl.textContent = `No ${item} left 😭 Earn more from puzzle or increase starter stock.`;
    return;
  }

  // Consume inventory
  setInv(item, getInv(item) - 1);

  // Sandwich: start preparing (5s)
  if (item === "sandwich") {
    r.preparing = true;
    r.prepLeft = SANDWICH_PREP;
    hintEl.textContent = "Preparing sandwich… 🥪 (5s)";
    renderAll();
    return;
  }

  // Soda/coconut: instant deliver
  completeDelivery(r, false);
}

// Called when delivery finishes
function completeDelivery(room, wasPrepared) {
  // reward based on how much wait time left
  const deliveredFast = room.orderWaitLeft > Math.floor(SNACK_WAIT_TOTAL * 0.35);
  addCoins(deliveredFast ? COINS_SNACK_FAST : COINS_SNACK_LATE);

  hintEl.textContent = deliveredFast
    ? "Snack delivered fast! Bonus coins ✅"
    : "Snack delivered (late) 😅";

  // clear order
  room.order = null;
  room.orderWaitLeft = 0;
  room.preparing = false;
  room.prepLeft = 0;

  renderAll();
}

function cancelOrder(room, msg) {
  hintEl.textContent = msg;

  // order canceled, do not refund inventory (we only consumed on clicking Deliver)
  room.order = null;
  room.orderWaitLeft = 0;
  room.preparing = false;
  room.prepLeft = 0;

  renderAll();
}

// ---------- Rendering ----------
function totalSnacksCount() {
  return getInv("soda") + getInv("coconut") + getInv("sandwich");
}

function renderHUD() {
  coinsEl.textContent = String(getCoins());
  snacksEl.textContent = String(totalSnacksCount());
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

    const pct = Math.max(0, Math.min(100, Math.round((g.patienceLeft / PATIENCE_TOTAL) * 100)));

    card.innerHTML = `
      <div class="rowBetween">
        <div class="qName">${g.mood} ${escapeHtml(g.label)}</div>
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
      let orderBlock = `<div class="smallMuted">No snack request right now</div>`;
      let btnHtml = `<button class="btn mini ghost" type="button" disabled>Deliver Snack</button>`;

      if (r.order) {
        const mood = snackMood(r.orderWaitLeft);
        const item = r.order.item;
        const emoji = r.order.emoji;

        if (r.preparing) {
          orderBlock = `
            <div class="snackLine">${mood} Preparing ${emoji} ${item}… <b>${Math.max(0, r.prepLeft)}s</b></div>
            <div class="smallMuted">Guest wait: <b>${Math.max(0, r.orderWaitLeft)}s</b></div>
          `;
          btnHtml = `<button class="btn mini ghost" type="button" disabled>Preparing…</button>`;
        } else {
          orderBlock = `
            <div class="snackLine">${mood} Order: ${emoji} <b>${item}</b></div>
            <div class="smallMuted">Wait time left: <b>${Math.max(0, r.orderWaitLeft)}s</b></div>
            <div class="smallMuted">Stock — 🥤${getInv("soda")} • 🥥${getInv("coconut")} • 🥪${getInv("sandwich")}</div>
          `;
          btnHtml = `<button class="btn mini" type="button" data-room="${r.no}">Deliver</button>`;
        }
      }

      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">OCCUPIED</div>
        </div>

        <div class="roomBody">
          <div class="guestLine">👤 ${escapeHtml(r.guest.label)}</div>
          <div class="smallMuted">Checkout in: <b>${Math.max(0, r.stayLeft)}s</b></div>
          ${orderBlock}
          <div class="roomActions">${btnHtml}</div>
        </div>
      `;

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

// ---------- Reset run (keeps coins + inventory) ----------
resetRunBtn.addEventListener("click", () => {
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
