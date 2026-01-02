/* SAFARI STAY — MOMBASA (VERSION: v6-manual-bellboy-orders + puzzle) */
const $ = (id) => document.getElementById(id);

/* ---------- Storage ---------- */
const KEY = {
  coins: "mombasaCoins",
  rooms: "mombasaRooms",
  queue: "mombasaQueue",
  ocean: "mombasaOceanUnlocked",
  pool: "mombasaPoolUnlocked",
  rating: "mombasaRating",
  speed: "mombasaDeliverySpeedLevel"
};

/* ---------- Balance ---------- */
const ROOM_BUILD_COST = 50;
const OCEAN_COST = 120;
const POOL_COST  = 200;

const CHECKIN_REWARD  = 3;
const CHECKOUT_REWARD = 5;
const CLEAN_REWARD    = 1;

/* ✅ Timers requested */
const STAY_MS  = 10000; // guest stays 10s then auto-checkout
const CLEAN_MS = 3000;  // cleaning takes 3s

/* ---------- Orders ---------- */
/* ✅ Staggered order time: 2–8s */
const ORDER_MIN_MS = 2000;
const ORDER_MAX_MS = 8000;

/* ✅ Not everyone orders */
const ORDER_CHANCE = 0.35;

/* ✅ Throttle: max pending orders globally */
const MAX_PENDING_ORDERS = 2;

/* Snack menu: includes base delivery time */
const ORDER_MENU = [
  { key: "mango",     icon: "🥭", label: "Mango Juice", coins: 2, ms: 1200 },
  { key: "pineapple", icon: "🍍", label: "Pineapple",  coins: 2, ms: 2000 },
  { key: "icecream",  icon: "🍦", label: "Ice Cream",  coins: 3, ms: 3000 }, // ~3s
];

/* ---------- Delivery speed upgrade ---------- */
let speedLevel = Number(localStorage.getItem(KEY.speed)) || 0;
// each level reduces delivery time by 12% (cap 60%)
function deliveryMs(baseMs){
  const reduction = Math.min(0.12 * speedLevel, 0.60);
  return Math.max(600, Math.round(baseMs * (1 - reduction)));
}

/* ---------- State ---------- */
let coins = Number(localStorage.getItem(KEY.coins)) || 0;
let rating = Number(localStorage.getItem(KEY.rating)) || 5.0;

/* ✅ FORCE minimum 4 rooms even if localStorage saved 2 */
let roomCount = Number(localStorage.getItem(KEY.rooms)) || 0;
roomCount = Math.max(4, roomCount);
localStorage.setItem(KEY.rooms, String(roomCount)); // keep 4+

let queueCount = Number(localStorage.getItem(KEY.queue)) || 0;

let oceanUnlocked = localStorage.getItem(KEY.ocean) === "true";
let poolUnlocked  = localStorage.getItem(KEY.pool) === "true";

/*
  status: "free" | "busy" | "dirty" | "cleaning"
  room: {
    id, status, guestEmoji,
    checkoutTimer, cleanTimer, orderTimer,
    order: null | menuItem,
    isDelivering: boolean,
    orderedThisStay: boolean (prevents endless retries)
  }
*/
let rooms = [];
const GUESTS = ["🧍🏾‍♂️","🧍🏾‍♀️","👩🏾‍🦱","👨🏾‍🦱","🧕🏾","👩🏾‍🦳","👨🏾‍🦰","🧑🏾‍🦱"];

/* ---------- Puzzle ---------- */
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const TILES = ["🍍","🥥","🌴","🐚","⭐","🍓"];

let board = new Array(TOTAL).fill(null);
let selectedIndex = null;
let isBusy = false;
let score = 0, moves = 30, puzzleCoinsEarned = 0;

/* ---------- Elements ---------- */
const el = {
  coinsText: $("coinsText"),
  queueText: $("queueText"),
  ratingText: $("ratingText"),

  tabHotel: $("tabHotel"),
  tabPuzzle: $("tabPuzzle"),
  viewHotel: $("viewHotel"),
  viewPuzzle: $("viewPuzzle"),

  queueLine: $("queueLine"),
  roomsGrid: $("roomsGrid"),
  hintText: $("hintText"),

  bellBoy: $("bellBoy"),
  cleanerGirl: $("cleanerGirl"),

  btnSpawn: $("btnSpawn"),
  btnServeNext: $("btnServeNext"),
  btnCleanAll: $("btnCleanAll"),
  btnAddRoom: $("btnAddRoom"),
  btnReset: $("btnReset"),

  btnSnack1: $("btnSnack1"),
  btnSnack2: $("btnSnack2"),
  btnSnack3: $("btnSnack3"),

  oceanStatus: $("oceanStatus"),
  poolStatus: $("poolStatus"),
  btnUnlockOcean: $("btnUnlockOcean"),
  btnUnlockPool: $("btnUnlockPool"),
  vibesPreview: $("vibesPreview"),

  // ✅ added by updated HTML (if present)
  ordersPanel: $("ordersPanel"),
  btnSpeedUp: $("btnSpeedUp"),
  speedLevelText: $("speedLevelText"),

  grid: $("grid"),
  movesText: $("movesText"),
  scoreText: $("scoreText"),
  puzzleCoinsText: $("puzzleCoinsText"),
  btnNewPuzzle: $("btnNewPuzzle")
};

/* ---------- Init costs text ---------- */
$("roomCostText") && ($("roomCostText").textContent = ROOM_BUILD_COST);
$("oceanCostText") && ($("oceanCostText").textContent = OCEAN_COST);
$("poolCostText")  && ($("poolCostText").textContent  = POOL_COST);

/* ---------- Start ---------- */
initRooms();
renderAll();
initPuzzle(true);
wireEvents();

/* ✅ Interval: auto serve + update buttons (NO auto delivery) */
setInterval(() => {
  autoServeIfPossible();
  updateButtons();
}, 700);

/* ================== Tabs ================== */
function showHotel(){
  el.tabHotel?.classList.add("active");
  el.tabPuzzle?.classList.remove("active");
  el.viewHotel?.classList.add("active");
  el.viewPuzzle?.classList.remove("active");
}
function showPuzzle(){
  el.tabPuzzle?.classList.add("active");
  el.tabHotel?.classList.remove("active");
  el.viewPuzzle?.classList.add("active");
  el.viewHotel?.classList.remove("active");
}

/* ================== Bellboy manual state ================== */
const bellboy = {
  mode: "idle",       // idle | pickSnack | pickRoom | delivering
  selectedKey: null
};

let deliveryLock = false;

/* ================== Wire events ================== */
function wireEvents(){
  el.tabHotel?.addEventListener("click", showHotel);
  el.tabPuzzle?.addEventListener("click", showPuzzle);

  el.btnSpawn?.addEventListener("click", spawnGuest);
  el.btnServeNext?.addEventListener("click", serveNext);
  el.btnCleanAll?.addEventListener("click", cleanAllDirty);

  el.btnAddRoom?.addEventListener("click", addRoom);
  el.btnReset?.addEventListener("click", hardReset);

  // Snacks: if bellboy is active -> select snack; otherwise -> manual sell
  el.btnSnack1?.addEventListener("click", () => onSnackButton("mango"));
  el.btnSnack2?.addEventListener("click", () => onSnackButton("pineapple"));
  el.btnSnack3?.addEventListener("click", () => onSnackButton("icecream"));

  // Bellboy click arms delivery mode
  el.bellBoy?.addEventListener("click", () => {
    if (bellboy.mode === "delivering") return hint("Bellboy is busy...");
    bellboy.mode = "pickSnack";
    bellboy.selectedKey = null;
    bounce(el.bellBoy);
    hint("Bellboy ready ✅ Click a snack, then click the room with that order.");
    renderRooms();
  });

  // Speed upgrade
  el.btnSpeedUp?.addEventListener("click", upgradeSpeed);

  el.btnUnlockOcean?.addEventListener("click", unlockOcean);
  el.btnUnlockPool?.addEventListener("click", unlockPool);

  el.btnNewPuzzle?.addEventListener("click", () => initPuzzle(true));
}

function onSnackButton(key){
  const item = ORDER_MENU.find(x => x.key === key);
  if(!item) return;

  if (bellboy.mode === "pickSnack"){
    bellboy.selectedKey = key;
    bellboy.mode = "pickRoom";
    bounce(el.bellBoy);
    hint(`Selected ${item.icon} ${item.label}. Now click the ROOM that ordered it.`);
    renderRooms();
    return;
  }

  // default: manual sell (optional)
  sellManualSnack(item.coins);
}

/* ================== Helpers ================== */
function hint(msg){
  if(!el.hintText) return;
  el.hintText.textContent = msg;
  clearTimeout(hint._t);
  hint._t = setTimeout(() => (el.hintText.textContent = ""), 2200);
}
function bounce(node){
  if(!node) return;
  node.classList.remove("bounce");
  void node.offsetWidth;
  node.classList.add("bounce");
}
function scrub(node){
  if(!node) return;
  node.classList.remove("scrub");
  void node.offsetWidth;
  node.classList.add("scrub");
}
function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }

function saveState(){
  localStorage.setItem(KEY.coins, String(coins));
  localStorage.setItem(KEY.queue, String(queueCount));
  localStorage.setItem(KEY.rooms, String(roomCount));
  localStorage.setItem(KEY.ocean, String(oceanUnlocked));
  localStorage.setItem(KEY.pool, String(poolUnlocked));
  localStorage.setItem(KEY.rating, String(rating.toFixed(1)));
  localStorage.setItem(KEY.speed, String(speedLevel));
}

function clearTimers(room){
  if(room.checkoutTimer){ clearTimeout(room.checkoutTimer); room.checkoutTimer = null; }
  if(room.cleanTimer){ clearTimeout(room.cleanTimer); room.cleanTimer = null; }
  if(room.orderTimer){ clearTimeout(room.orderTimer); room.orderTimer = null; }
  room.isDelivering = false;
}

function randBetween(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

/* ================== Rooms ================== */
function initRooms(){
  rooms.forEach(clearTimers);
  rooms = [];
  for(let i=1;i<=roomCount;i++){
    rooms.push({
      id:i,
      status:"free",
      guestEmoji:"",
      checkoutTimer:null,
      cleanTimer:null,
      orderTimer:null,
      order:null,
      isDelivering:false,
      orderedThisStay:false
    });
  }
}

function findFirstRoom(status){
  return rooms.findIndex(r => r.status === status);
}

function renderAll(){
  if(el.coinsText) el.coinsText.textContent = coins;
  if(el.queueText) el.queueText.textContent = queueCount;
  if(el.ratingText) el.ratingText.textContent = rating.toFixed(1);
  if(el.speedLevelText) el.speedLevelText.textContent = String(speedLevel);

  renderQueue();
  renderRooms();
  renderUnlocks();
  updateButtons();
  renderOrdersPanel();
  saveState();
}

function renderQueue(){
  if(!el.queueLine) return;
  el.queueLine.innerHTML = "";
  for(let i=0;i<queueCount;i++){
    const span = document.createElement("span");
    span.textContent = "🧍🏾";
    span.style.fontSize = "22px";
    if(i === queueCount - 1) span.classList.add("bounce");
    el.queueLine.appendChild(span);
  }
}

function pendingOrdersCount(){
  return rooms.filter(r => r.status === "busy" && r.order).length;
}

function renderOrdersPanel(){
  if(!el.ordersPanel) return;
  const waiting = rooms.filter(r => r.status === "busy" && r.order);
  if(waiting.length === 0){
    el.ordersPanel.innerHTML = `<div class="vibes-placeholder">No pending orders</div>`;
    return;
  }
  el.ordersPanel.innerHTML = waiting.map(r => {
    return `
      <div class="order-row">
        <div><b>Room ${r.id}</b></div>
        <div>${r.order.icon} ${r.order.label}</div>
        <div class="small">Manual delivery</div>
      </div>
    `;
  }).join("");
}

function renderRooms(){
  if(!el.roomsGrid) return;
  el.roomsGrid.innerHTML = "";

  rooms.forEach((r, idx) => {
    const roomEl = document.createElement("div");
    roomEl.className = "room";
    roomEl.dataset.roomIndex = String(idx);

    const top = document.createElement("div");
    top.className = "room-top";

    const name = document.createElement("div");
    name.className = "room-name";
    name.textContent = `Room ${r.id}`;

    const badge = document.createElement("div");
    badge.className =
      "badge " + (r.status === "free" ? "ok" :
      (r.status === "dirty" ? "dirty" :
      (r.status === "cleaning" ? "cleaning" : "busy")));

    badge.textContent =
      (r.status === "free") ? "READY" :
      (r.status === "busy") ? "OCCUPIED" :
      (r.status === "cleaning") ? "CLEANING..." :
      "DIRTY";

    top.appendChild(name);
    top.appendChild(badge);

    const guest = document.createElement("div");
    guest.className = "room-guest";

    if(r.status === "busy"){
      const orderBubble = r.order ? `  ${r.order.icon}` : "";
      guest.textContent = `${r.guestEmoji}${orderBubble}`;
    } else if(r.status === "dirty"){
      guest.textContent = "🧼";
    } else if(r.status === "cleaning"){
      guest.textContent = "🫧";
    } else {
      guest.textContent = "✨";
    }

    const actions = document.createElement("div");
    actions.className = "room-actions";

    const btnCheckin = document.createElement("button");
    btnCheckin.className = "btn tiny";
    btnCheckin.textContent = "Check-in";
    btnCheckin.disabled = !(r.status === "free" && queueCount > 0);
    btnCheckin.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      checkInToRoom(idx);
    });

    const btnClean = document.createElement("button");
    btnClean.className = "btn tiny";
    btnClean.textContent = "Clean";
    btnClean.disabled = !(r.status === "dirty");
    btnClean.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      startCleaning(idx);
    });

    actions.appendChild(btnCheckin);
    actions.appendChild(btnClean);

    roomEl.appendChild(top);
    roomEl.appendChild(guest);
    roomEl.appendChild(actions);

    // ✅ Manual delivery: click room when bellboy is picking room
    roomEl.addEventListener("click", () => {
      if (bellboy.mode !== "pickRoom") return;

      const selected = ORDER_MENU.find(x => x.key === bellboy.selectedKey);
      if (!selected) return hint("Pick a snack first.");

      if (r.status !== "busy" || !r.order) return hint("No pending order in this room.");

      if (r.order.key !== bellboy.selectedKey){
        return hint(`Wrong snack. Room ${r.id} ordered ${r.order.icon} ${r.order.label}`);
      }

      startManualDelivery(idx);
    });

    el.roomsGrid.appendChild(roomEl);
  });
}

/* ================== Guest flow ================== */
function spawnGuest(){
  queueCount++;
  bounce(el.bellBoy);
  hint(`Guest arrived! Queue: ${queueCount}`);
  renderAll();
  autoServeIfPossible();
}

function serveNext(){
  if(queueCount <= 0) return hint("No guests in queue.");
  const freeIndex = findFirstRoom("free");
  if(freeIndex === -1) return hint("No free rooms. Clean dirty rooms.");
  checkInToRoom(freeIndex);
}

function autoServeIfPossible(){
  while(queueCount > 0){
    const freeIndex = findFirstRoom("free");
    if(freeIndex === -1) break;
    checkInToRoom(freeIndex);
  }
}

function checkInToRoom(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "free" || queueCount <= 0) return;

  queueCount--;
  r.status = "busy";
  r.guestEmoji = GUESTS[Math.floor(Math.random() * GUESTS.length)];
  r.order = null;
  r.isDelivering = false;
  r.orderedThisStay = false;

  const bonus = (oceanUnlocked ? 1 : 0) + (poolUnlocked ? 1 : 0);
  coins += (CHECKIN_REWARD + bonus);
  rating = clamp(rating + 0.05, 1.0, 5.0);

  clearTimers(r);

  // auto checkout
  r.checkoutTimer = setTimeout(() => autoCheckout(roomIndex), STAY_MS);

  // ✅ schedule ONE possible order attempt (no endless retries)
  scheduleOneOrderAttempt(roomIndex);

  hint("Checked in ✅ (auto checkout in 10s)");
  renderAll();
}

function autoCheckout(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "busy") return;

  clearTimers(r);

  r.status = "dirty";
  r.guestEmoji = "";
  r.order = null;
  r.orderedThisStay = false;

  const bonus = poolUnlocked ? 2 : 0;
  coins += (CHECKOUT_REWARD + bonus);
  rating = clamp(rating + 0.03, 1.0, 5.0);

  hint("Auto checkout ✅ → room DIRTY");
  renderAll();
}

/* ================== Manual timed cleaning ================== */
function startCleaning(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "dirty") return;

  if(r.cleanTimer) return;

  scrub(el.cleanerGirl);
  r.status = "cleaning";
  hint("Cleaning started… (3s)");
  renderAll();

  clearTimers(r);
  r.cleanTimer = setTimeout(() => finishCleaning(roomIndex), CLEAN_MS);
}

function finishCleaning(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "cleaning") return;

  clearTimers(r);

  r.status = "free";
  coins += CLEAN_REWARD;

  hint("Room clean ✅ (ready)");
  renderAll();

  autoServeIfPossible();
}

function cleanAllDirty(){
  const dirty = rooms.map((r,i)=>({r,i})).filter(x => x.r.status === "dirty");
  if(dirty.length === 0) return hint("No dirty rooms.");
  dirty.forEach(x => startCleaning(x.i));
}

/* ================== Orders: stagger + chance + throttle ================== */
function scheduleOneOrderAttempt(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "busy") return;

  if (r.orderedThisStay) return;        // already had a chance
  if (r.order) return;                 // already has order
  if (pendingOrdersCount() >= MAX_PENDING_ORDERS) return;

  const wait = randBetween(ORDER_MIN_MS, ORDER_MAX_MS);
  r.orderTimer = setTimeout(() => {
    tryCreateSingleOrder(roomIndex);
  }, wait);
}

function tryCreateSingleOrder(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "busy") return;
  if (r.order) return;

  // Mark this guest used their chance -> prevents infinite retries
  r.orderedThisStay = true;

  if (pendingOrdersCount() >= MAX_PENDING_ORDERS) return;

  if (Math.random() < ORDER_CHANCE){
    const item = ORDER_MENU[Math.floor(Math.random() * ORDER_MENU.length)];
    r.order = { ...item };
    hint(`Order in Room ${r.id}: ${item.icon} ${item.label} (manual delivery)`);
  }
  renderAll();
}

/* ================== Manual delivery ================== */
function startManualDelivery(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "busy" || !r.order) return;
  if (deliveryLock) return hint("Bellboy is busy...");
  if (bellboy.mode !== "pickRoom") return;

  deliveryLock = true;
  r.isDelivering = true;
  bellboy.mode = "delivering";

  bounce(el.bellBoy);
  const ms = deliveryMs(r.order.ms);
  hint(`Delivering to Room ${r.id}... (${Math.ceil(ms/1000)}s)`);

  setTimeout(() => {
    if(r.status === "busy" && r.order){
      const vibeBonus = (oceanUnlocked ? 1 : 0) + (poolUnlocked ? 1 : 0);
      coins += (r.order.coins + vibeBonus);
      rating = clamp(rating + 0.02, 1.0, 5.0);
      hint(`Delivered ${r.order.icon} ✅ +${r.order.coins + vibeBonus}🪙`);
      r.order = null;
    } else {
      hint("Delivery canceled (guest left).");
    }

    r.isDelivering = false;
    deliveryLock = false;

    bellboy.mode = "idle";
    bellboy.selectedKey = null;

    renderAll();
  }, ms);
}

/* ================== Build room ================== */
function addRoom(){
  if(coins < ROOM_BUILD_COST) return hint(`Need ${ROOM_BUILD_COST}🪙`);
  coins -= ROOM_BUILD_COST;
  roomCount++;
  rooms.push({
    id:roomCount,
    status:"free",
    guestEmoji:"",
    checkoutTimer:null,
    cleanTimer:null,
    orderTimer:null,
    order:null,
    isDelivering:false,
    orderedThisStay:false
  });
  hint(`Built Room ${roomCount}!`);
  renderAll();
  autoServeIfPossible();
}

/* ================== Manual snack sell (optional) ================== */
function busyRoomsCount(){ return rooms.filter(r => r.status === "busy").length; }
function sellManualSnack(amount){
  if(busyRoomsCount() <= 0) return hint("No guests checked in.");
  const bonus = (oceanUnlocked ? 1 : 0) + (poolUnlocked ? 1 : 0);
  coins += amount + bonus;
  rating = clamp(rating + 0.02, 1.0, 5.0);
  renderAll();
  hint(`Snack sold! +${amount + bonus}🪙`);
}

/* ================== Speed upgrade ================== */
function upgradeSpeed(){
  // Optional: add cost if you want
  // const cost = 30 + speedLevel*20;
  // if (coins < cost) return hint(`Need ${cost}🪙`);
  // coins -= cost;

  speedLevel++;
  hint(`Delivery speed upgraded ⚡ (Level ${speedLevel})`);
  renderAll();
}

/* ================== Unlocks ================== */
function renderUnlocks(){
  if(!el.oceanStatus || !el.poolStatus) return;

  el.oceanStatus.textContent = oceanUnlocked ? "UNLOCKED" : "LOCKED";
  el.poolStatus.textContent  = poolUnlocked ? "UNLOCKED" : "LOCKED";
  el.oceanStatus.classList.toggle("on", oceanUnlocked);
  el.poolStatus.classList.toggle("on", poolUnlocked);

  if(el.btnUnlockOcean) el.btnUnlockOcean.disabled = oceanUnlocked;
  if(el.btnUnlockPool) el.btnUnlockPool.disabled = poolUnlocked;

  if(el.vibesPreview){
    if(oceanUnlocked || poolUnlocked){
      el.vibesPreview.classList.add("vibes-on");
      const lines = [];
      if(oceanUnlocked) lines.push("🌊 Ocean View Active");
      if(poolUnlocked) lines.push("🏊 Pool Area Active");
      el.vibesPreview.innerHTML = `<div class="vibes-placeholder">${lines.join("<br>")}</div>`;
    } else {
      el.vibesPreview.classList.remove("vibes-on");
      el.vibesPreview.innerHTML = `<div class="vibes-placeholder">🔒 Unlock Ocean/Pool</div>`;
    }
  }
}

function unlockOcean(){
  if(oceanUnlocked) return;
  if(coins < OCEAN_COST) return hint(`Need ${OCEAN_COST}🪙`);
  coins -= OCEAN_COST;
  oceanUnlocked = true;
  hint("Ocean unlocked 🌊");
  renderAll();
}
function unlockPool(){
  if(poolUnlocked) return;
  if(coins < POOL_COST) return hint(`Need ${POOL_COST}🪙`);
  coins -= POOL_COST;
  poolUnlocked = true;
  hint("Pool unlocked 🏊");
  renderAll();
}

/* ================== Buttons ================== */
function updateButtons(){
  if(el.btnServeNext) el.btnServeNext.disabled = (queueCount <= 0 || findFirstRoom("free") === -1);
  if(el.btnCleanAll) el.btnCleanAll.disabled = rooms.every(r => r.status !== "dirty");
  if(el.btnAddRoom)  el.btnAddRoom.disabled  = coins < ROOM_BUILD_COST;
}

/* ================== Puzzle ================== */
function initPuzzle(forceNew=false){
  if(forceNew){ score = 0; moves = 30; puzzleCoinsEarned = 0; }
  board = new Array(TOTAL).fill(null).map(randTile);
  for(let i=0;i<TOTAL;i++){ while(hasMatchAt(i)) board[i] = randTile(); }
  renderPuzzle(); updatePuzzleHud();
}

function renderPuzzle(){
  if(!el.grid) return;
  el.grid.innerHTML = "";
  for(let i=0;i<TOTAL;i++){
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = board[i];
    cell.addEventListener("click", () => onCellClick(i));
    el.grid.appendChild(cell);
  }
}

function updatePuzzleHud(){
  if(el.movesText) el.movesText.textContent = moves;
  if(el.scoreText) el.scoreText.textContent = score;
  if(el.puzzleCoinsText) el.puzzleCoinsText.textContent = puzzleCoinsEarned;
}

function onCellClick(i){
  if(isBusy || moves <= 0) return;

  if(selectedIndex === null){ selectedIndex = i; highlightSelected(); return; }
  if(selectedIndex === i){ selectedIndex = null; highlightSelected(); return; }
  if(!isAdjacent(selectedIndex, i)){ selectedIndex = i; highlightSelected(); return; }

  isBusy = true;
  const a = selectedIndex, b = i;
  swap(a,b);

  if(!hasAnyMatch()){
    swap(a,b);
    selectedIndex = null;
    isBusy = false;
    highlightSelected();
    return;
  }

  moves--;
  coins += 1;
  puzzleCoinsEarned += 1;

  selectedIndex = null;
  renderAll();
  cascadeClear().then(() => { isBusy = false; });
}

function highlightSelected(){
  renderPuzzle();
  if(selectedIndex !== null && el.grid && el.grid.children[selectedIndex]){
    el.grid.children[selectedIndex].classList.add("selected");
  }
}

async function cascadeClear(){
  let did = true;
  while(did){
    const matches = findMatches();
    if(matches.size === 0){ did = false; break; }
    score += matches.size * 2;
    matches.forEach(idx => board[idx] = null);
    dropTiles(); refillTiles();
    highlightSelected(); updatePuzzleHud();
    await sleep(120);
  }
  renderAll();
}

function findMatches(){
  const matched = new Set();
  for(let r=0;r<WIDTH;r++){
    let start = r*WIDTH, len = 1;
    for(let c=1;c<WIDTH;c++){
      const idx = r*WIDTH + c;
      const prev = r*WIDTH + (c-1);
      if(board[idx] && board[idx] === board[prev]) len++;
      else{
        if(len >= 3) for(let k=0;k<len;k++) matched.add(start+k);
        start = idx; len = 1;
      }
    }
    if(len >= 3) for(let k=0;k<len;k++) matched.add(start+k);
  }
  for(let c=0;c<WIDTH;c++){
    let start = c, len = 1;
    for(let r=1;r<WIDTH;r++){
      const idx = r*WIDTH + c;
      const prev = (r-1)*WIDTH + c;
      if(board[idx] && board[idx] === board[prev]) len++;
      else{
        if(len >= 3) for(let k=0;k<len;k++) matched.add(start + k*WIDTH);
        start = idx; len = 1;
      }
    }
    if(len >= 3) for(let k=0;k<len;k++) matched.add(start + k*WIDTH);
  }
  return matched;
}

function hasAnyMatch(){ return findMatches().size > 0; }

function hasMatchAt(i){
  const r = Math.floor(i/WIDTH), c = i%WIDTH, v = board[i];
  if(!v) return false;
  if(c>=2 && board[i-1]===v && board[i-2]===v) return true;
  if(c>=1 && c<=WIDTH-2 && board[i-1]===v && board[i+1]===v) return true;
  if(c<=WIDTH-3 && board[i+1]===v && board[i+2]===v) return true;
  if(r>=2 && board[i-WIDTH]===v && board[i-2*WIDTH]===v) return true;
  if(r>=1 && r<=WIDTH-2 && board[i-WIDTH]===v && board[i+WIDTH]===v) return true;
  if(r<=WIDTH-3 && board[i+WIDTH]===v && board[i+2*WIDTH]===v) return true;
  return false;
}

function dropTiles(){
  for(let c=0;c<WIDTH;c++){
    for(let r=WIDTH-1;r>=0;r--){
      const idx = r*WIDTH + c;
      if(board[idx] === null){
        for(let rr=r-1; rr>=0; rr--){
          const above = rr*WIDTH + c;
          if(board[above] !== null){
            board[idx] = board[above];
            board[above] = null;
            break;
          }
        }
      }
    }
  }
}

function refillTiles(){ for(let i=0;i<TOTAL;i++) if(board[i] === null) board[i] = randTile(); }
function randTile(){ return TILES[Math.floor(Math.random()*TILES.length)]; }
function swap(a,b){ const t=board[a]; board[a]=board[b]; board[b]=t; }

function isAdjacent(a,b){
  const ar = Math.floor(a/WIDTH), ac = a%WIDTH;
  const br = Math.floor(b/WIDTH), bc = b%WIDTH;
  return (Math.abs(ar-br) + Math.abs(ac-bc)) === 1;
}

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

/* ================== Reset ================== */
function hardReset(){
  Object.values(KEY).forEach(k => localStorage.removeItem(k));
  rooms.forEach(clearTimers);

  coins = 0; rating = 5.0;
  roomCount = 4;
  queueCount = 0;
  oceanUnlocked = false; poolUnlocked = false;
  speedLevel = 0;

  localStorage.setItem(KEY.rooms, String(roomCount));
  initRooms();
  initPuzzle(true);

  hint("Reset done (4 rooms).");
  renderAll();
}










