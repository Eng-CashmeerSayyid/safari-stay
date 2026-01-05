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

// ================== ROOMS (4 DOORS) ==================
const ROOM_KEYS = ["door2L","door2R","door3L","door3R"];
// state: "empty" | "occupied" | "dirty" | "cleaning"
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

// Update door button visual by state (simple border tints)
function applyDoorStyles(){
  ROOM_KEYS.forEach((k, i) => {
    const btn = document.querySelector(`.hotspot[data-spot="${k}"]`);
    if (!btn) return;

    btn.classList.remove("state-empty","state-occupied","state-dirty","state-cleaning");
    btn.classList.add(`state-${rooms[i].state}`);
  });
}

// Add these state styles dynamically (visible even when debug is OFF)
(function injectStateCSS(){
  const css = `
  /* Door states ALWAYS visible now */
  .state-empty{
    border-color: rgba(255,255,255,.10);
    background: rgba(255,255,255,.02);
  }
  .state-occupied{
    border-color: rgba(125,255,178,.85);
    background: rgba(125,255,178,.12);
  }
  .state-dirty{
    border-color: rgba(255,123,123,.9);
    background: rgba(255,123,123,.14);
  }
  .state-cleaning{
    border-color: rgba(101,214,255,.9);
    background: rgba(101,214,255,.14);
  }

  /* When selected, stronger glow */
  .hotspot.selected{
    outline: 2px solid rgba(255,211,110,.95);
    outline-offset: 2px;
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();


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
    hint.textContent = "Hotel is full. Guest joined the queue.";
    showBubble("Queue +1");
    save(); renderHUD(); return;
  }

  rooms[idx].state = "occupied";
  rooms[idx].wantsSnack = Math.random() < 0.45; // not everyone orders
  rooms[idx].stayEndsAt = Date.now() + GUEST_STAY_MS;

  hint.textContent = `Guest checked into ${ROOM_KEYS[idx]}${rooms[idx].wantsSnack ? " and ordered snacks 🛎️" : ""}`;
  showBubble("Checked in");
  save(); renderHUD(); applyDoorStyles();
}

// When a guest leaves, room becomes dirty
function checkoutIfDue(){
  const now = Date.now();
  rooms.forEach((r) => {
    if (r.state === "occupied" && r.stayEndsAt && now >= r.stayEndsAt) {
      r.state = "dirty";
      r.wantsSnack = false;
      r.stayEndsAt = 0;
      served += 1;
      coins += 1; // reward for serving a full stay
      showBubble("✅ Guest left");
    }
  });
}

// Cleaning completion
function finishCleaningIfDue(){
  const now = Date.now();
  rooms.forEach((r) => {
    if (r.state === "cleaning" && r.cleanEndsAt && now >= r.cleanEndsAt) {
      r.state = "empty";
      r.cleanEndsAt = 0;
      coins += 2;
      showBubble("✨ Clean!");
    }
  });
}

// Move queue into empty rooms
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

// Main tick
setInterval(() => {
  checkoutIfDue();
  finishCleaningIfDue();
  fillFromQueue();
  save(); renderHUD(); applyDoorStyles();
}, 350);

// ================== ACTIONS ==================
function deliverSnackToSelected(){
  if (!isDoor(selectedSpot)) return hint.textContent = "Select a DOOR to deliver.";

  const idx = roomIndex(selectedSpot);
  const r = rooms[idx];

  if (r.state !== "occupied") return hint.textContent = "That room is not occupied.";
  if (!r.wantsSnack) return hint.textContent = "That guest did not order snacks.";

  r.wantsSnack = false;
  coins += 5;
  hint.textContent = `Delivered snacks to ${selectedSpot} 😍 +5 coins`;
  showBubble("🛎️ Delivered");
  save(); renderHUD(); applyDoorStyles();
}

function cleanSelectedRoom(){
  if (!isDoor(selectedSpot)) return hint.textContent = "Select a DOOR to clean.";

  const idx = roomIndex(selectedSpot);
  const r = rooms[idx];

  if (r.state !== "dirty") return hint.textContent = "Room is not dirty yet.";

  r.state = "cleaning";
  r.cleanEndsAt = Date.now() + CLEAN_MS;

  hint.textContent = `Cleaning ${selectedSpot}... (3s)`;
  showBubble("🧼 Cleaning");
  save(); renderHUD(); applyDoorStyles();
}

// ================== HOTSPOT SELECTION + DEBUG ==================
const debugToggle = document.getElementById("debugHotspots");
const scene = document.querySelector(".scene");

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

debugToggle?.addEventListener("change", () => {
  scene?.classList.toggle("debug", debugToggle.checked);
});

// Buttons
document.getElementById("btnSpawn").addEventListener("click", checkInGuest);
document.getElementById("btnDeliver").addEventListener("click", deliverSnackToSelected);
document.getElementById("btnClean").addEventListener("click", cleanSelectedRoom);

// Init
renderHUD();
applyDoorStyles();
save();

