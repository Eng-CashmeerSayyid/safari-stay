/* ================================
   SAFARI STAY – MOMBASA HOTEL
   ================================ */

const $ = (sel) => document.querySelector(sel);
const hotelGrid = $("#hotelGrid");
const coinsEl = $("#coins");
const cleanersEl = $("#cleaners");
const queueEl = $("#queue");
const bellboyEl = $("#bellboy");
const toastEl = $("#toast");
const selectedItemEl = $("#selectedItem");
const cleanerCostEl = $("#cleanerCost");
const menuEl = $("#menu");

const GUEST_STAY_MS = 10000;  // 10s
const CLEAN_TIME_MS = 3000;   // 3s

// ---- MENU / ITEMS ----
const MENU = [
  { key: "juice", label: "🥤 Juice", price: 5 },
  { key: "chips", label: "🍟 Chips", price: 6 },
  { key: "coffee", label: "☕ Coffee", price: 7 },
];

// ---- SAVE KEYS ----
const KEY = {
  coins: "mombasaCoins",
  queue: "mombasaQueue",
  rooms: "mombasaRoomsState",
  cleaners: "mombasaCleanersOwned",
};

// ---- STATE ----
let coins = Number(localStorage.getItem(KEY.coins)) || 0;
let queue = Number(localStorage.getItem(KEY.queue)) || 0;

// start with 1 cleaner
let cleanersOwned = Number(localStorage.getItem(KEY.cleaners)) || 1;

// selected menu item (for delivery flow)
let selectedItemKey = null;

// bellboy state
let bellboy = {
  isBusy: false,
  deliveringToRoomId: null,
  itemKey: null,
};

// cleaning concurrency tracking
let cleaningInProgress = 0;

// room model:
// { id, status: "clean"|"occupied"|"dirty"|"cleaning", guestId: number|null, order: {itemKey, status:"waiting"|"delivered"}|null, timers: {stayTimeout}|null }
let rooms = loadRooms() || [
  mkRoom(1), mkRoom(2), mkRoom(3), mkRoom(4),
];

// guest counter
let guestSeq = 1;

// =============================
// INIT
// =============================
(function init(){
  buildMenuUI();
  wireButtons();
  renderHotel();

  // auto spawn a guest every ~12s (optional vibe)
  // comment this out if you don't want auto flow:
  setInterval(() => {
    if (Math.random() < 0.55) spawnGuest();
  }, 12000);

  // attempt check-in loop
  setInterval(() => {
    tryAssignGuestsToRooms();
  }, 800);

})();

// =============================
// HELPERS
// =============================
function mkRoom(id){
  return { id, status:"clean", guestId:null, order:null, timers:null };
}

function loadRooms(){
  try{
    const raw = localStorage.getItem(KEY.rooms);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // wipe timers (can't persist timeouts)
    parsed.forEach(r => r.timers = null);
    return parsed;
  }catch(e){
    return null;
  }
}

function saveAll(){
  localStorage.setItem(KEY.coins, String(coins));
  localStorage.setItem(KEY.queue, String(queue));
  localStorage.setItem(KEY.cleaners, String(cleanersOwned));
  localStorage.setItem(KEY.rooms, JSON.stringify(rooms));
}

function toast(msg){
  toastEl.style.display = "block";
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.style.display = "none";
  }, 2200);
}

function cleanerUpgradeCost(){
  // cost scales with cleaners
  return 80 * cleanersOwned;
}

function bellboyStatusText(){
  if (!bellboy.isBusy) return "Ready";
  return `Delivering… (Room ${bellboy.deliveringToRoomId})`;
}

function roomBadgeClass(status){
  if (status === "clean") return "clean";
  if (status === "dirty") return "dirty";
  if (status === "cleaning") return "cleaning";
  if (status === "occupied") return "occupied";
  return "";
}

function roomBadgeLabel(status){
  if (status === "clean") return "CLEAN";
  if (status === "dirty") return "DIRTY";
  if (status === "cleaning") return "CLEANING";
  if (status === "occupied") return "OCCUPIED";
  return status.toUpperCase();
}

function canStartCleaning(){
  return cleaningInProgress < cleanersOwned;
}

// =============================
// UI BUILD
// =============================
function buildMenuUI(){
  menuEl.innerHTML = "";
  MENU.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = `${item.label} (+${item.price})`;
    btn.addEventListener("click", () => selectMenuItem(item.key));
    menuEl.appendChild(btn);
  });
}

function wireButtons(){
  $("#btnSpawn").addEventListener("click", spawnGuest);
  $("#btnHireCleaner").addEventListener("click", upgradeCleaner);

  $("#btnReset").addEventListener("click", () => {
    localStorage.removeItem(KEY.coins);
    localStorage.removeItem(KEY.queue);
    localStorage.removeItem(KEY.rooms);
    localStorage.removeItem(KEY.cleaners);
    location.reload();
  });
}

// =============================
// CORE GAMEPLAY
// =============================
function spawnGuest(){
  queue++;
  saveAll();
  renderHotel();
  toast("Guest arrived in queue ✅");
  tryAssignGuestsToRooms();
}

function tryAssignGuestsToRooms(){
  if (queue <= 0) return;

  // assign guests only to CLEAN rooms
  const freeRoom = rooms.find(r => r.status === "clean" && r.guestId === null);
  if (!freeRoom) return;

  queue--;
  checkInGuest(freeRoom.id);
  saveAll();
  renderHotel();
}

function checkInGuest(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  room.status = "occupied";
  room.guestId = guestSeq++;
  room.order = null;

  // schedule stay end
  if (!room.timers) room.timers = {};
  room.timers.stayTimeout = setTimeout(() => {
    guestCheckout(roomId);
  }, GUEST_STAY_MS);

  // maybe create order later
  setTimeout(() => maybeCreateOrderForRoom(roomId), 2000 + Math.random()*3000);
}

function guestCheckout(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  // if room already changed, ignore
  if (room.status !== "occupied") return;

  // earn coins for successful stay
  coins += 10;

  // guest leaves
  room.status = "dirty";
  room.guestId = null;

  // keep order shown only if waiting? nah, clear it when guest leaves
  room.order = null;

  // clear timers
  if (room.timers?.stayTimeout) clearTimeout(room.timers.stayTimeout);
  room.timers = null;

  saveAll();
  renderHotel();
  toast(`Guest checked out. Room ${roomId} is DIRTY 🧼`);
}

function startCleaning(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (room.status !== "dirty"){
    toast(`Room ${roomId} is not dirty.`);
    return;
  }

  if (!canStartCleaning()){
    toast(`All cleaners are busy. Upgrade to clean multiple rooms.`);
    return;
  }

  room.status = "cleaning";
  cleaningInProgress++;
  saveAll();
  renderHotel();

  setTimeout(() => {
    room.status = "clean";
    cleaningInProgress = Math.max(0, cleaningInProgress - 1);
    saveAll();
    renderHotel();
    toast(`Room ${roomId} is clean ✅`);
    tryAssignGuestsToRooms();
  }, CLEAN_TIME_MS);
}

function upgradeCleaner(){
  const cost = cleanerUpgradeCost();
  if (coins < cost){
    toast(`Need ${cost} coins to hire another cleaner.`);
    return;
  }
  coins -= cost;
  cleanersOwned++;
  saveAll();
  renderHotel();
  toast(`Cleaner hired! You now have ${cleanersOwned} cleaner(s).`);
}

// =============================
// ORDERS + BELLBOY DELIVERY
// =============================
function maybeCreateOrderForRoom(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  // only guests in occupied rooms can order
  if (room.status !== "occupied") return;

  // don't spam orders
  if (room.order && room.order.status === "waiting") return;

  // chance to order (not all guests)
  if (Math.random() > 0.35) return; // 35%

  const item = MENU[Math.floor(Math.random() * MENU.length)];
  room.order = { itemKey: item.key, status:"waiting" };

  saveAll();
  renderHotel();
  toast(`Room ${roomId} ordered ${item.label}`);
}

function selectMenuItem(itemKey){
  if (!MENU.find(m => m.key === itemKey)) return;

  selectedItemKey = itemKey;
  const item = MENU.find(m => m.key === itemKey);
  selectedItemEl.textContent = item ? item.label : "None";
  renderHotel();
  toast(`Selected ${item.label}. Now click the room to deliver.`);
}

function onRoomClicked(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  // if player selected an item, treat room click as delivery attempt
  if (selectedItemKey){
    attemptDelivery(roomId);
    return;
  }

  // otherwise, just show helpful tip
  if (room.status === "dirty") toast(`Room ${roomId} is dirty. Click CLEAN.`);
  else if (room.status === "clean") toast(`Room ${roomId} is clean. Waiting for guests.`);
  else if (room.status === "occupied") toast(`Room ${roomId} is occupied.`);
  else if (room.status === "cleaning") toast(`Room ${roomId} is being cleaned.`);
}

function attemptDelivery(roomId){
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (bellboy.isBusy){
    toast("Bellboy is busy delivering another order.");
    return;
  }

  if (room.status !== "occupied"){
    toast("No guest here to receive the order.");
    return;
  }

  if (!room.order || room.order.status !== "waiting"){
    toast("This room has no waiting order.");
    return;
  }

  // must match ordered item
  if (room.order.itemKey !== selectedItemKey){
    const orderedLabel = MENU.find(m => m.key === room.order.itemKey)?.label || room.order.itemKey;
    toast(`Wrong item. Guest ordered ${orderedLabel}.`);
    return;
  }

  // start delivery
  bellboy.isBusy = true;
  bellboy.deliveringToRoomId = roomId;
  bellboy.itemKey = selectedItemKey;

  // clear selection after starting
  selectedItemKey = null;
  selectedItemEl.textContent = "None";
  saveAll();
  renderHotel();

  toast("Bellboy delivering… 🤵");

  setTimeout(() => {
    // finish
    room.order.status = "delivered";
    const earn = MENU.find(m => m.key === bellboy.itemKey)?.price || 0;
    coins += earn;

    bellboy.isBusy = false;
    bellboy.deliveringToRoomId = null;
    bellboy.itemKey = null;

    saveAll();
    renderHotel();
    toast(`Delivered ✅ +${earn} coins`);
  }, 1200);
}

// =============================
// RENDER
// =============================
function renderHotel(){
  coinsEl.textContent = coins;
  cleanersEl.textContent = cleanersOwned;
  queueEl.textContent = queue;
  bellboyEl.textContent = bellboyStatusText();
  cleanerCostEl.textContent = `Cost: ${cleanerUpgradeCost()}`;

  hotelGrid.innerHTML = "";

  rooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "room";
    card.addEventListener("click", () => onRoomClicked(room.id));

    const header = document.createElement("div");
    header.className = "roomHeader";

    const name = document.createElement("div");
    name.className = "roomName";
    name.textContent = `Room ${room.id}`;

    const badge = document.createElement("div");
    badge.className = `badge ${roomBadgeClass(room.status)}`;
    badge.textContent = roomBadgeLabel(room.status);

    header.appendChild(name);
    header.appendChild(badge);

    const body = document.createElement("div");
    body.className = "roomBody";

    const left = document.createElement("div");
    left.className = "roomLeft";

    const emoji = document.createElement("div");
    emoji.className = "emoji";
    emoji.textContent =
      room.status === "occupied" ? "🧳" :
      room.status === "dirty" ? "🧼" :
      room.status === "cleaning" ? "🫧" :
      "🛏️";

    const guestLine = document.createElement("div");
    guestLine.className = "guestLine";
    guestLine.textContent =
      room.status === "occupied" ? `Guest #${room.guestId}` :
      room.status === "dirty" ? "Needs cleaning" :
      room.status === "cleaning" ? "Cleaning..." :
      "Available";

    left.appendChild(emoji);
    left.appendChild(guestLine);

    const right = document.createElement("div");
    right.className = "roomRight";

    // order tag
    const orderTag = document.createElement("div");
    orderTag.className = "orderTag";

    if (room.status === "occupied" && room.order && room.order.status === "waiting"){
      const label = MENU.find(m => m.key === room.order.itemKey)?.label || room.order.itemKey;
      orderTag.textContent = `Order: ${label} (click snack then click room)`;
    } else if (room.status === "occupied") {
      orderTag.textContent = "No order yet";
      orderTag.style.opacity = "0.75";
    } else {
      orderTag.textContent = "—";
      orderTag.style.opacity = "0.5";
    }

    // clean button
    const cleanBtn = document.createElement("button");
    cleanBtn.className = "roomBtn";
    cleanBtn.textContent =
      room.status === "dirty" ? "🧹 CLEAN" :
      room.status === "cleaning" ? "Cleaning…" :
      "Clean";

    cleanBtn.disabled = !(room.status === "dirty" && canStartCleaning());

    // stop click bubbling so room click doesn't trigger delivery tip when clicking button
    cleanBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startCleaning(room.id);
    });

    right.appendChild(orderTag);
    right.appendChild(cleanBtn);

    body.appendChild(left);
    body.appendChild(right);

    card.appendChild(header);
    card.appendChild(body);

    hotelGrid.appendChild(card);
  });
}
