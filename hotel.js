// ================= STORAGE HELPERS =================
function getNum(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function setNum(key, value) {
  localStorage.setItem(key, String(value));
}
function setJSON(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}
function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ================= GLOBAL COINS =================
function getCoins() { return getNum("coins", 0); }
function setCoins(n) { setNum("coins", n); }

// ================= BOOSTS (from Puzzle) =================
function getBoosts() {
  return getJSON("hotelBoosts", {});
}
function hasAnyBoost(b) {
  return !!(b.snackBoost || b.cleanerBoost || b.patienceBoost);
}

// ================= MOMBASA STATE (keep your existing keys!) =================
let queue = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

// 4 fixed rooms
let rooms = getJSON("mombasaRoomsV2", null);
if (!rooms || !Array.isArray(rooms) || rooms.length !== 4) {
  rooms = Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    status: "empty", // empty | occupied | dirty | cleaning
    guestId: null,
    checkoutAt: 0,

    willOrder: false,
    orderSnack: null,
    orderAt: 0,
    needsDelivery: false,

    mood: "🏨",
    moodUntil: 0,
    cleaningUntil: 0
  }));
}

// ================= UI HELPERS =================
const $ = (id) => document.getElementById(id);

const hudCoins = $("coins");
const hudQueue = $("queue");
const hudServed = $("served");
const boostPill = $("boostPill");

const roomsEl = $("rooms");
const deliveryHint = $("deliveryHint");
const spawnPeople = $("spawnPeople");

const btnSpawnGuest = $("btnSpawnGuest");
const btnResetHotel = $("btnResetHotel");

const snackButtons = Array.from(document.querySelectorAll(".snack"));

// ================= HOTEL LOGIC =================
const SNACKS = ["🍟","🍹","🍉","🍔"];
let heldSnack = null;

function now() { return Date.now(); }

function saveAll() {
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRoomsV2", rooms);
  // coins saved via setCoins already
}

function setHint(msg) {
  if (deliveryHint) deliveryHint.textContent = msg;
}

function setHeldSnack(snack) {
  heldSnack = snack;
  snackButtons.forEach(b => b.classList.toggle("selected", b.dataset.snack === snack));
  setHint(snack ? `Holding ${snack}. Tap the room that ordered.` : "No delivery selected.");
}

snackButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const s = btn.dataset.snack;
    setHeldSnack(heldSnack === s ? null : s);
  });
});

btnSpawnGuest.addEventListener("click", () => {
  queue += 1;
  saveAll();
  renderAll();
});

// ✅ Hotel-only reset (does NOT clear coins, boosts, puzzle)
btnResetHotel.addEventListener("click", () => {
  if (!confirm("Reset HOTEL only? (Keeps coins + boosts + puzzle)")) return;

  localStorage.removeItem("mombasaQueue");
  localStorage.removeItem("mombasaGuestsServed");
  localStorage.removeItem("mombasaRoomsV2");

  location.reload();
});

function findFirstEmptyRoom() {
  return rooms.find(r => r.status === "empty");
}

function setRoomMood(room, emoji, ms=1200) {
  room.mood = emoji;
  room.moodUntil = now() + ms;
}

function scheduleOrder(room) {
  room.willOrder = Math.random() < 0.65;
  if (!room.willOrder) return;

  const delay = 2000 + Math.floor(Math.random() * 5000); // 2s to 7s
  room.orderAt = now() + delay;
  room.orderSnack = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  room.needsDelivery = false;
}

function checkInLoop() {
  const boosts = getBoosts();

  while (queue > 0) {
    const room = findFirstEmptyRoom();
    if (!room) break;

    queue -= 1;
    room.status = "occupied";
    room.guestId = "G" + Math.floor(Math.random() * 9000 + 1000);

    // ✅ Patience Boost: guests stay longer
    const stayMs = boosts.patienceBoost ? 15000 : 10000;
    room.checkoutAt = now() + stayMs;

    room.orderSnack = null;
    room.needsDelivery = false;
    room.orderAt = 0;

    setRoomMood(room, "😄", 900);
    scheduleOrder(room);
  }
}

function tickRooms() {
  const t = now();

  rooms.forEach(room => {
    if (room.moodUntil && t > room.moodUntil) {
      room.mood = room.status === "occupied" ? "🙂" : (room.status === "empty" ? "🏨" : room.mood);
      room.moodUntil = 0;
    }

    if (room.status === "occupied" && room.willOrder && room.orderAt && t >= room.orderAt && !room.needsDelivery) {
      room.needsDelivery = true;
      setRoomMood(room, room.orderSnack, 1200);
    }

    if (room.status === "occupied" && t >= room.checkoutAt) {
      room.status = "dirty";
      room.guestId = null;
      room.checkoutAt = 0;
      room.willOrder = false;
      room.orderSnack = null;
      room.orderAt = 0;
      room.needsDelivery = false;
      setRoomMood(room, "🧺", 1200);
    }

    if (room.status === "cleaning" && t >= room.cleaningUntil) {
      room.status = "empty";
      room.cleaningUntil = 0;
      setRoomMood(room, "✨", 900);
    }
  });
}

function deliverToRoom(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (room.status === "dirty") {
    setHint(`Room ${roomId} is dirty. Tap CLEAN in the room card.`);
    return;
  }
  if (room.status !== "occupied") {
    setHint(`Room ${roomId} is empty.`);
    return;
  }

  if (!heldSnack) {
    if (room.needsDelivery) setHint(`Room ${roomId} ordered something. Pick a snack first.`);
    else setHint(`Room ${roomId} has no snack order right now.`);
    return;
  }

  if (!room.needsDelivery) {
    setHint(`Wrong timing. Room ${roomId} didn’t order.`);
    setRoomMood(room, "😐", 800);
    return;
  }

  if (heldSnack !== room.orderSnack) {
    setHint(`Wrong snack. Room ${roomId} wanted ${room.orderSnack}.`);
    setRoomMood(room, "😤", 800);
    return;
  }

  // ✅ success
  room.needsDelivery = false;
  room.orderSnack = null;
  room.orderAt = 0;
  room.willOrder = false;

  served += 1;

  // ✅ Snack Boost: extra coin reward on delivery
  const boosts = getBoosts();
  const reward = boosts.snackBoost ? 3 : 2;
  setCoins(getCoins() + reward);

  setRoomMood(room, "😍", 1200);
  setHint(`Delivered! +${reward} coins ✅`);
  setHeldSnack(null);

  saveAll();
  renderAll();
}

function startCleaning(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.status !== "dirty") return;

  room.status = "cleaning";

  // ✅ Cleaner Boost: faster cleaning
  const boosts = getBoosts();
  const cleanMs = boosts.cleanerBoost ? 1500 : 3000;
  room.cleaningUntil = now() + cleanMs;

  setRoomMood(room, "🧼", 900);

  saveAll();
  renderAll();
}

function renderHUD() {
  if (hudCoins) hudCoins.textContent = String(getCoins());
  if (hudQueue) hudQueue.textContent = String(queue);
  if (hudServed) hudServed.textContent = String(served);

  const heads = Math.max(1, Math.min(queue, 7));
  if (spawnPeople) spawnPeople.textContent = queue === 0 ? "✨" : "👤".repeat(heads);

  const boosts = getBoosts();
  if (boostPill) boostPill.style.display = hasAnyBoost(boosts) ? "inline-flex" : "none";
}

function roomStatusTag(room) {
  if (room.status === "empty") return `<span class="tag">Empty</span>`;
  if (room.status === "occupied") {
    if (room.needsDelivery) return `<span class="tag warn">Ordered</span>`;
    return `<span class="tag">Occupied</span>`;
  }
  if (room.status === "dirty") return `<span class="tag danger">Dirty</span>`;
  if (room.status === "cleaning") return `<span class="tag warn">Cleaning…</span>`;
  return `<span class="tag">?</span>`;
}

function renderRoomsList() {
  if (!roomsEl) return;
  roomsEl.innerHTML = "";

  rooms.forEach(room => {
    const el = document.createElement("div");
    el.className = "room";
    el.dataset.room = String(room.id);

    const emoji = room.needsDelivery ? (room.orderSnack || "🛎️") : room.mood;

    const extra =
      room.status === "occupied" && room.needsDelivery
        ? `<span class="tag warn">Wants ${room.orderSnack}</span>`
        : "";

    const cleanBtn =
      room.status === "dirty"
        ? `<button class="smallBtn clean" data-clean="${room.id}">🧼 Clean</button>`
        : `<button class="smallBtn clean" disabled>🧼 Clean</button>`;

    el.innerHTML = `
      <div class="roomTop">
        <div>Room ${room.id}</div>
        <div class="roomBadge">${roomStatusTag(room)}</div>
      </div>

      <div class="roomEmoji">${emoji}</div>

      <div class="roomInfo">
        ${extra}
        ${room.status === "occupied" ? `<span class="tag">Stay</span>` : ""}
      </div>

      <div class="roomButtons">
        ${cleanBtn}
      </div>
    `;

    el.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.clean) return;
      deliverToRoom(room.id);
    });

    roomsEl.appendChild(el);
  });

  Array.from(document.querySelectorAll("[data-clean]")).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      startCleaning(Number(btn.dataset.clean));
    });
  });
}

function renderAll() {
  renderHUD();
  renderRoomsList();
}

// loop
setInterval(() => {
  checkInLoop();
  tickRooms();
  saveAll();
  renderAll();
}, 500);

renderAll();
