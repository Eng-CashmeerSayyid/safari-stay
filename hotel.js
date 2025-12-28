/* ==========================================================
   SAFARI STAY – HOTEL MANIA (MULTI-GUEST) – MOMBASA
   - 4 rooms
   - up to 8 guests moving
   - reception queue
   - requests: 🥤 🥥 🍍
   - bellboy AUTO serves (ONLY if hired)
   - cleaner MANUAL (ONLY if hired)
   - Cartoon mode (Option A): single PNG sprites + fallback emojis
   ========================================================== */

/* ---------- HUD ---------- */
const servedEl = document.getElementById("served");
const queueCountEl = document.getElementById("queueCount");
const roomsFreeEl = document.getElementById("roomsFree");
const hotelCashEl = document.getElementById("hotelCash");
const cleanerModeEl = document.getElementById("cleanerMode");
const spawnGuestBtn = document.getElementById("spawnGuestBtn");

/* ---------- Map / Stations ---------- */
const mapEl = document.getElementById("hotelMap");
const guestLayer = document.getElementById("guestLayer");

const stReception = document.getElementById("stReception");
const stSnack = document.getElementById("stSnack");
const stClean = document.getElementById("stClean");
const stExit = document.getElementById("stExit");

/* ---------- Rooms ---------- */
const roomEls = [
  document.getElementById("room0"),
  document.getElementById("room1"),
  document.getElementById("room2"),
  document.getElementById("room3"),
];
const badgeEls = [
  document.getElementById("badge0"),
  document.getElementById("badge1"),
  document.getElementById("badge2"),
  document.getElementById("badge3"),
];

/* ---------- Workers ---------- */
const bellboyEl = document.getElementById("bellboy");
const cleanerEl = document.getElementById("cleaner");

/* ---------- Storage Keys ---------- */
const COIN_KEY = "coins";
const KEY_BELL = "mombasaBellboy";
const KEY_CLEAN = "mombasaCleaner";

/* ---------- Sprites (Option A) ---------- */
const SPRITES = {
  guest:   "images/chars/guest.png",
  bellboy: "images/chars/bellboy.png",
  cleaner: "images/chars/cleaner.png",
};

function setSprite(el, type, fallbackEmoji){
  if (!el) return;

  // If already has an img, do nothing
  const existing = el.querySelector("img.charSprite");
  if (existing) return;

  // Create img with fallback
  const img = document.createElement("img");
  img.className = "charSprite";
  img.src = SPRITES[type];
  img.alt = type;

  img.onerror = () => {
    // fallback to emoji if image missing
    el.innerHTML = "";
    el.textContent = fallbackEmoji;
  };

  el.innerHTML = "";
  el.appendChild(img);
}

/* ---------- Rewards ---------- */
const BASE_PAY_COINS = 5;
const ITEMS = {
  soda:      { icon:"🥤", seconds: 7,  bonus: 2 },
  coconut:   { icon:"🥥", seconds: 8,  bonus: 3 },
  pineapple: { icon:"🍍", seconds: 12, bonus: 5 }
};
const ITEM_KEYS = Object.keys(ITEMS);

/* ---------- Room State ---------- */
const ROOM_FREE  = "FREE";
const ROOM_OCC   = "OCCUPIED";
const ROOM_DIRTY = "DIRTY";

let rooms = [
  { status: ROOM_FREE,  guestId: null },
  { status: ROOM_FREE,  guestId: null },
  { status: ROOM_FREE,  guestId: null },
  { status: ROOM_FREE,  guestId: null },
];

/* ---------- World ---------- */
let served = 0;
let hotelCash = 0;

let guests = [];
let queue = [];
let nextGuestId = 1;

/* ---------- Hire State ---------- */
let bellHired = localStorage.getItem(KEY_BELL) === "true";
let cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

/* ---------- Bellboy ---------- */
let bellboy = {
  el: bellboyEl,
  x: 210, y: 260,
  speed: 2.7,
  state: "IDLE", // IDLE, TO_SNACK, TO_GUEST, RETURNING
  target: null,
  carrying: null,
  targetGuestId: null,
};

/* ---------- Cleaner ---------- */
let cleaner = {
  el: cleanerEl,
  x: 520, y: 280,
  speed: 2.4,
  state: "IDLE", // IDLE, GOT_DETERGENT, TO_ROOM, CLEANING, RETURNING
  target: null,
  carrying: false,
  selectedRoom: null,
  cleanDoneAt: 0
};
let cleanerStep = "TAP_STATION";

/* ---------- Helpers ---------- */
function setPos(el, x, y){
  if (!el) return;
  el.style.left = x + "px";
  el.style.top = y + "px";
}

function setFacing(el, dx){
  if (!el) return;
  el.classList.toggle("faceLeft", dx < 0);
  el.classList.toggle("faceRight", dx >= 0);
}

function setWalking(el, walking){
  if (!el) return;
  el.classList.toggle("walking", !!walking);
}

function centerOf(el){
  const mapRect = mapEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // -22 keeps center aligned for 44px tokens
  return { x:(r.left-mapRect.left)+r.width/2-22, y:(r.top-mapRect.top)+r.height/2-22 };
}

function moveToward(entity){
  if (!entity.target) {
    if (entity.el) setWalking(entity.el, false);
    return false;
  }

  const dx = entity.target.x - entity.x;
  const dy = entity.target.y - entity.y;
  const dist = Math.hypot(dx, dy);

  if (entity.el) {
    setFacing(entity.el, dx);
    setWalking(entity.el, true);
  }

  if (dist < 2){
    entity.x = entity.target.x;
    entity.y = entity.target.y;
    entity.target = null;
    if (entity.el) setWalking(entity.el, false);
    return true;
  }
  entity.x += (dx/dist) * entity.speed;
  entity.y += (dy/dist) * entity.speed;
  return false;
}

function addGlobalCoins(amount){
  const current = Number(localStorage.getItem(COIN_KEY)) || 0;
  localStorage.setItem(COIN_KEY, String(current + amount));
}

/* ---------- Hire sync + visibility ---------- */
function setCleanerCarry(on){
  cleaner.carrying = on;
  if (!cleanerEl) return;

  if (on){
    cleanerEl.classList.add("carrying");
    cleanerEl.dataset.carry = "🧴";
  } else {
    cleanerEl.classList.remove("carrying");
    cleanerEl.dataset.carry = "";
  }
}

function syncHiresAndVisibility() {
  bellHired = localStorage.getItem(KEY_BELL) === "true";
  cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

  if (bellboyEl) bellboyEl.style.display = bellHired ? "" : "none";
  if (cleanerEl) cleanerEl.style.display = cleanerHired ? "" : "none";

  if (!cleanerHired) {
    cleanerStep = "TAP_STATION";
    cleaner.state = "IDLE";
    cleaner.target = null;
    cleaner.selectedRoom = null;
    cleaner.cleanDoneAt = 0;
    setCleanerCarry(false);
  }

  updateHUD();
}

window.addEventListener("staffUpdated", syncHiresAndVisibility);

/* ---------- Requests rolling ---------- */
function rollRequests(){
  const r = Math.random();
  let count = 0;
  if (r < 0.30) count = 0;
  else if (r < 0.68) count = 1;
  else if (r < 0.92) count = 2;
  else count = 3;

  const picks = [];
  for (let i = 0; i < count; i++){
    const k = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    picks.push(k);
  }
  return picks;
}

/* ---------- Room helpers ---------- */
function roomsFreeCount(){ return rooms.filter(r => r.status === ROOM_FREE).length; }
function findFreeRoomIndex(){ return rooms.findIndex(r => r.status === ROOM_FREE); }

function setRoomStatus(i, status){
  rooms[i].status = status;
  if (badgeEls[i]) {
    if (status === ROOM_FREE)  badgeEls[i].textContent = "✅";
    if (status === ROOM_OCC)   badgeEls[i].textContent = "🧳";
    if (status === ROOM_DIRTY) badgeEls[i].textContent = "🧺";
  }
  updateHUD();
}

function updateHUD(){
  if (roomsFreeEl) roomsFreeEl.textContent = String(roomsFreeCount());
  if (queueCountEl) queueCountEl.textContent = String(queue.length);
  if (servedEl) servedEl.textContent = String(served);
  if (hotelCashEl) hotelCashEl.textContent = String(hotelCash);

  if (!cleanerModeEl) return;

  if (!cleanerHired) {
    cleanerModeEl.textContent = "Hire Cleaner to clean";
  } else {
    cleanerModeEl.textContent = cleanerStep === "TAP_STATION"
      ? "Tap 🧴 station"
      : "Tap 🧺 dirty room";
  }
}

/* ---------- Guests ---------- */
function makeGuest(){
  const el = document.createElement("div");
  el.className = "guestToken";
  el.textContent = "🧳"; // fallback
  guestLayer.appendChild(el);

  // sprite (fallback to emoji if missing)
  setSprite(el, "guest", "🧳");

  // bubble
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const ring = document.createElement("div");
  ring.className = "ring";
  bubble.appendChild(ring);
  bubble.style.display = "none";
  el.appendChild(bubble);

  return {
    id: nextGuestId++,
    el,
    bubble,
    ring,
    x: 10, y: 10,
    speed: 2.0,
    state: "SPAWN",
    target: null,

    roomIndex: null,
    requests: [],
    currentRequest: null,
    requestDeadline: 0,
    totalBonus: 0,
    angry: false,

    // for queue
    queuePosIndex: 0,
  };
}

function showGuestBubble(g, icon){
  const bubble = g.bubble;
  bubble.style.display = "grid";
  bubble.classList.remove("pop");
  // rebuild icon
  [...bubble.childNodes].forEach(n => { if (n !== g.ring) bubble.removeChild(n); });
  const iconNode = document.createElement("div");
  iconNode.textContent = icon;
  bubble.appendChild(iconNode);

  // little pop
  requestAnimationFrame(() => bubble.classList.add("pop"));
}

function hideGuestBubble(g){
  g.bubble.style.display = "none";
}

/* ---------- Reception queue positions ---------- */
function queueSpot(index){
  const base = centerOf(stReception);
  return { x: base.x - 40, y: base.y + 55 + index * 30 };
}

function refreshQueuePositions(){
  queue.forEach((g, idx) => {
    g.queuePosIndex = idx;
  });
}

/* ---------- Flow ---------- */
function sendToReception(g){
  g.state = "TO_RECEPTION";
  g.target = centerOf(stReception);
}

function onArriveReception(g){
  const freeRoom = findFreeRoomIndex();
  if (freeRoom === -1){
    g.state = "QUEUED";
    g.target = null;
    queue.push(g);
    refreshQueuePositions();
    updateHUD();
    return;
  }

  g.roomIndex = freeRoom;
  setRoomStatus(freeRoom, ROOM_OCC);

  // if they were queued, remove them from queue
  queue = queue.filter(x => x.id !== g.id);
  refreshQueuePositions();

  g.state = "TO_ROOM";
  g.target = centerOf(roomEls[freeRoom]);
}

function startNextRequestOrCheckout(g){
  if (g.requests.length === 0){
    g.state = "TO_PAY";
    hideGuestBubble(g);
    g.el.classList.remove("angry");
    g.angry = false;
    g.target = centerOf(stReception);
    return;
  }

  const next = g.requests.shift();
  g.currentRequest = next;
  const def = ITEMS[next];
  g.requestDeadline = Date.now() + def.seconds * 1000;
  g.state = "WAITING";
  g.angry = false;
  g.el.classList.remove("angry");
  showGuestBubble(g, def.icon);
}

function onArriveRoom(g){
  g.requests = rollRequests();
  g.totalBonus = 0;
  g.currentRequest = null;
  startNextRequestOrCheckout(g);
}

function onArrivePay(g){
  served += 1;

  const base = g.angry ? Math.max(1, BASE_PAY_COINS - 3) : BASE_PAY_COINS;
  const payCoins = base + g.totalBonus;

  hotelCash += payCoins;
  addGlobalCoins(payCoins);

  if (g.roomIndex !== null){
    setRoomStatus(g.roomIndex, ROOM_DIRTY);
    g.roomIndex = null;
  }

  g.state = "TO_EXIT";
  g.target = centerOf(stExit);
  updateHUD();
}

function onArriveExit(g){
  g.state = "DONE";
  hideGuestBubble(g);
  g.el.remove();
  guests = guests.filter(x => x.id !== g.id);
  updateHUD();
}

/* ---------- Patience ---------- */
function updatePatienceAll(){
  const now = Date.now();
  guests.forEach(g => {
    if (g.state !== "WAITING" || !g.currentRequest) return;

    const total = ITEMS[g.currentRequest].seconds * 1000;
    const left = g.requestDeadline - now;
    const pct = Math.max(0, Math.min(1, left / total));

    g.ring.style.borderWidth = (3 + (1 - pct) * 2) + "px";
    g.ring.style.opacity = String(0.6 + (1 - pct) * 0.4);

    if (left <= 0 && !g.angry){
      g.angry = true;
      g.el.classList.add("angry");
      g.currentRequest = null;
      hideGuestBubble(g);
      setTimeout(() => startNextRequestOrCheckout(g), 250);
    }
  });
}

/* ---------- Bellboy AUTO (ONLY if hired) ---------- */
function findServeTargetGuest(){
  return guests.find(g => g.state === "WAITING" && !!g.currentRequest);
}
function getGuestById(id){ return guests.find(g => g.id === id); }

function bellboyTryServe(){
  if (!bellHired) return;
  if (bellboy.state !== "IDLE") return;

  const targetGuest = findServeTargetGuest();
  if (!targetGuest) return;

  bellboy.targetGuestId = targetGuest.id;
  bellboy.carrying = targetGuest.currentRequest;
  bellboy.state = "TO_SNACK";
  bellboy.target = centerOf(stSnack);
}

function onBellboySnack(){
  bellboy.state = "TO_GUEST";
  const g = getGuestById(bellboy.targetGuestId);
  if (!g){
    bellboy.state = "RETURNING";
    bellboy.target = centerOf(stSnack);
    return;
  }
  bellboy.target = { x: g.x, y: g.y };
}

function onBellboyGuest(){
  const g = getGuestById(bellboy.targetGuestId);
  if (g && g.state === "WAITING" && g.currentRequest === bellboy.carrying){
    const def = ITEMS[bellboy.carrying];
    g.totalBonus += def.bonus;

    g.currentRequest = null;
    hideGuestBubble(g);
    g.el.classList.remove("angry");
    g.angry = false;

    setTimeout(() => startNextRequestOrCheckout(g), 350);
  }

  bellboy.carrying = null;
  bellboy.targetGuestId = null;
  bellboy.state = "RETURNING";
  bellboy.target = centerOf(stSnack);
}

function onBellboyReturn(){ bellboy.state = "IDLE"; }

/* ---------- Cleaner MANUAL (ONLY if hired) ---------- */
stClean?.addEventListener("click", () => {
  if (!cleanerHired) return;
  if (cleanerStep !== "TAP_STATION") return;
  if (cleaner.state !== "IDLE") return;

  cleaner.state = "GOT_DETERGENT";
  setCleanerCarry(true);
  cleanerStep = "TAP_ROOM";
  updateHUD();
});

function startCleaningRoom(i){
  if (!cleanerHired) return;
  if (cleanerStep !== "TAP_ROOM") return;
  if (!cleaner.carrying) return;
  if (cleaner.state !== "GOT_DETERGENT" && cleaner.state !== "IDLE") return;
  if (rooms[i].status !== ROOM_DIRTY) return;

  cleaner.selectedRoom = i;
  cleaner.state = "TO_ROOM";
  cleaner.target = centerOf(roomEls[i]);
}
roomEls.forEach((el, i) => el?.addEventListener("click", () => startCleaningRoom(i)));

function onCleanerArriveRoom(){
  cleaner.state = "CLEANING";
  cleaner.cleanDoneAt = Date.now() + 6000;
}

function finishCleaning(){
  const i = cleaner.selectedRoom;
  if (i !== null){
    setRoomStatus(i, ROOM_FREE);
  }
  cleaner.selectedRoom = null;
  cleaner.state = "RETURNING";
  cleaner.target = centerOf(stClean);
}

function onCleanerReturn(){
  cleaner.state = "IDLE";
  setCleanerCarry(false);
  cleanerStep = "TAP_STATION";
  updateHUD();
}

/* ---------- Spawning guests ---------- */
function spawnGuest(){
  if (guests.length >= 8) return;

  const g = makeGuest();
  guests.push(g);

  // entrance with small offsets
  g.x = 10 + (guests.length % 3) * 14;
  g.y = 10 + (guests.length % 3) * 14;

  setPos(g.el, g.x, g.y);
  hideGuestBubble(g);

  sendToReception(g);
  updateHUD();
}
spawnGuestBtn?.addEventListener("click", spawnGuest);

/* ---------- Main loop ---------- */
function loop(){
  // Guests update
  guests.forEach(g => {
    const arrived = moveToward(g);
    setPos(g.el, g.x, g.y);

    if (arrived){
      if (g.state === "TO_RECEPTION") onArriveReception(g);
      else if (g.state === "TO_ROOM") onArriveRoom(g);
      else if (g.state === "TO_PAY") onArrivePay(g);
      else if (g.state === "TO_EXIT") onArriveExit(g);
    }
  });

  // Queue “stick” positions
  queue.forEach((g, idx) => {
    const p = queueSpot(idx);
    g.x += (p.x - g.x) * 0.08;
    g.y += (p.y - g.y) * 0.08;
    setPos(g.el, g.x, g.y);
  });

  // Bellboy update
  if (bellHired) {
    const bellArrived = moveToward(bellboy);
    setPos(bellboyEl, bellboy.x, bellboy.y);

    if (bellArrived){
      if (bellboy.state === "TO_SNACK") onBellboySnack();
      else if (bellboy.state === "TO_GUEST") onBellboyGuest();
      else if (bellboy.state === "RETURNING") onBellboyReturn();
    }

    bellboyTryServe();
  }

  // Cleaner update
  if (cleanerHired) {
    const cleanArrived = moveToward(cleaner);
    setPos(cleanerEl, cleaner.x, cleaner.y);

    if (cleanArrived){
      if (cleaner.state === "TO_ROOM") onCleanerArriveRoom();
      else if (cleaner.state === "RETURNING") onCleanerReturn();
    }

    if (cleaner.state === "CLEANING" && Date.now() >= cleaner.cleanDoneAt){
      finishCleaning();
    }
  }

  updatePatienceAll();
  requestAnimationFrame(loop);
}

/* ---------- Start ---------- */
function start(){
  if (!mapEl || !guestLayer || !stReception || !stSnack || !stClean || !stExit) return;

  // Worker sprites (fallback to emoji)
  setSprite(bellboyEl, "bellboy", "🧑🏾‍💼");
  setSprite(cleanerEl, "cleaner", "🧹");

  // init room badges
  for (let i = 0; i < 4; i++) setRoomStatus(i, ROOM_FREE);

  // place workers
  setPos(bellboyEl, bellboy.x, bellboy.y);
  setPos(cleanerEl, cleaner.x, cleaner.y);
  setCleanerCarry(false);

  syncHiresAndVisibility();
  updateHUD();
  loop();
}
start();






