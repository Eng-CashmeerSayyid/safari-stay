// ===============================
// SAFARI STAY – mombasa.js (FULL v6)
// - Pick snacks ANYTIME at Snack Bar (pre-carry)
// - Sandwich preps 5s WHILE in hand
// - Guest orders are scheduled (guaranteed chance)
// - Delivery is MANUAL (2 taps on room to confirm)
// - Cleaning is manual: pick detergent -> click dirty room
// - Bellboy has 2 hands; Level 2+ disables dropping
// ===============================

/* ---------- LEVEL CONTROL ---------- */
const LEVEL = 1; // set to 2 later to DISABLE dropping items

/* ---------- LocalStorage helpers ---------- */
function getCoins() { return Number(localStorage.getItem("coins")) || 0; }
function setCoins(n) { localStorage.setItem("coins", String(Math.max(0, Math.floor(n)))); }
function addCoins(n) { setCoins(getCoins() + Number(n || 0)); }

/* ---------- Inventory ---------- */
const INV_KEYS = {
  soda: "snacks_soda",
  coconut: "snacks_coconut",
  sandwich: "snacks_sandwich",
};
function getInv(item) { return Number(localStorage.getItem(INV_KEYS[item])) || 0; }
function setInv(item, n) { localStorage.setItem(INV_KEYS[item], String(Math.max(0, Math.floor(n)))); }

function ensureInventoryInitialized() {
  const hasAny =
    localStorage.getItem(INV_KEYS.soda) !== null ||
    localStorage.getItem(INV_KEYS.coconut) !== null ||
    localStorage.getItem(INV_KEYS.sandwich) !== null;

  if (!hasAny) {
    setInv("soda", 3);
    setInv("coconut", 3);
    setInv("sandwich", 2);
  }
}
function totalSnacksCount() {
  return getInv("soda") + getInv("coconut") + getInv("sandwich");
}

/* ---------- UI elements ---------- */
const coinsEl = document.getElementById("coins");
const snacksEl = document.getElementById("snacks");
const servedEl = document.getElementById("served");
const angryEl = document.getElementById("angry");
const queueCountEl = document.getElementById("queueCount");

const queueListEl = document.getElementById("queueList");
const roomsGridEl = document.getElementById("roomsGrid");
const hintEl = document.getElementById("hint");
const resetRunBtn = document.getElementById("resetRunBtn");

// Stations
const snackStationBtn = document.getElementById("snackStation");
const cleanToolBtn = document.getElementById("cleanTool");
const stockLineEl = document.getElementById("stockLine");

// Carry HUD
const handLEl = document.getElementById("handL");
const handREl = document.getElementById("handR");
const dropRowEl = document.getElementById("dropRow");
const dropLBtn = document.getElementById("dropL");
const dropRBtn = document.getElementById("dropR");

/* ---------- Game constants ---------- */
const MAX_QUEUE = 6;
const SPAWN_EVERY_MS = 8000;
const SPAWN_JITTER_MS = 2000;

const PATIENCE_TOTAL = 50;
const MOOD_IMPATIENT_AT = 0.55;
const MOOD_ANGRY_AT = 0.25;

const STAY_MIN = 12;
const STAY_MAX = 20;

// Snack system
const SNACK_REQUEST_CHANCE = 0.65;
const SNACK_WAIT_TOTAL = 18;
const SANDWICH_PREP = 5;

// Cleaning
const CLEAN_TIME = 5;

// Coins
const COINS_CHECKIN = 1;
const COINS_CHECKOUT = 3;
const COINS_SNACK_FAST = 3;
const COINS_SNACK_LATE = 1;

/* ---------- State ---------- */
let served = 0;
let angryLeft = 0;

let queue = [];
let selectedGuestId = null;

let rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

let tickTimer = null;
let spawnTimer = null;

let guestCounter = 0;

// Manual delivery confirmation: click room twice
let pendingDeliveryRoom = null;

/* ---------- Bellboy two-hand carry ---------- */
// Each hand can hold:
// null
// { type:'detergent' }
// { type:'snack', item, emoji, ready:true|false, prepLeft }
let handL = null;
let handR = null;

/* ---------- Snack Bar pick cycles ---------- */
const SNACK_CYCLE = ["soda", "coconut", "sandwich"];
const SNACK_EMOJI = { soda: "🥤", coconut: "🥥", sandwich: "🥪" };
let cycleIndex = 0;

/* ---------- Helpers for hands ---------- */
function hasFreeHand() { return !handL || !handR; }
function putInFreeHand(obj) {
  if (!handL) { handL = obj; return "L"; }
  if (!handR) { handR = obj; return "R"; }
  return null;
}
function clearHand(which) {
  if (which === "L") handL = null;
  if (which === "R") handR = null;
}
function findHandWithSnack(item) {
  if (handL && handL.type === "snack" && handL.item === item) return "L";
  if (handR && handR.type === "snack" && handR.item === item) return "R";
  return null;
}
function findHandWithDetergent() {
  if (handL && handL.type === "detergent") return "L";
  if (handR && handR.type === "detergent") return "R";
  return null;
}
function describeHand(h) {
  if (!h) return "Empty";
  if (h.type === "detergent") return "🧴 Detergent";
  if (h.type === "snack") {
    if (h.item === "sandwich" && !h.ready) return `🥪 Sandwich… (${Math.max(0, h.prepLeft)}s)`;
    return `${h.emoji} ${h.item}`;
  }
  return "Empty";
}
function renderHands() {
  handLEl.textContent = describeHand(handL);
  handREl.textContent = describeHand(handR);
  dropRowEl.style.display = (LEVEL >= 2) ? "none" : "flex";
}

/* ---------- Models ---------- */
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function makeGuest() {
  guestCounter += 1;
  return { id: uid(), label: `Guest ${guestCounter}`, patienceLeft: PATIENCE_TOTAL, mood: "🙂", selected: false };
}

function makeRoom(no) {
  return {
    no,
    status: "empty", // empty | occupied | dirty | cleaning
    guest: null,
    stayLeft: 0,
    stayTotal: 0,

    willRequestSnack: false,
    requestAt: 0,
    requested: false,

    order: null,        // { item, emoji }
    orderWaitLeft: 0,

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

function snackMood(waitLeft) {
  const ratio = waitLeft / SNACK_WAIT_TOTAL;
  if (ratio <= MOOD_ANGRY_AT) return "😡";
  if (ratio <= MOOD_IMPATIENT_AT) return "😐";
  return "🙂";
}

/* ---------- Core loop ---------- */
function start() {
  stop();
  ensureInventoryInitialized();
  if (queue.length === 0) for (let i = 0; i < 2; i++) queue.push(makeGuest());
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
    if (queue.length < MAX_QUEUE) queue.push(makeGuest());
    renderQueue(); renderHUD();
    scheduleNextSpawn();
  }, delay);
}

/* ---------- Tick ---------- */
function tick() {
  updateQueueMoods();
  updateHandsPrep();
  updateRooms();
  renderHUD();
  renderQueue();
  renderRooms();
  renderHands();
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

// sandwich prep while carrying
function updateHandsPrep() {
  for (const which of ["L", "R"]) {
    const h = (which === "L") ? handL : handR;
    if (h && h.type === "snack" && h.item === "sandwich" && !h.ready) {
      h.prepLeft -= 1;
      if (h.prepLeft <= 0) {
        h.ready = true;
        h.prepLeft = 0;
        hintEl.textContent = "🥪 Sandwich ready!";
      }
    }
  }
}

function updateRooms() {
  for (const r of rooms) {
    if (r.status === "occupied") {
      r.stayLeft -= 1;

      // schedule snack request
      if (r.willRequestSnack && !r.requested && !r.order) {
        const secondsStayed = r.stayTotal - r.stayLeft;
        if (secondsStayed >= r.requestAt) {
          r.order = randomSnackItem();
          r.orderWaitLeft = SNACK_WAIT_TOTAL;
          r.requested = true;
        }
      }

      // order countdown + cancel
      if (r.order) {
        r.orderWaitLeft -= 1;
        if (r.orderWaitLeft <= 0) {
          cancelOrder(r, "Guest got angry and canceled the order 😡");
        }
      }

      // checkout
      if (r.stayLeft <= 0) checkoutRoom(r.no);
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

/* ---------- Actions ---------- */
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

  if (!selectedGuestId) { hintEl.textContent = "Click a guest first, then click an EMPTY room."; return; }
  if (r.status !== "empty") { hintEl.textContent = "That room is not empty. Choose an EMPTY room."; return; }

  const idx = queue.findIndex(g => g.id === selectedGuestId);
  if (idx === -1) { selectedGuestId = null; hintEl.textContent = "Guest not found. Click a guest again."; return; }

  const guest = queue.splice(idx, 1)[0];
  selectedGuestId = null;

  r.status = "occupied";
  r.guest = guest;

  const stay = randInt(STAY_MIN, STAY_MAX);
  r.stayLeft = stay;
  r.stayTotal = stay;

  r.willRequestSnack = (Math.random() < SNACK_REQUEST_CHANCE);
  r.requested = false;
  r.requestAt = r.willRequestSnack ? randInt(4, Math.max(5, stay - 5)) : 0;

  r.order = null;
  r.orderWaitLeft = 0;

  pendingDeliveryRoom = null;

  addCoins(COINS_CHECKIN);
  hintEl.textContent = "Checked in! You can pre-pick snacks at 🍹 Snack Bar.";
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

  r.order = null;
  r.orderWaitLeft = 0;

  pendingDeliveryRoom = null;

  renderAll();
}

/* ---------- Stations ---------- */

// pick detergent into free hand
cleanToolBtn?.addEventListener("click", () => {
  if (!hasFreeHand()) { hintEl.textContent = "Hands full 😅"; return; }
  const placed = putInFreeHand({ type: "detergent" });
  hintEl.textContent = `Picked 🧴 in hand ${placed}. Click a DIRTY room.`;
  renderHands();
});

// pick snacks anytime (pre-carry)
snackStationBtn?.addEventListener("click", () => {
  if (!hasFreeHand()) { hintEl.textContent = "Hands full 😅"; return; }

  // pick next snack in cycle that has stock
  let tries = 0;
  let chosen = null;
  while (tries < SNACK_CYCLE.length) {
    const item = SNACK_CYCLE[cycleIndex % SNACK_CYCLE.length];
    cycleIndex++;
    tries++;
    if (getInv(item) > 0) { chosen = item; break; }
  }
  if (!chosen) { hintEl.textContent = "No snacks in stock 😭"; return; }

  // consume stock now (picked)
  setInv(chosen, getInv(chosen) - 1);

  let obj;
  if (chosen === "sandwich") {
    obj = { type: "snack", item: "sandwich", emoji: "🥪", ready: false, prepLeft: SANDWICH_PREP };
    hintEl.textContent = "🥪 Making sandwich… (5s) — it will be ready in your hand.";
  } else {
    obj = { type: "snack", item: chosen, emoji: SNACK_EMOJI[chosen], ready: true, prepLeft: 0 };
    hintEl.textContent = `Picked ${SNACK_EMOJI[chosen]} ${chosen} into your hand.`;
  }

  const placed = putInFreeHand(obj);
  if (!placed) {
    // refund if no hand (safety)
    setInv(chosen, getInv(chosen) + 1);
    hintEl.textContent = "Hands full 😅";
    return;
  }

  renderAll();
});

/* ---------- Room clicks ---------- */
function handleRoomClick(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r) return;

  // If you click a different room, clear pending delivery
  if (pendingDeliveryRoom !== null && pendingDeliveryRoom !== r.no) {
    pendingDeliveryRoom = null;
  }

  // 1) Cleaning: detergent + dirty room
  if (r.status === "dirty") {
    const detHand = findHandWithDetergent();
    if (!detHand) { hintEl.textContent = "Pick 🧴 Detergent first, then click the dirty room."; return; }

    r.status = "cleaning";
    r.cleanLeft = CLEAN_TIME;
    hintEl.textContent = `Cleaning Room ${roomNo}… (${CLEAN_TIME}s)`;

    clearHand(detHand);
    pendingDeliveryRoom = null;
    renderAll();
    return;
  }

  // 2) Manual snack delivery: 2 taps to confirm
  if (r.status === "occupied" && r.order) {
    const needed = r.order.item;
    const snackHand = findHandWithSnack(needed);

    if (!snackHand) {
      hintEl.textContent = `Need ${r.order.emoji} ${needed}. Pick it at 🍹 Snack Bar first.`;
      pendingDeliveryRoom = null;
      renderAll();
      return;
    }

    const h = (snackHand === "L") ? handL : handR;
    if (needed === "sandwich" && h && !h.ready) {
      hintEl.textContent = "🥪 Sandwich is still being made… wait!";
      pendingDeliveryRoom = null;
      renderAll();
      return;
    }

    // First tap arms delivery
    if (pendingDeliveryRoom !== r.no) {
      pendingDeliveryRoom = r.no;
      hintEl.textContent = "Tap the room again to DELIVER 🫴";
      renderAll();
      return;
    }

    // Second tap confirms delivery
    deliverSnackToRoom(r);
    clearHand(snackHand);
    pendingDeliveryRoom = null;
    renderAll();
    return;
  }

  // 3) Check-in for empty rooms
  if (r.status === "empty") {
    pendingDeliveryRoom = null;
    tryCheckIn(roomNo);
    return;
  }

  hintEl.textContent = "Nothing to do here right now.";
}

function deliverSnackToRoom(room) {
  const deliveredFast = room.orderWaitLeft > Math.floor(SNACK_WAIT_TOTAL * 0.35);
  addCoins(deliveredFast ? COINS_SNACK_FAST : COINS_SNACK_LATE);

  hintEl.textContent = deliveredFast ? "Snack delivered fast! Bonus ✅" : "Snack delivered (late) 😅";

  room.order = null;
  room.orderWaitLeft = 0;
}

function cancelOrder(room, msg) {
  hintEl.textContent = msg;
  room.order = null;
  room.orderWaitLeft = 0;
  pendingDeliveryRoom = null;
  renderAll();
}

/* ---------- Rendering ---------- */
function renderHUD() {
  coinsEl.textContent = String(getCoins());
  snacksEl.textContent = String(totalSnacksCount());
  servedEl.textContent = String(served);
  angryEl.textContent = String(angryLeft);
  queueCountEl.textContent = String(queue.length);

  if (stockLineEl) {
    stockLineEl.textContent = `🥤${getInv("soda")} 🥥${getInv("coconut")} 🥪${getInv("sandwich")}`;
  }
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

    // pending delivery highlight
    if (pendingDeliveryRoom === r.no) box.classList.add("pending");

    if (r.status === "empty") {
      box.classList.add("clickable");
      box.onclick = () => handleRoomClick(r.no);
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

      if (r.order) {
        const mood = snackMood(r.orderWaitLeft);
        orderBlock = `
          <div class="snackLine">${mood} Order: ${r.order.emoji} <b>${r.order.item}</b></div>
          <div class="smallMuted">Wait left: <b>${Math.max(0, r.orderWaitLeft)}s</b></div>
          <div class="smallMuted">Carry it, then tap room twice to deliver.</div>
        `;
      }

      box.onclick = () => handleRoomClick(r.no);
      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">OCCUPIED</div>
        </div>
        <div class="roomBody">
          <div class="guestLine">👤 ${escapeHtml(r.guest.label)}</div>
          <div class="smallMuted">Checkout in: <b>${Math.max(0, r.stayLeft)}s</b></div>
          ${orderBlock}
        </div>
      `;
    }

    if (r.status === "dirty") {
      box.classList.add("dirty");
      box.onclick = () => handleRoomClick(r.no);
      box.innerHTML = `
        <div class="rowBetween">
          <div class="roomTitle">Room ${r.no}</div>
          <div class="roomState">DIRTY</div>
        </div>
        <div class="roomBody">
          <div class="smallMuted">Pick 🧴 Detergent, then click room.</div>
        </div>
      `;
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
  renderHands();
}

/* ---------- Drop buttons (Level 1 only) ---------- */
dropLBtn?.addEventListener("click", () => { if (LEVEL >= 2) return; handL = null; pendingDeliveryRoom = null; renderAll(); });
dropRBtn?.addEventListener("click", () => { if (LEVEL >= 2) return; handR = null; pendingDeliveryRoom = null; renderAll(); });

/* ---------- Reset Run ---------- */
resetRunBtn.addEventListener("click", () => {
  served = 0;
  angryLeft = 0;
  selectedGuestId = null;

  queue = [];
  rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

  handL = null;
  handR = null;
  pendingDeliveryRoom = null;

  hintEl.textContent = "Run reset. Guests will spawn automatically. Click guest → empty room.";
  start();
});

/* ---------- utils ---------- */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));
}

/* ---------- boot ---------- */
start();
