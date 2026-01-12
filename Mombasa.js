// ================== STORAGE ==================
const getNum = (k, fb=0) => {
  const v = Number(localStorage.getItem(k));
  return Number.isFinite(v) ? v : fb;
};
const setNum = (k, v) => localStorage.setItem(k, String(v));
const getJSON = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fb; }
  catch { return fb; }
};
const setJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ================== HUD ==================
let coins  = getNum("coins", 0);
let queue  = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

const uiCoins  = document.getElementById("coins");
const uiQueue  = document.getElementById("queue");
const uiServed = document.getElementById("served");
const hint     = document.getElementById("hint");
const bubble   = document.getElementById("bubble");

// ================== ROOMS ==================
const ROOM_KEYS = ["door2L","door2R","door3L","door3R"];
let rooms = getJSON("mombasaRoomsState", ROOM_KEYS.map(()=>({
  state:"empty",
  wantsSnack:false,
  stayEndsAt:0,
  cleanEndsAt:0
})));

let selectedSpot = null;

// ================== HELPERS ==================
function save(){
  setNum("coins", coins);
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRoomsState", rooms);
}

function renderHUD(){
  uiCoins.textContent  = coins;
  uiQueue.textContent  = queue;
  uiServed.textContent = served;
}

function showBubble(msg){
  if (!bubble) return;
  bubble.textContent = msg;
  bubble.hidden = false;
  clearTimeout(showBubble._t);
  showBubble._t = setTimeout(()=> bubble.hidden = true, 1200);
}

function isDoor(spot){ return ROOM_KEYS.includes(spot); }
function roomIndex(spot){ return ROOM_KEYS.indexOf(spot); }

// ================== DOOR STYLES ==================
function applyDoorStyles(){
  ROOM_KEYS.forEach((k, i) => {
    const btn = document.querySelector(`.hotspot[data-spot="${k}"]`);
    if (!btn) return;

    btn.classList.remove("state-empty","state-occupied","state-dirty","state-cleaning");
    btn.classList.add(`state-${rooms[i].state}`);

    // LUXURY DOOR open / close
    if (rooms[i].state === "empty") btn.classList.remove("closed");
    else btn.classList.add("closed");
  });
}

// ================== GAME LOOP ==================
const GUEST_STAY_MS = 10000;
const CLEAN_MS      = 3000;

function findEmptyRoom(){
  return rooms.findIndex(r => r.state === "empty");
}

function checkInGuest(){
  const idx = findEmptyRoom();

  if (idx === -1) {
    queue += 1;
    hint.textContent = "All rooms are busy. Guest joined queue.";
    showBubble("Queue +1");
    save(); renderHUD(); return;
  }

  rooms[idx].state = "occupied";
  rooms[idx].wantsSnack = Math.random() < 0.45;
  rooms[idx].stayEndsAt = Date.now() + GUEST_STAY_MS;

  applyDoorStyles(); // 🔒 CLOSES DOOR INSTANTLY

  hint.textContent = `Guest checked into ${ROOM_KEYS[idx]}${rooms[idx].wantsSnack ? " and ordered snacks 🛎️" : ""}`;
  showBubble("Checked in");
  save(); renderHUD();
}

function checkoutIfDue(){
  const now = Date.now();
  rooms.forEach((r) => {
    if (r.state === "occupied" && r.stayEndsAt && now >= r.stayEndsAt) {
      r.state = "dirty";
      r.wantsSnack = false;
      r.stayEndsAt = 0;
      served += 1;
      coins += 1;
      showBubble("Guest left");
    }
  });
}

function finishCleaningIfDue(){
  const now = Date.now();
  rooms.forEach((r) => {
    if (r.state === "cleaning" && r.cleanEndsAt && now >= r.cleanEndsAt) {
      r.state = "empty";
      r.cleanEndsAt = 0;
      coins += 2;
      showBubble("Room clean");
    }
  });
}

function fillFromQueue(){
  while(queue > 0){
    const idx = findEmptyRoom();
    if (idx === -1) break;

    queue -= 1;
    rooms[idx].state = "occupied";
    rooms[idx].wantsSnack = Math.random() < 0.45;
    rooms[idx].stayEndsAt = Date.now() + GUEST_STAY_MS;
    showBubble("Queue → Room");
  }
}

// ================== ACTIONS ==================
function deliverSnackToSelected(){
  if (!isDoor(selectedSpot)) return hint.textContent = "Select a DOOR to deliver.";

  const r = rooms[roomIndex(selectedSpot)];

  if (r.state !== "occupied") return hint.textContent = "Room not occupied.";
  if (!r.wantsSnack) return hint.textContent = "No snack ordered.";

  r.wantsSnack = false;
  coins += 5;
  hint.textContent = `Snack delivered 😍 +5 coins`;
  showBubble("Delivered");
  save(); renderHUD();
}

function cleanSelectedRoom(){
  if (!isDoor(selectedSpot)) return hint.textContent = "Select a DOOR to clean.";

  const r = rooms[roomIndex(selectedSpot)];

  if (r.state !== "dirty") return hint.textContent = "Room is not dirty.";

  r.state = "cleaning";
  r.cleanEndsAt = Date.now() + CLEAN_MS;

  applyDoorStyles();

  hint.textContent = `Cleaning...`;
  showBubble("Cleaning");
  save(); renderHUD();
}

// ================== HOTSPOT SELECTION ==================
function clearSelected(){
  document.querySelectorAll(".hotspot").forEach(b => b.classList.remove("selected"));
  selectedSpot = null;
}

document.querySelectorAll(".hotspot").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearSelected();
    btn.classList.add("selected");
    selectedSpot = btn.dataset.spot;

    if (isDoor(selectedSpot)) {
      const r = rooms[roomIndex(selectedSpot)];
      hint.textContent =
        `${selectedSpot} → ${r.state}` +
        (r.state === "occupied" && r.wantsSnack ? " (ordered snacks 🛎️)" : "");
    } else {
      hint.textContent = `Selected: ${selectedSpot}`;
    }
  });
});

// ================== BUTTONS ==================
document.getElementById("btnSpawn").addEventListener("click", checkInGuest);
document.getElementById("btnDeliver").addEventListener("click", deliverSnackToSelected);
document.getElementById("btnClean").addEventListener("click", cleanSelectedRoom);

// ================== MAIN LOOP ==================
setInterval(() => {
  checkoutIfDue();
  finishCleaningIfDue();
  fillFromQueue();
  save(); renderHUD(); applyDoorStyles();
}, 350);

// ================== INIT ==================
renderHUD();
applyDoorStyles();
save();
