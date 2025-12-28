/* ==========================================
   SAFARI STAY – HOTEL MANIA (Top-down)
   - Guests may request: 🥤 soda, 🥥 coconut, 🍍 pineapple
   - Some guests request nothing
   - Some request multiple items
   - 🍍 takes longer but pays more
   - AUTO bellboy: serves requests automatically
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
const hotelCashEl = document.getElementById("hotelCash");
const spawnGuestBtn = document.getElementById("spawnGuestBtn");

/* ---------- Map + stations ---------- */
const mapEl = document.getElementById("hotelMap");
const stReception = document.getElementById("stReception");
const stSnack = document.getElementById("stSnack");
const stRoom = document.getElementById("stRoom");
const stExit = document.getElementById("stExit");

/* ---------- Characters ---------- */
const guestEl = document.getElementById("guest");
const bellboyEl = document.getElementById("bellboy");

/* ---------- Economy / Storage ---------- */
const COIN_KEY = "coins";

// Rewards
const BASE_PAY_COINS = 5;     // guest checkout base
const SERVICE_BONUS_SODA = 2; // extra coins when served soda
const SERVICE_BONUS_COCONUT = 3;
const SERVICE_BONUS_PINEAPPLE = 5; // pineapple pays more

/* ---------- Request definitions ---------- */
const ITEMS = {
  soda:     { icon:"🥤", seconds: 7,  bonus: SERVICE_BONUS_SODA },
  coconut:  { icon:"🥥", seconds: 8,  bonus: SERVICE_BONUS_COCONUT },
  pineapple:{ icon:"🍍", seconds: 12, bonus: SERVICE_BONUS_PINEAPPLE } // ✅ slower + pays more
};
const ITEM_KEYS = Object.keys(ITEMS);

/* ---------- Game state ---------- */
let served = 0;
let hotelCash = 0;

/* Guest is a state machine */
let guest = {
  x: 10, y: 10,
  speed: 2.0,
  state: "IDLE",
  target: null,

  // request system
  requests: [],          // array of item keys
  currentRequest: null,  // item key being waited on
  requestDeadline: 0,    // timestamp ms when patience ends
  totalBonus: 0,         // bonuses earned from served items
  angry: false
};

let bellboy = {
  x: 260, y: 260,
  speed: 2.5,
  state: "IDLE",         // IDLE, TO_SNACK, TO_GUEST, RETURNING
  target: null,
  carrying: null,        // item key
};

let rafStarted = false;

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
  bubbleEl.firstChild.textContent = ""; // ring stays
  bubbleEl.childNodes.forEach(n => {
    if (n !== ringEl) bubbleEl.removeChild(n);
  });
  const iconNode = document.createElement("div");
  iconNode.textContent = icon;
  bubbleEl.appendChild(iconNode);
}
function hideBubble(){
  ensureBubble();
  bubbleEl.style.display = "none";
}

/* ---------- Position helpers ---------- */
function setPos(el, x, y){
  el.style.left = x + "px";
  el.style.top  = y + "px";
}
function centerOf(el){
  const mapRect = mapEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - mapRect.left) + r.width/2 - 22,
    y: (r.top  - mapRect.top)  + r.height/2 - 22
  };
}
function setGuestTarget(p){ guest.target = p; }
function setBellTarget(p){ bellboy.target = p; }

/* ---------- Movement ---------- */
function moveEntityToward(entity){
  if (!entity.target) return false;

  const dx = entity.target.x - entity.x;
  const dy = entity.target.y - entity.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2) {
    entity.x = entity.target.x;
    entity.y = entity.target.y;
    entity.target = null;
    return true; // arrived
  }

  const step = entity.speed;
  entity.x += (dx / dist) * step;
  entity.y += (dy / dist) * step;
  return false;
}

/* ---------- Random request logic ---------- */
/*
  Some guests ask for nothing.
  Some ask 1 item.
  Some ask 2 items.
  Some ask 3 items.
*/
function rollRequests(){
  // probabilities
  const r = Math.random();
  let count = 0;

  if (r < 0.30) count = 0;        // 30% asks nothing
  else if (r < 0.70) count = 1;   // 40% asks 1
  else if (r < 0.92) count = 2;   // 22% asks 2
  else count = 3;                // 8% asks 3

  const picks = [];
  for (let i = 0; i < count; i++){
    const key = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    picks.push(key);
  }
  return picks;
}

/* ---------- Guest State Flow ---------- */
function guestArriveFlow(){
  // entrance -> reception -> room -> maybe requests -> checkout -> exit
  guest.state = "TO_RECEPTION";
  setTimeout(() => setGuestTarget(centerOf(stReception)), 60);
}

function onGuestArrivedAtReception(){
  guest.state = "TO_ROOM";
  setTimeout(() => setGuestTarget(centerOf(stRoom)), 60);
}

function startNextRequestOrCheckout(){
  // decide requests once per guest stay
  if (guest.requests.length === 0) {
    // No requests — go checkout
    guest.state = "TO_PAY";
    hideBubble();
    guestEl.classList.remove("angry");
    guest.angry = false;
    setTimeout(() => setGuestTarget(centerOf(stReception)), 60);
    return;
  }

  // next item
  const next = guest.requests.shift();
  guest.currentRequest = next;

  const def = ITEMS[next];
  guest.requestDeadline = Date.now() + def.seconds * 1000;
  guest.state = "WAITING_FOR_ITEM";
  guest.angry = false;
  guestEl.classList.remove("angry");

  showBubble(def.icon);
}

function onGuestArrivedAtRoom(){
  // roll requests here (once)
  guest.requests = rollRequests();
  guest.totalBonus = 0;
  guest.currentRequest = null;

  // some guests ask for nothing, some multiple
  startNextRequestOrCheckout();
}

function onGuestArrivedToPay(){
  // payout depends on how well we served
  served += 1;

  // base + bonus (if angry, reduce base)
  const base = guest.angry ? Math.max(1, BASE_PAY_COINS - 3) : BASE_PAY_COINS;
  const payCoins = base + guest.totalBonus;

  hotelCash += payCoins;
  servedEl.textContent = served;
  hotelCashEl.textContent = hotelCash;

  // Add to global coins (shared with puzzle)
  const currentCoins = Number(localStorage.getItem(COIN_KEY)) || 0;
  localStorage.setItem(COIN_KEY, String(currentCoins + payCoins));

  guest.state = "TO_EXIT";
  setTimeout(() => setGuestTarget(centerOf(stExit)), 60);
}

function onGuestExit(){
  guest.state = "IDLE";
  hideBubble();
  guestEl.classList.remove("angry");
}

/* ---------- Bellboy AUTO logic ---------- */
function bellboyTryServe(){
  // only serve if guest is waiting and bellboy is idle
  if (bellboy.state !== "IDLE") return;
  if (guest.state !== "WAITING_FOR_ITEM") return;
  if (!guest.currentRequest) return;

  bellboy.carrying = guest.currentRequest;
  bellboy.state = "TO_SNACK";
  setTimeout(() => setBellTarget(centerOf(stSnack)), 40);
}

function onBellboyAtSnack(){
  bellboy.state = "TO_GUEST";
  // go deliver to guest location (room area)
  setTimeout(() => setBellTarget({ x: guest.x, y: guest.y }), 40);
}

function onBellboyAtGuest(){
  // deliver if still needed
  if (guest.state === "WAITING_FOR_ITEM" && guest.currentRequest === bellboy.carrying) {
    const def = ITEMS[bellboy.carrying];
    guest.totalBonus += def.bonus;

    // clear current request
    guest.currentRequest = null;
    hideBubble();
    guestEl.classList.remove("angry");
    guest.angry = false;

    // after small pause, decide next
    setTimeout(() => {
      startNextRequestOrCheckout();
    }, 450);
  }

  bellboy.state = "RETURNING";
  bellboy.carrying = null;
  setTimeout(() => setBellTarget(centerOf(stSnack)), 40);
}

function onBellboyReturned(){
  bellboy.state = "IDLE";
}

/* ---------- Timers / Patience ---------- */
function updatePatienceUI(){
  if (guest.state !== "WAITING_FOR_ITEM" || !guest.currentRequest) return;

  const total = ITEMS[guest.currentRequest].seconds * 1000;
  const left = guest.requestDeadline - Date.now();
  const pct = Math.max(0, Math.min(1, left / total));

  // ring color effect by changing border opacity (simple)
  // Green-ish to red-ish feel (without specifying exact colors in code heavily)
  // We'll vary thickness using pct.
  if (ringEl) {
    ringEl.style.borderWidth = (3 + (1 - pct) * 2) + "px";
    ringEl.style.opacity = String(0.6 + (1 - pct) * 0.4);
  }

  // if time out -> guest angry, request cancelled (pays less)
  if (left <= 0 && !guest.angry) {
    guest.angry = true;
    guestEl.classList.add("angry");

    // If they time out, they CANCEL the current request and move on (hotel mania vibe)
    guest.currentRequest = null;
    hideBubble();

    // penalty: no bonus for this item
    setTimeout(() => {
      startNextRequestOrCheckout();
    }, 350);
  }
}

/* ---------- Main loop ---------- */
function loop(){
  // move guest
  const guestArrived = moveEntityToward(guest);
  setPos(guestEl, guest.x, guest.y);

  // move bellboy
  const bellArrived = moveEntityToward(bellboy);
  setPos(bellboyEl, bellboy.x, bellboy.y);

  // guest arrivals
  if (guestArrived) {
    if (guest.state === "TO_RECEPTION") onGuestArrivedAtReception();
    else if (guest.state === "TO_ROOM") onGuestArrivedAtRoom();
    else if (guest.state === "TO_PAY") onGuestArrivedToPay();
    else if (guest.state === "TO_EXIT") onGuestExit();
  }

  // bellboy arrivals
  if (bellArrived) {
    if (bellboy.state === "TO_SNACK") onBellboyAtSnack();
    else if (bellboy.state === "TO_GUEST") onBellboyAtGuest();
    else if (bellboy.state === "RETURNING") onBellboyReturned();
  }

  // update patience ring
  updatePatienceUI();

  // bellboy auto-serve
  bellboyTryServe();

  if (rafStarted) requestAnimationFrame(loop);
}

/* ---------- Spawn guest ---------- */
function spawnGuest(){
  guest.x = 10; guest.y = 10;
  guest.target = null;
  guest.requests = [];
  guest.currentRequest = null;
  guest.totalBonus = 0;
  guest.angry = false;
  guestEl.classList.remove("angry");
  hideBubble();

  guestArriveFlow();
}

spawnGuestBtn?.addEventListener("click", spawnGuest);

/* ---------- Start ---------- */
function start(){
  if (!mapEl) return;
  ensureBubble();

  // initial positions
  setPos(guestEl, guest.x, guest.y);

  bellboy.x = 260; bellboy.y = 260;
  setPos(bellboyEl, bellboy.x, bellboy.y);

  servedEl.textContent = "0";
  hotelCashEl.textContent = "0";

  rafStarted = true;
  loop();
}
start();

