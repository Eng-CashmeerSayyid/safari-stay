// ===============================
// SAFARI STAY – mombasa.js (FULL v3 TOOL-BASED)
// - Snack: click room with order to PICK -> click Snack Bar to SERVE
// - Cleaning: click Detergent -> click dirty room to clean
// Lowercase filenames
// ===============================

// ---------- LocalStorage helpers ----------
function getCoins() { return Number(localStorage.getItem("coins")) || 0; }
function setCoins(n) { localStorage.setItem("coins", String(Math.max(0, Math.floor(n)))); }
function addCoins(n) { setCoins(getCoins() + Number(n || 0)); }

// Inventory keys
const INV_KEYS = {
  soda: "snacks_soda",
  coconut: "snacks_coconut",
  sandwich: "snacks_sandwich",
};
function getInv(item) { return Number(localStorage.getItem(INV_KEYS[item])) || 0; }
function setInv(item, n) { localStorage.setItem(INV_KEYS[item], String(Math.max(0, Math.floor(n)))); }

// starter stock if none
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

// Stations UI
const snackStationBtn = document.getElementById("snackStation");
const cleanToolBtn = document.getElementById("cleanTool");
const holdingEl = document.getElementById("holding");
const stockLineEl = document.getElementById("stockLine");

// ---------- Game constants ----------
const MAX_QUEUE = 6;
const SPAWN_EVERY_MS = 8000;
const SPAWN_JITTER_MS = 2000;

const PATIENCE_TOTAL = 50;
const MOOD_IMPATIENT_AT = 0.55;
const MOOD_ANGRY_AT = 0.25;

// stay time (Hotel Mania vibe)
const STAY_MIN = 12;
const STAY_MAX = 20;

// snack
const SNACK_REQUEST_CHANCE = 0.55;
const SNACK_WAIT_TOTAL = 18;
const SANDWICH_PREP = 5;

// cleaning
const CLEAN_TIME = 5;

// coins
const COINS_CHECKIN = 1;
const COINS_CHECKOUT = 3;
const COINS_SNACK_FAST = 3;
const COINS_SNACK_LATE = 1;

// ---------- State ----------
let served = 0;
let angryLeft = 0;

let queue = [];
let selectedGuestId = null;

let rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

let tickTimer = null;
let spawnTimer = null;

let guestCounter = 0;

// Tool / interaction state
let holding = "none"; // none | detergent | order
let heldOrder = null; // { roomNo, item, emoji }

// ---------- Models ----------
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

    // snack order state (in-room)
    order: null,          // { item, emoji }
    orderWaitLeft: 0,     // time before cancel
    preparing: false,     // sandwich prep active
    prepLeft: 0,          // seconds left in prep

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

function totalSnacksCount() {
  return getInv("soda") + getInv("coconut") + getInv("sandwich");
}

function setHolding(newHolding, orderObj = null) {
  holding = newHolding;
  heldOrder = orderObj;

  // UI
  snackStationBtn?.classList.toggle("active", holding === "order");
  cleanToolBtn?.classList.toggle("active", holding === "detergent");

  if (holding === "detergent") holdingEl.textContent = "🧴 Detergent";
  else if (holding === "order" && heldOrder) holdingEl.textContent = `${heldOrder.emoji} ${heldOrder.item} (from Room ${heldOrder.roomNo})`;
  else holdingEl.textContent = "None";
}

// ---------- Core loop ----------
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

// ---------- Tick ----------
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
      r.stayLeft -= 1;

      // snack order ticking
      if (r.order) {
        // if preparing sandwich, run prep timer too
        if (r.preparing) {
          r.prepLeft -= 1;
        }

        r.orderWaitLeft -= 1;

        // cancel if angry
        if (r.orderWaitLeft <= 0) {
          cancelOrder(r, "Guest got angry and canceled the order 😡");
        }

        // finish sandwich prep automatically ONLY AFTER you started it at snack bar
        if (r.preparing && r.prepLeft <= 0 && r.order) {
          // prep done -> deliver
          completeDelivery(r);
        }
      } else {
        // maybe request snack (one at a time)
        const canRequest = r.stayLeft > 5 && r.stayLeft < (r.guest._stayTotal - 3);
        if (canRequest && Math.random() < (SNACK_REQUEST_CHANCE / 18)) {
          r.order = randomSnackItem();
          r.orderWaitLeft = SNACK_WAIT_TOTAL;
          r.preparing = false;
          r.prepLeft = 0;
        }
      }

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
  r.guest._stayTotal = stay;

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

  r.order = null;
  r.orderWaitLeft = 0;
  r.preparing = false;
  r.prepLeft = 0;

  // if you were holding an order from this room, drop it
  if (holding === "order" && heldOrder && heldOrder.roomNo === roomNo) {
    setHolding("none", null);
  }

  renderAll();
}

// TOOL: click detergent
cleanToolBtn?.addEventListener("click", () => {
  setHolding(holding === "detergent" ? "none" : "detergent", null);
  hintEl.textContent = holding === "detergent"
    ? "Holding detergent. Click a DIRTY room to clean."
    : "Tool cleared.";
});

// TOOL: click snack bar (serve held order)
snackStationBtn?.addEventListener("click", () => {
  if (holding !== "order" || !heldOrder) {
    hintEl.textContent = "Pick an order first: click a room with an order.";
    return;
  }

  const r = rooms.find(x => x.no === heldOrder.roomNo);
  if (!r || r.status !== "occupied" || !r.order) {
    hintEl.textContent = "That order is gone. Pick another order.";
    setHolding("none", null);
    renderAll();
    return;
  }

  const item = r.order.item;

  if (getInv(item) <= 0) {
    hintEl.textContent = `No ${item} left 😭`;
    setHolding("none", null);
    renderAll();
    return;
  }

  // consume inventory at snack bar time
  setInv(item, getInv(item) - 1);

  if (item === "sandwich") {
    // start preparing; delivery completes after 5s while guest wait keeps counting
    r.preparing = true;
    r.prepLeft = SANDWICH_PREP;
    hintEl.textContent = "Sandwich started… 🥪 (5s). Guest is waiting!";
  } else {
    // instant deliver
    completeDelivery(r);
  }

  setHolding("none", null);
  renderAll();
});

// Click a room: handle tool interactions + check-in + picking order
function handleRoomClick(roomNo) {
  const r = rooms.find(x => x.no === roomNo);
  if (!r) return;

  // If holding detergent, click dirty room to start cleaning
  if (holding === "detergent") {
    if (r.status !== "dirty") {
      hintEl.textContent = "Detergent can only be used on a DIRTY room.";
      return;
    }
    r.status = "cleaning";
    r.cleanLeft = CLEAN_TIME;
    hintEl.textContent = `Cleaning Room ${roomNo}… (${CLEAN_TIME}s)`;
    setHolding("none", null);
    renderAll();
    return;
  }

  // If occupied and has an order -> pick the order (hold it), then go to snack bar
  if (r.status === "occupied" && r.order && !r.preparing) {
    setHolding("order", { roomNo: r.no, item: r.order.item, emoji: r.order.emoji });
    hintEl.textContent = `Picked order from Room ${roomNo}. Now click 🍹 Snack Bar to serve.`;
    renderRooms();
    return;
  }

  // Normal check-in flow for empty rooms
  if (r.status === "empty") {
    tryCheckIn(roomNo);
    return;
  }

  // Otherwise do nothing
  hintEl.textContent = "Nothing to do here right now.";
}

// delivery finish
function completeDelivery(room) {
  const deliveredFast = room.orderWaitLeft > Math.floor(SNACK_WAIT_TOTAL * 0.35);
  addCoins(deliveredFast ? COINS_SNACK_FAST : COINS_SNACK_LATE);

  hintEl.textContent = deliveredFast ? "Snack delivered fast! Bonus ✅" : "Snack delivered (late) 😅";

  room.order = null;
  room.orderWaitLeft = 0;
  room.preparing = false;
  room.prepLeft = 0;
}

function cancelOrder(room, msg) {
  hintEl.textContent = msg;

  room.order = null;
  room.orderWaitLeft = 0;
  room.preparing = false;
  room.prepLeft = 0;

  // if you were holding that order, drop it
  if (holding === "order" && heldOrder && heldOrder.roomNo === room.no) {
    setHolding("none", null);
  }
}

// ---------- Rendering ----------
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
        const item = r.order.item;
        const emoji = r.order.emoji;

        if (r.preparing) {
          orderBlock = `
            <div class="snackLine">${mood} Preparing ${emoji} ${item}… <b>${Math.max(0, r.prepLeft)}s</b></div>
            <div class="smallMuted">Guest wait: <b>${Math.max(0, r.orderWaitLeft)}s</b></div>
            <div class="smallMuted">You started this at the Snack Bar.</div>
          `;
        } else {
          orderBlock = `
            <div class="snackLine">${mood} Order: ${emoji} <b>${item}</b></div>
            <div class="smallMuted">Wait left: <b>${Math.max(0, r.orderWaitLeft)}s</b></div>
            <div class="smallMuted">Click this room to pick the order, then click 🍹 Snack Bar.</div>
          `;
        }
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
          <div class="smallMuted">Click 🧴 Detergent, then click this room to clean.</div>
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
}

// ---------- Reset Run (keeps coins + inventory) ----------
resetRunBtn.addEventListener("click", () => {
  served = 0;
  angryLeft = 0;
  selectedGuestId = null;

  queue = [];
  rooms = [makeRoom(1), makeRoom(2), makeRoom(3), makeRoom(4)];

  setHolding("none", null);
  hintEl.textContent = "Run reset. Guests will spawn automatically. Click a guest, then an EMPTY room.";
  start();
});

// ---------- utils ----------
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));
}

// ---------- boot ----------
setHolding("none", null);
start();
