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

// ================= BOOSTS (from puzzle) =================
// puzzle writes: localStorage.hotelBoosts = { snackBoost, cleanerBoost, patienceBoost }
function getBoosts() { return getJSON("hotelBoosts", {}); }
function hasAnyBoost(b){ return !!(b.snackBoost || b.cleanerBoost || b.patienceBoost); }

// ================= DOM =================
const $ = (id) => document.getElementById(id);

const hudCoins = $("coins");
const hudQueue = $("queue");
const hudServed = $("served");
const boostPill = $("boostPill");

const hintEl = $("hint");
const spawnPeople = $("spawnPeople");

const btnSpawnGuest = $("btnSpawnGuest");
const btnResetHotel = $("btnResetHotel");

const stationSnack = $("stationSnack");
const stationDetergent = $("stationDetergent");

const handFoodEl = $("handFood");
const handToolEl = $("handTool");

const snackRow = $("snackRow");
const snackHint = $("snackHint");
const snackButtons = Array.from(document.querySelectorAll(".snack"));

const queueListEl = $("queueList");
const roomsEl = $("rooms");

// ================= STATE (hotel progress keys preserved) =================
let queueCount = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

// rooms saved under this key (keep as you already used)
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
    cleaningUntil: 0,

    // patience visuals
    patienceStart: 0,
    patienceEnd: 0
  }));
}

// New queue list (IDs) — persisted, but if missing we can rebuild from count
let queueIds = getJSON("mombasaQueueIds", null);
if (!queueIds || !Array.isArray(queueIds)) {
  queueIds = [];
  for (let i = 0; i < queueCount; i++) queueIds.push(makeGuestId());
}

// selection
let selectedGuest = null; // guestId string

// Two hands model
// - foodHand holds snacks
// - toolHand holds detergent
let activeStation = "snack"; // "snack" | "detergent"
let foodHand = null;         // one of SNACKS
let toolHand = null;         // "🧼" or null

// constants
const SNACKS = ["🍟", "🍹", "🍉", "🍔"];
const STAY_BASE_MS = 10000;
const ORDER_DELAY_MIN = 2000;
const ORDER_DELAY_MAX = 7000;
const ORDER_PATIENCE_MS = 6500; // time to deliver after order before angry

function now(){ return Date.now(); }

function makeGuestId(){
  return "G" + Math.floor(Math.random() * 9000 + 1000);
}

function saveAll(){
  setNum("mombasaQueue", queueIds.length);
  setJSON("mombasaQueueIds", queueIds);

  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRoomsV2", rooms);
  // coins stored via setCoins
}

// ================= UI HELPERS =================
function setHint(t){
  if (hintEl) hintEl.textContent = t || "";
}

function renderHands(){
  if (handFoodEl) handFoodEl.textContent = foodHand || "—";
  if (handToolEl) handToolEl.textContent = toolHand || "—";
}

function setActiveStation(st){
  activeStation = st;

  stationSnack?.classList.toggle("active", st === "snack");
  stationDetergent?.classList.toggle("active", st === "detergent");

  // show/hide snack row
  if (snackRow) snackRow.style.display = (st === "snack") ? "flex" : "none";

  if (st === "snack"){
    toolHand = null;           // you’re not holding detergent in snack mode
    renderHands();
    setHint("Snack Station: pick a snack, then tap the room that ordered.");
  } else {
    foodHand = null;           // you’re not holding snacks in detergent mode
    toolHand = "🧼";
    // clear snack button selection UI
    snackButtons.forEach(b => b.classList.remove("selected"));
    renderHands();
    setHint("Detergent Station: tap a DIRTY room to start cleaning.");
  }
}

function setFoodHand(snack){
  if (activeStation !== "snack"){
    setHint("Go to Snack Station first.");
    return;
  }
  foodHand = (foodHand === snack) ? null : snack;
  snackButtons.forEach(b => b.classList.toggle("selected", b.dataset.snack === foodHand));
  renderHands();
  setHint(foodHand ? `Holding ${foodHand}. Tap the room that ordered.` : "Pick a snack to deliver.");
}

// ================= BOOST EFFECTS =================
function getStayMs(){
  const boosts = getBoosts();
  return STAY_BASE_MS + (boosts.patienceBoost ? 4000 : 0);
}
function getCleanMs(){
  const boosts = getBoosts();
  return boosts.cleanerBoost ? 1500 : 3000;
}
function deliveryReward(){
  const boosts = getBoosts();
  return boosts.snackBoost ? 3 : 2;
}

// ================= HOTEL LOGIC =================
function scheduleOrder(room){
  room.willOrder = Math.random() < 0.65;
  if (!room.willOrder) return;

  const delay = ORDER_DELAY_MIN + Math.floor(Math.random() * (ORDER_DELAY_MAX - ORDER_DELAY_MIN));
  room.orderAt = now() + delay;
  room.orderSnack = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  room.needsDelivery = false;

  room.patienceStart = 0;
  room.patienceEnd = 0;
}

function tickRooms(){
  const t = now();

  rooms.forEach(room => {
    // clear mood
    if (room.moodUntil && t > room.moodUntil){
      room.moodUntil = 0;
      room.mood = room.status === "occupied" ? "🙂" : (room.status === "empty" ? "🏨" : room.mood);
    }

    // trigger order
    if (room.status === "occupied" && room.willOrder && room.orderAt && t >= room.orderAt && !room.needsDelivery){
      room.needsDelivery = true;
      room.mood = room.orderSnack;
      room.moodUntil = t + 900;

      // start patience window
      room.patienceStart = t;
      room.patienceEnd = t + ORDER_PATIENCE_MS;
    }

    // if order overdue → angry leaves (optional penalty)
    if (room.status === "occupied" && room.needsDelivery && room.patienceEnd && t >= room.patienceEnd){
      // guest gets angry and checks out immediately -> dirty
      room.status = "dirty";
      room.guestId = null;

      room.checkoutAt = 0;
      room.willOrder = false;
      room.orderSnack = null;
      room.orderAt = 0;
      room.needsDelivery = false;

      room.mood = "😡";
      room.moodUntil = t + 1200;

      room.patienceStart = 0;
      room.patienceEnd = 0;
    }

    // natural checkout
    if (room.status === "occupied" && room.checkoutAt && t >= room.checkoutAt){
      room.status = "dirty";
      room.guestId = null;

      room.checkoutAt = 0;
      room.willOrder = false;
      room.orderSnack = null;
      room.orderAt = 0;
      room.needsDelivery = false;

      room.mood = "🧺";
      room.moodUntil = t + 1200;

      room.patienceStart = 0;
      room.patienceEnd = 0;
    }

    // cleaning finish
    if (room.status === "cleaning" && room.cleaningUntil && t >= room.cleaningUntil){
      room.status = "empty";
      room.cleaningUntil = 0;
      room.mood = "✨";
      room.moodUntil = t + 900;
    }
  });
}

function checkInSelectedGuestToRoom(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (!selectedGuest){
    setHint("Select a guest in the queue first.");
    return;
  }

  if (room.status !== "empty"){
    setHint(`Room ${roomId} is not empty.`);
    return;
  }

  // Check-in
  room.status = "occupied";
  room.guestId = selectedGuest;
  room.checkoutAt = now() + getStayMs();

  room.willOrder = false;
  room.orderSnack = null;
  room.orderAt = 0;
  room.needsDelivery = false;

  room.patienceStart = 0;
  room.patienceEnd = 0;

  room.mood = "😄";
  room.moodUntil = now() + 900;

  // remove guest from queue
  queueIds = queueIds.filter(id => id !== selectedGuest);
  selectedGuest = null;

  scheduleOrder(room);

  saveAll();
  renderAll();
  setHint("Guest checked in ✅ Now watch for snack orders.");
}

function deliverSnack(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (room.status !== "occupied"){
    setHint(`Room ${roomId} is not occupied.`);
    return;
  }
  if (!room.needsDelivery){
    setHint(`Room ${roomId} didn’t order right now.`);
    room.mood = "😐"; room.moodUntil = now() + 700;
    return;
  }

  if (activeStation !== "snack"){
    setHint("Go to Snack Station to deliver food.");
    return;
  }

  if (!foodHand){
    setHint(`Pick a snack first. Room ${roomId} wants ${room.orderSnack}.`);
    return;
  }

  if (foodHand !== room.orderSnack){
    setHint(`Wrong snack. Room ${roomId} wants ${room.orderSnack}.`);
    room.mood = "😤"; room.moodUntil = now() + 900;
    return;
  }

  // success delivery
  room.needsDelivery = false;
  room.willOrder = false;
  room.orderSnack = null;
  room.orderAt = 0;

  room.patienceStart = 0;
  room.patienceEnd = 0;

  served += 1;
  const reward = deliveryReward();
  setCoins(getCoins() + reward);

  room.mood = "😍"; room.moodUntil = now() + 1200;

  // clear food hand after delivery
  foodHand = null;
  snackButtons.forEach(b => b.classList.remove("selected"));
  renderHands();

  saveAll();
  renderAll();
  setHint(`Delivered correctly! +${reward} coins ✅`);
}

function startCleaning(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (room.status !== "dirty"){
    setHint("Only DIRTY rooms can be cleaned.");
    return;
  }

  if (activeStation !== "detergent"){
    setHint("Go to Detergent Station to clean.");
    return;
  }

  // detergent hand is always 🧼 in that station
  room.status = "cleaning";
  room.cleaningUntil = now() + getCleanMs();
  room.mood = "🧼"; room.moodUntil = now() + 900;

  saveAll();
  renderAll();
  setHint("Cleaning started ✅");
}

// ================= RENDER =================
function renderHUD(){
  const boosts = getBoosts();

  hudCoins.textContent = String(getCoins());
  hudQueue.textContent = String(queueIds.length);
  hudServed.textContent = String(served);

  const heads = Math.max(1, Math.min(queueIds.length, 7));
  spawnPeople.textContent = queueIds.length === 0 ? "✨" : "👤".repeat(heads);

  boostPill.style.display = hasAnyBoost(boosts) ? "inline-flex" : "none";
}

function renderQueue(){
  queueListEl.innerHTML = "";

  if (queueIds.length === 0){
    const empty = document.createElement("div");
    empty.className = "smallMuted";
    empty.textContent = "Queue is empty. Tap Spawn Guest.";
    queueListEl.appendChild(empty);
    return;
  }

  queueIds.forEach((id) => {
    const btn = document.createElement("button");
    btn.className = "queueItem";
    btn.type = "button";
    btn.textContent = `${id}  •  Tap to select`;
    btn.classList.toggle("selected", selectedGuest === id);

    btn.addEventListener("click", () => {
      selectedGuest = (selectedGuest === id) ? null : id;
      setHint(selectedGuest ? `Selected ${selectedGuest}. Now tap an EMPTY room.` : "Select a guest, then tap an empty room.");
      renderQueue();
      renderRooms();
    });

    queueListEl.appendChild(btn);
  });
}

function tag(room){
  if (room.status === "empty") return `<span class="tag">Empty</span>`;
  if (room.status === "occupied") return room.needsDelivery ? `<span class="tag warn">Ordered</span>` : `<span class="tag">Occupied</span>`;
  if (room.status === "dirty") return `<span class="tag danger">Dirty</span>`;
  if (room.status === "cleaning") return `<span class="tag warn">Cleaning…</span>`;
  return `<span class="tag">?</span>`;
}

function renderRooms(){
  roomsEl.innerHTML = "";

  rooms.forEach(room => {
    const el = document.createElement("div");
    el.className = "roomCard";
    el.dataset.room = String(room.id);

    // visual for orders/urgency
    if (room.status === "occupied" && room.needsDelivery) {
      el.classList.add("hasOrder");
      if (room.patienceEnd && now() > room.patienceEnd - 1200) el.classList.add("orderUrgent");
    }

    const emoji = room.needsDelivery ? (room.orderSnack || "🛎️") : room.mood;

    el.innerHTML = `
      <div class="roomTop">
        <div class="roomTitle">Room ${room.id}</div>
        <div>${tag(room)}</div>
      </div>

      <div class="roomEmoji">${emoji}</div>

      <div class="roomInfo">
        ${room.status === "occupied" ? `<span class="tag">Guest: ${room.guestId}</span>` : ""}
        ${room.status === "occupied" && room.needsDelivery ? `<span class="tag warn">Wants ${room.orderSnack}</span>` : ""}
      </div>

      <div class="roomButtons">
        <button class="smallBtn" data-action="roomTap" data-room="${room.id}">Tap Room</button>
      </div>
    `;

    // whole card click
    el.addEventListener("click", () => {
      if (room.status === "empty") return checkInSelectedGuestToRoom(room.id);
      if (room.status === "occupied") return deliverSnack(room.id);
      if (room.status === "dirty") return startCleaning(room.id);
      if (room.status === "cleaning") return setHint("Cleaning… wait a moment.");
    });

    roomsEl.appendChild(el);
  });
}

function renderAll(){
  renderHUD();
  renderQueue();
  renderRooms();
  renderHands();
}

// ================= EVENTS =================
btnSpawnGuest.addEventListener("click", () => {
  queueIds.push(makeGuestId());
  saveAll();
  renderAll();
  setHint("Guest spawned. Select them in the queue, then tap an empty room.");
});

btnResetHotel.addEventListener("click", () => {
  if (!confirm("Reset HOTEL only? (Keeps coins + puzzle + boosts)")) return;
  localStorage.removeItem("mombasaQueue");
  localStorage.removeItem("mombasaQueueIds");
  localStorage.removeItem("mombasaGuestsServed");
  localStorage.removeItem("mombasaRoomsV2");
  location.reload();
});

// Station switching
stationSnack.addEventListener("click", () => setActiveStation("snack"));
stationDetergent.addEventListener("click", () => setActiveStation("detergent"));

// Snack picking
snackButtons.forEach(btn => {
  btn.addEventListener("click", () => setFoodHand(btn.dataset.snack));
});

// ================= LOOP =================
setInterval(() => {
  tickRooms();
  saveAll();
  renderAll();
}, 500);

// init
setActiveStation("snack");
renderAll();
saveAll();
