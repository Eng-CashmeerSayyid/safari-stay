/* ==========================================
   SAFARI STAY – HOTEL MANIA (Top-Down)
   + 4 rooms + queue
   + Drinks (🥤🥥🍍), pineapple slower but pays more
   + Bellboy AUTO serves drink requests
   + Cleaner MANUAL:
       Tap 🧴 station -> tap dirty room to clean
   ========================================== */

/* ---------- Tabs ---------- */
const tabPuzzle = document.getElementById("tabPuzzle");
const tabHotel  = document.getElementById("tabHotel");
const viewPuzzle = document.getElementById("viewPuzzle");
const viewHotel  = document.getElementById("viewHotel");

function showPuzzle(){
  tabPuzzle?.classList.add("active");
  tabHotel?.classList.remove("active");
  viewPuzzle?.classList.remove("hidden");
  viewHotel?.classList.add("hidden");
}
function showHotel(){
  tabHotel?.classList.add("active");
  tabPuzzle?.classList.remove("active");
  viewHotel?.classList.remove("hidden");
  viewPuzzle?.classList.add("hidden");
}
tabPuzzle?.addEventListener("click", showPuzzle);
tabHotel?.addEventListener("click", showHotel);

/* ---------- HUD ---------- */
const servedEl = document.getElementById("served");
const queueCountEl = document.getElementById("queueCount");
const roomsFreeEl = document.getElementById("roomsFree");
const hotelCashEl = document.getElementById("hotelCash");
const cleanerModeEl = document.getElementById("cleanerMode");
const spawnGuestBtn = document.getElementById("spawnGuestBtn");

/* ---------- Map / Stations ---------- */
const mapEl = document.getElementById("hotelMap");
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

/* ---------- Characters ---------- */
const guestEl = document.getElementById("guest");
const bellboyEl = document.getElementById("bellboy");
const cleanerEl = document.getElementById("cleaner");

/* ---------- Storage ---------- */
const COIN_KEY = "coins";

/* ---------- Rewards ---------- */
const BASE_PAY_COINS = 5;
const SERVICE_BONUS = { soda:2, coconut:3, pineapple:5 };

/* ---------- Request definitions ---------- */
const ITEMS = {
  soda:      { icon:"🥤", seconds: 7,  bonus: SERVICE_BONUS.soda },
  coconut:   { icon:"🥥", seconds: 8,  bonus: SERVICE_BONUS.coconut },
  pineapple: { icon:"🍍", seconds:12,  bonus: SERVICE_BONUS.pineapple } // slower + pays more
};
const ITEM_KEYS = Object.keys(ITEMS);

/* ---------- Room State ---------- */
const ROOM_FREE = "FREE";
const ROOM_OCC  = "OCCUPIED";
const ROOM_DIRTY= "DIRTY";

/* Each room stores status + who is inside */
let rooms = [
  { status: ROOM_FREE, guestId: null },
  { status: ROOM_FREE, guestId: null },
  { status: ROOM_FREE, guestId: null },
  { status: ROOM_FREE, guestId: null },
];

/* ---------- World state ---------- */
let served = 0;
let hotelCash = 0;

let queue = [];          // guest objects waiting to check in
let currentGuest = null; // single animated guest token (we simulate one at a time visually)

/* ---------- Guest template ---------- */
function makeGuest(id){
  return {
    id,
    x: 10, y: 10,
    speed: 2.0,
    state: "IDLE",
    target: null,

    roomIndex: null,
    requests: [],
    currentRequest: null,
    requestDeadline: 0,
    totalBonus: 0,
    angry: false,
  };
}

let nextGuestId = 1;

/* ---------- Bellboy ---------- */
let bellboy = {
  x: 210, y: 260,
  speed: 2.6,
  state: "IDLE",      // IDLE, TO_SNACK, TO_GUEST, RETURNING
  target: null,
  carrying: null,
};

/* ---------- Cleaner (MANUAL) ---------- */
let cleaner = {
  x: 520, y: 280,
  speed: 2.4,
  state: "IDLE",        // IDLE, GOT_DETERGENT, TO_ROOM, CLEANING, RETURNING
  target: null,
  carrying: false,
  selectedRoom: null,
  cleanDoneAt: 0
};

let cleanerStep = "TAP_STATION"; // TAP_STATION -> TAP_ROOM
updateCleanerModeText();

/* ---------- Bubble UI (above guest) ---------- */
let bubbleEl = null;
let ringEl = null;

function ensureBubble() {
  if (bubbleEl) return;
  bubbleEl = document.createElement("div");
  bubbleEl.className = "bubble";
  ringEl = document.createElement("div");
  ringEl.className = "ring";
  bubbleEl.appendChild(ringEl);
  guestEl.appendChild(bubbleEl);
  hideBubble();
}
function showBubble(icon){
  ensureBubble();
  bubbleEl.style.display = "grid";
  // remove old icon nodes (keep ring)
  [...bubbleEl.childNodes].forEach(n => { if (n !== ringEl) bubbleEl.removeChild(n); });
  const iconNode = document.createElement("div");
  iconNode.textContent = icon;
  bubbleEl.appendChild(iconNode);
}
function hideBubble(){
  ensureBubble();
  bubbleEl.style.display = "none";
}

/* ---------- Geometry ---------- */
function setPos(el, x, y){ el.style.left = x + "px"; el.style.top = y + "px"; }
function centerOf(el){
  const mapRect = mapEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x:(r.left - mapRect.left)+r.width/2-22, y:(r.top - mapRect.top)+r.height/2-22 };
}

function setTarget(entity, p){ entity.target = p; }

function moveToward(entity){
  if (!entity.target) return false;
  const dx = entity.target.x - entity.x;
  const dy = entity.target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2){
    entity.x = entity.target.x;
    entity.y = entity.target.y;
    entity.target = null;
    return true;
  }
  entity.x += (dx/dist) * entity.speed;
  entity.y += (dy/dist) * entity.speed;
  return false;
}

/* ---------- Requests rolling ---------- */
function rollRequests(){
  const r = Math.random();
  let count = 0;
  if (r < 0.30) count = 0;      // 30% none
  else if (r < 0.68) count = 1; // 38% one
  else if (r < 0.92) count = 2; // 24% two
  else count = 3;              // 8% three

  const picks = [];
  for (let i = 0; i < count; i++){
    const key = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    picks.push(key);
  }
  return picks;
}

/* ---------- Room helpers ---------- */
function roomsFreeCount(){
  return rooms.filter(r => r.status === ROOM_FREE).length;
}

function findFreeRoomIndex(){
  return rooms.findIndex(r => r.status === ROOM_FREE);
}

function setRoomStatus(i, status){
  rooms[i].status = status;
  const badge = badgeEls[i];
  if (status === ROOM_FREE) badge.textContent = "✅";
  if (status === ROOM_OCC)  badge.textContent = "🧳";
  if (status === ROOM_DIRTY)badge.textContent = "🧺";
  updateRoomsUI();
}

function updateRoomsUI(){
  roomsFreeEl.textContent = String(roomsFreeCount());
  queueCountEl.textContent = String(queue.length);
}

/* ---------- Economy ---------- */
function addGlobalCoins(amount){
  const current = Number(localStorage.getItem(COIN_KEY)) || 0;
  localStorage.setItem(COIN_KEY, String(current + amount));
}

/* ---------- Guest flow ---------- */
function startGuestWalkIn(g){
  g.state = "TO_RECEPTION";
  setTarget(g, centerOf(stReception));
}

function onArriveReception(g){
  // If there is a free room, assign now; else queue at reception
  const freeRoom = findFreeRoomIndex();
  if (freeRoom === -1){
    g.state = "QUEUED";
    // parked at reception (slight offset based on queue size)
    const p = centerOf(stReception);
    g.x = p.x + 0;
    g.y = p.y + 0;
    g.target = null;
    queue.push(g);
    updateRoomsUI();
    return;
  }

  // assign room
  g.roomIndex = freeRoom;
  rooms[freeRoom].status = ROOM_OCC;
  rooms[freeRoom].guestId = g.id;
  setRoomStatus(freeRoom, ROOM_OCC);

  g.state = "TO_ROOM";
  setTarget(g, centerOf(roomEls[freeRoom]));
}

function startNextRequestOrCheckout(g){
  if (g.requests.length === 0){
    g.state = "TO_PAY";
    hideBubble();
    guestEl.classList.remove("angry");
    g.angry = false;
    setTarget(g, centerOf(stReception));
    return;
  }

  const next = g.requests.shift();
  g.currentRequest = next;
  const def = ITEMS[next];
  g.requestDeadline = Date.now() + def.seconds * 1000;

  g.state = "WAITING_FOR_ITEM";
  g.angry = false;
  guestEl.classList.remove("angry");
  showBubble(def.icon);
}

function onArriveRoom(g){
  g.requests = rollRequests();
  g.totalBonus = 0;
  g.currentRequest = null;
  startNextRequestOrCheckout(g);
}

function onArrivePay(g){
  served += 1;

  // If angry, reduce base
  const base = g.angry ? Math.max(1, BASE_PAY_COINS - 3) : BASE_PAY_COINS;
  const payCoins = base + g.totalBonus;

  hotelCash += payCoins;
  servedEl.textContent = String(served);
  hotelCashEl.textContent = String(hotelCash);

  addGlobalCoins(payCoins);

  // room becomes DIRTY now
  if (g.roomIndex !== null){
    setRoomStatus(g.roomIndex, ROOM_DIRTY);
    rooms[g.roomIndex].guestId = null;
  }

  g.state = "TO_EXIT";
  setTarget(g, centerOf(stExit));
}

function onArriveExit(g){
  g.state = "DONE";
  hideBubble();
  guestEl.classList.remove("angry");

  // If queue has guests AND there is a free room, allow next to proceed
  // (Room becomes FREE only after cleaning, so queue won't move until cleaned)
  maybeStartNextFromQueue();
}

function maybeStartNextFromQueue(){
  if (currentGuest && currentGuest.state !== "DONE") return;
  if (queue.length === 0) return;

  // Only move from queue if a room is FREE
  const freeRoom = findFreeRoomIndex();
  if (freeRoom === -1) return;

  currentGuest = queue.shift();
  updateRoomsUI();
  startGuestWalkIn(currentGuest); // they’ll re-check at reception and get a room
}

/* ---------- Bellboy auto serve ---------- */
function bellboyTryServe(){
  if (!currentGuest) return;
  if (bellboy.state !== "IDLE") return;

  const g = currentGuest;
  if (g.state !== "WAITING_FOR_ITEM") return;
  if (!g.currentRequest) return;

  bellboy.carrying = g.currentRequest;
  bellboy.state = "TO_SNACK";
  setTarget(bellboy, centerOf(stSnack));
}

function onBellboySnack(){
  bellboy.state = "TO_GUEST";
  // go to guest position
  setTarget(bellboy, { x: currentGuest.x, y: currentGuest.y });
}

function onBellboyGuest(){
  const g = currentGuest;
  if (g && g.state === "WAITING_FOR_ITEM" && g.currentRequest === bellboy.carrying){
    const def = ITEMS[bellboy.carrying];
    g.totalBonus += def.bonus;

    g.currentRequest = null;
    hideBubble();
    guestEl.classList.remove("angry");
    g.angry = false;

    setTimeout(() => startNextRequestOrCheckout(g), 450);
  }

  bellboy.carrying = null;
  bellboy.state = "RETURNING";
  setTarget(bellboy, centerOf(stSnack));
}

function onBellboyReturn(){
  bellboy.state = "IDLE";
}

/* ---------- Patience timer ---------- */
function updatePatience(){
  if (!currentGuest) return;
  const g = currentGuest;
  if (g.state !== "WAITING_FOR_ITEM" || !g.currentRequest) return;

  const total = ITEMS[g.currentRequest].seconds * 1000;
  const left = g.requestDeadline - Date.now();
  const pct = Math.max(0, Math.min(1, left / total));

  if (ringEl){
    ringEl.style.borderWidth = (3 + (1 - pct) * 2) + "px";
    ringEl.style.opacity = String(0.6 + (1 - pct) * 0.4);
  }

  if (left <= 0 && !g.angry){
    g.angry = true;
    guestEl.classList.add("angry");
    g.currentRequest = null;
    hideBubble();

    setTimeout(() => startNextRequestOrCheckout(g), 300);
  }
}

/* ---------- Cleaner manual system ---------- */
function updateCleanerModeText(){
  if (!cleanerModeEl) return;
  if (cleanerStep === "TAP_STATION") cleanerModeEl.textContent = "Tap 🧴 station";
  else cleanerModeEl.textContent = "Tap 🧺 dirty room";
}

function setCleanerCarry(on){
  cleaner.carrying = on;
  if (on){
    cleanerEl.classList.add("carrying");
    cleanerEl.dataset.carry = "🧴";
  } else {
    cleanerEl.classList.remove("carrying");
    cleanerEl.dataset.carry = "";
  }
}

function isRoomDirty(i){
  return rooms[i].status === ROOM_DIRTY;
}

function startCleaningRoom(i){
  // Must have detergent picked
  if (cleanerStep !== "TAP_ROOM") return;
  if (!cleaner.carrying) return;
  if (!isRoomDirty(i)) return;
  if (cleaner.state !== "GOT_DETERGENT" && cleaner.state !== "IDLE") return;

  cleaner.selectedRoom = i;
  cleaner.state = "TO_ROOM";
  setTarget(cleaner, centerOf(roomEls[i]));
}

function onCleanerArriveRoom(){
  cleaner.state = "CLEANING";
  // cleaning time (can later upgrade)
  cleaner.cleanDoneAt = Date.now() + 6000; // 6 seconds
}

function finishCleaning(){
  const i = cleaner.selectedRoom;
  if (i !== null){
    setRoomStatus(i, ROOM_FREE);
    rooms[i].guestId = null;
  }

  cleaner.selectedRoom = null;
  cleaner.state = "RETURNING";
  setTarget(cleaner, centerOf(stClean));
}

function onCleanerReturn(){
  cleaner.state = "IDLE";
  setCleanerCarry(false);
  cleanerStep = "TAP_STATION";
  updateCleanerModeText();

  // now queue may move if a room became free
  maybeStartNextFromQueue();
}

/* Tap station -> pick detergent */
stClean?.addEventListener("click", () => {
  if (cleanerStep !== "TAP_STATION") return;
  if (cleaner.state !== "IDLE") return;

  cleaner.state = "GOT_DETERGENT";
  setCleanerCarry(true);
  cleanerStep = "TAP_ROOM";
  updateCleanerModeText();
});

/* Tap rooms -> clean if dirty */
roomEls.forEach((el, i) => {
  el?.addEventListener("click", () => startCleaningRoom(i));
});

/* ---------- Spawning ---------- */
function spawnGuest(){
  const g = makeGuest(nextGuestId++);
  // Only one visible guest token; but queue stores extra guests “logically”
  // If no current guest, animate this one; else just queue it at reception immediately
  if (!currentGuest || currentGuest.state === "DONE" || currentGuest.state === "IDLE"){
    currentGuest = g;
    // place at entrance
    g.x = 10; g.y = 10;
    g.target = null;
    guestEl.classList.remove("angry");
    hideBubble();
    startGuestWalkIn(g);
  } else {
    // push into queue immediately (they are “waiting”)
    g.state = "QUEUED";
    queue.push(g);
    updateRoomsUI();
  }
}

spawnGuestBtn?.addEventListener("click", spawnGuest);

/* ---------- Loop ---------- */
function loop(){
  // Guest movement
  if (currentGuest){
    const arrived = moveToward(currentGuest);
    setPos(guestEl, currentGuest.x, currentGuest.y);

    if (arrived){
      if (currentGuest.state === "TO_RECEPTION") onArriveReception(currentGuest);
      else if (currentGuest.state === "TO_ROOM") onArriveRoom(currentGuest);
      else if (currentGuest.state === "TO_PAY") onArrivePay(currentGuest);
      else if (currentGuest.state === "TO_EXIT") onArriveExit(currentGuest);
    }
  }

  // Bellboy movement
  const bellArrived = moveToward(bellboy);
  setPos(bellboyEl, bellboy.x, bellboy.y);
  if (bellArrived){
    if (bellboy.state === "TO_SNACK") onBellboySnack();
    else if (bellboy.state === "TO_GUEST") onBellboyGuest();
    else if (bellboy.state === "RETURNING") onBellboyReturn();
  }

  // Cleaner movement
  const cleanArrived = moveToward(cleaner);
  setPos(cleanerEl, cleaner.x, cleaner.y);
  if (cleanArrived){
    if (cleaner.state === "TO_ROOM") onCleanerArriveRoom();
    else if (cleaner.state === "RETURNING") onCleanerReturn();
  }

  // Cleaner cleaning timer
  if (cleaner.state === "CLEANING" && Date.now() >= cleaner.cleanDoneAt){
    finishCleaning();
  }

  // Patience + auto-bellboy serve
  updatePatience();
  bellboyTryServe();

  requestAnimationFrame(loop);
}

/* ---------- Start ---------- */
function start(){
  if (!mapEl) return;

  ensureBubble();

  // init badges
  for (let i = 0; i < 4; i++){
    setRoomStatus(i, ROOM_FREE);
  }

  servedEl.textContent = "0";
  hotelCashEl.textContent = "0";
  queueCountEl.textContent = "0";
  updateRoomsUI();

  // initial positions
  setPos(guestEl, 10, 10);
  setPos(bellboyEl, bellboy.x, bellboy.y);
  setPos(cleanerEl, cleaner.x, cleaner.y);
  setCleanerCarry(false);

  loop();
}
start();


