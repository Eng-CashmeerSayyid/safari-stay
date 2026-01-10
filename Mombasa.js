// Safari Stay – Mombasa (Bulletproof init)

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

// ================== ROOMS (4 DOORS) ==================
const ROOM_KEYS = ["door2L","door2R","door3L","door3R"];
const GUEST_STAY_MS = 10000;
const CLEAN_MS = 3000;

// state: "empty" | "occupied" | "dirty" | "cleaning"
let rooms = getJSON("mombasaRoomsState", ROOM_KEYS.map(()=>({
  state:"empty", wantsSnack:false, stayEndsAt:0, cleanEndsAt:0
})));

let coins  = getNum("coins", 0);
let queue  = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

let selectedSpot = null;

// ================== HELPERS ==================
function save(){
  setNum("coins", coins);
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRoomsState", rooms);
}
function isDoor(spot){ return ROOM_KEYS.includes(spot); }
function roomIndex(spot){ return ROOM_KEYS.indexOf(spot); }
function findEmptyRoom(){ return rooms.findIndex(r => r.state === "empty"); }

// ================== INIT AFTER PAGE LOAD ==================
document.addEventListener("DOMContentLoaded", () => {
  // Grab UI safely AFTER DOM exists
  const uiCoins  = document.getElementById("coins");
  const uiQueue  = document.getElementById("queue");
  const uiServed = document.getElementById("served");
  const hint     = document.getElementById("hint");
  const bubble   = document.getElementById("bubble");

  const btnSpawn  = document.getElementById("btnSpawn");
  const btnDeliver= document.getElementById("btnDeliver");
  const btnClean  = document.getElementById("btnClean");

  // If any key element is missing, show it clearly
  if (!uiCoins || !uiQueue || !uiServed || !hint || !btnSpawn || !btnDeliver || !btnClean) {
    alert("Missing IDs in HTML. Check: coins, queue, served, hint, btnSpawn, btnDeliver, btnClean.");
    return;
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

  function applyDoorStyles(){
  ROOM_KEYS.forEach((k, i) => {
    const btn = document.querySelector(`.hotspot[data-spot="${k}"]`);
    if (!btn) return;

    // state classes (keep these)
    btn.classList.remove("state-empty","state-occupied","state-dirty","state-cleaning");
    btn.classList.add(`state-${rooms[i].state}`);

    // OPEN/CLOSE animation class (NEW)
    if (rooms[i].state === "empty") btn.classList.remove("closed");
    else btn.classList.add("closed");
  });
}


  // Make door states visible even without debug
  (function injectStateCSS(){
    const css = `
      .state-empty{ border-color: rgba(255,255,255,.10); background: rgba(255,255,255,.02); }
      .state-occupied{ border-color: rgba(125,255,178,.85); background: rgba(125,255,178,.12); }
      .state-dirty{ border-color: rgba(255,123,123,.9); background: rgba(255,123,123,.14); }
      .state-cleaning{ border-color: rgba(101,214,255,.9); background: rgba(101,214,255,.14); }
      .hotspot.selected{ outline: 2px solid rgba(255,211,110,.95); outline-offset: 2px; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  function checkInGuest(){
    const idx = findEmptyRoom();
    if (idx === -1) {
      queue += 1;
      hint.textContent = "Hotel is full. Guest joined the queue.";
      showBubble("Queue +1");
      save(); renderHUD(); return;
    }

    rooms[idx].state = "occupied";
    applyDoorStyles(); // close instantly
    rooms[idx].wantsSnack = Math.random() < 0.45;
    rooms[idx].stayEndsAt = Date.now() + GUEST_STAY_MS;

    hint.textContent = `Guest checked into ${ROOM_KEYS[idx]}${rooms[idx].wantsSnack ? " and ordered snacks 🛎️" : ""}`;
    showBubble("Checked in");
    save(); renderHUD(); applyDoorStyles();
  }

  function deliverSnackToSelected(){
    if (!isDoor(selectedSpot)) return hint.textContent = "Select a DOOR to deliver.";
    const r = rooms[roomIndex(selectedSpot)];
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
    const r = rooms[roomIndex(selectedSpot)];
    if (r.state !== "dirty") return hint.textContent = "Room is not dirty yet.";

    r.state = "cleaning";
    r.cleanEndsAt = Date.now() + CLEAN_MS;
    hint.textContent = `Cleaning ${selectedSpot}... (3s)`;
    showBubble("🧼 Cleaning");
    save(); renderHUD(); applyDoorStyles();
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
        showBubble("✅ Guest left");
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
        showBubble("✨ Clean!");
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

  // Hotspot selection
  function clearSelected(){
    document.querySelectorAll(".hotspot").forEach(b => b.classList.remove("selected"));
    selectedSpot = null;
  }
  document.querySelectorAll(".hotspot").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
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

  // Buttons
  btnSpawn.addEventListener("click", checkInGuest);
  btnDeliver.addEventListener("click", deliverSnackToSelected);
  btnClean.addEventListener("click", cleanSelectedRoom);

  // Loop
  setInterval(() => {
    checkoutIfDue();
    finishCleaningIfDue();
    fillFromQueue();
    save(); renderHUD(); applyDoorStyles();
  }, 350);

  // Init UI
  renderHUD();
  applyDoorStyles();
  save();
  hint.textContent = "JS Loaded ✅ Tap ➕ Add Guest.";
});
