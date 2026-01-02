/* =========================================================
   SAFARI STAY — MOMBASA
   ✅ Auto checkout after 10s
   ✅ Manual cleaning takes 3s (CLEANING…)
   ✅ No manual checkout button
   ========================================================= */

const $ = (id) => document.getElementById(id);

/* ---------- Storage ---------- */
const KEY = {
  coins: "mombasaCoins",
  rooms: "mombasaRooms",
  queue: "mombasaQueue",
  ocean: "mombasaOceanUnlocked",
  pool: "mombasaPoolUnlocked",
  rating: "mombasaRating"
};

/* ---------- Balance ---------- */
const ROOM_BUILD_COST = 50;
const OCEAN_COST = 120;
const POOL_COST  = 200;

const CHECKIN_REWARD = 3;
const CHECKOUT_REWARD = 5;
const CLEAN_REWARD = 1;

const SNACK1 = 2, SNACK2 = 2, SNACK3 = 3;

/* ✅ Timers requested */
const STAY_MS  = 10000; // 10s
const CLEAN_MS = 3000;  // 3s

/* ---------- State ---------- */
let coins = Number(localStorage.getItem(KEY.coins)) || 0;
let rating = Number(localStorage.getItem(KEY.rating)) || 5.0;

let roomCount = Number(localStorage.getItem(KEY.rooms)) || 2;
let queueCount = Number(localStorage.getItem(KEY.queue)) || 0;

let oceanUnlocked = localStorage.getItem(KEY.ocean) === "true";
let poolUnlocked  = localStorage.getItem(KEY.pool) === "true";

/*
  status: "free" | "busy" | "dirty" | "cleaning"
  { id, status, guestEmoji, checkoutTimer, cleanTimer }
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
let score = 0;
let moves = 30;
let puzzleCoinsEarned = 0;

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

  grid: $("grid"),
  movesText: $("movesText"),
  scoreText: $("scoreText"),
  puzzleCoinsText: $("puzzleCoinsText"),
  btnNewPuzzle: $("btnNewPuzzle")
};

/* ---------- Init ---------- */
$("roomCostText").textContent = ROOM_BUILD_COST;
$("oceanCostText").textContent = OCEAN_COST;
$("poolCostText").textContent  = POOL_COST;

initRooms();
renderAll();
initPuzzle(true);
wireEvents();

// auto-fill FREE rooms only
setInterval(() => {
  autoServeIfPossible();
  updateButtons();
}, 700);

/* ================== Tabs ================== */
function showHotel(){
  el.tabHotel.classList.add("active");
  el.tabPuzzle.classList.remove("active");
  el.viewHotel.classList.add("active");
  el.viewPuzzle.classList.remove("active");
}
function showPuzzle(){
  el.tabPuzzle.classList.add("active");
  el.tabHotel.classList.remove("active");
  el.viewPuzzle.classList.add("active");
  el.viewHotel.classList.remove("active");
}

function wireEvents(){
  el.tabHotel.addEventListener("click", showHotel);
  el.tabPuzzle.addEventListener("click", showPuzzle);

  el.btnSpawn.addEventListener("click", spawnGuest);
  el.btnServeNext.addEventListener("click", serveNext);
  el.btnCleanAll.addEventListener("click", cleanAllDirty);

  el.btnAddRoom.addEventListener("click", addRoom);
  el.btnReset.addEventListener("click", hardReset);

  el.btnSnack1.addEventListener("click", () => sellSnack(SNACK1));
  el.btnSnack2.addEventListener("click", () => sellSnack(SNACK2));
  el.btnSnack3.addEventListener("click", () => sellSnack(SNACK3));

  el.btnUnlockOcean.addEventListener("click", unlockOcean);
  el.btnUnlockPool.addEventListener("click", unlockPool);

  el.btnNewPuzzle.addEventListener("click", () => initPuzzle(true));
}

/* ================== Helpers ================== */
function hint(msg){
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
}

function clearTimers(room){
  if(room.checkoutTimer){ clearTimeout(room.checkoutTimer); room.checkoutTimer = null; }
  if(room.cleanTimer){ clearTimeout(room.cleanTimer); room.cleanTimer = null; }
}

/* ================== Rooms ================== */
function initRooms(){
  rooms.forEach(clearTimers);
  rooms = [];
  for(let i=1;i<=roomCount;i++){
    rooms.push({ id:i, status:"free", guestEmoji:"", checkoutTimer:null, cleanTimer:null });
  }
}

function findFirstRoom(status){
  return rooms.findIndex(r => r.status === status);
}

function renderAll(){
  el.coinsText.textContent = coins;
  el.queueText.textContent = queueCount;
  el.ratingText.textContent = rating.toFixed(1);

  renderQueue();
  renderRooms();
  renderUnlocks();
  updateButtons();
  saveState();
}

function renderQueue(){
  el.queueLine.innerHTML = "";
  for(let i=0;i<queueCount;i++){
    const span = document.createElement("span");
    span.textContent = "🧍🏾";
    span.style.fontSize = "22px";
    if(i === queueCount - 1) span.classList.add("bounce");
    el.queueLine.appendChild(span);
  }
}

function renderRooms(){
  el.roomsGrid.innerHTML = "";

  rooms.forEach((r, idx) => {
    const roomEl = document.createElement("div");
    roomEl.className = "room";

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
    guest.textContent =
      (r.status === "busy") ? r.guestEmoji :
      (r.status === "dirty") ? "🧼" :
      (r.status === "cleaning") ? "🫧" :
      "✨";

    const actions = document.createElement("div");
    actions.className = "room-actions";

    const btnCheckin = document.createElement("button");
    btnCheckin.className = "btn tiny";
    btnCheckin.textContent = "Check-in";
    btnCheckin.disabled = !(r.status === "free" && queueCount > 0);
    btnCheckin.addEventListener("click", () => checkInToRoom(idx));

    const btnClean = document.createElement("button");
    btnClean.className = "btn tiny";
    btnClean.textContent = "Clean";
    btnClean.disabled = !(r.status === "dirty");
    btnClean.addEventListener("click", () => startCleaning(idx));

    actions.appendChild(btnCheckin);
    actions.appendChild(btnClean);

    roomEl.appendChild(top);
    roomEl.appendChild(guest);
    roomEl.appendChild(actions);

    el.roomsGrid.appendChild(roomEl);
  });
}

/* ================== Flow ================== */
function spawnGuest(){
  queueCount++;
  hint(`Guest arrived! Queue: ${queueCount}`);
  bounce(el.bellBoy);
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
  if(queueCount <= 0 || r.status !== "free") return;

  queueCount--;
  r.status = "busy";
  r.guestEmoji = GUESTS[Math.floor(Math.random() * GUESTS.length)];

  const bonus = (oceanUnlocked ? 1 : 0) + (poolUnlocked ? 1 : 0);
  coins += (CHECKIN_REWARD + bonus);
  rating = clamp(rating + 0.05, 1.0, 5.0);

  clearTimers(r);
  r.checkoutTimer = setTimeout(() => autoCheckout(roomIndex), STAY_MS);

  hint("Checked in ✅ (auto checkout in 10s)");
  renderAll();
}

function autoCheckout(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "busy") return;

  clearTimers(r);
  r.status = "dirty";
  r.guestEmoji = "";

  const bonus = poolUnlocked ? 2 : 0;
  coins += (CHECKOUT_REWARD + bonus);
  rating = clamp(rating + 0.03, 1.0, 5.0);

  hint("Guest checked out automatically → DIRTY");
  renderAll();
}

/* ================== Manual timed cleaning ================== */
function startCleaning(roomIndex){
  const r = rooms[roomIndex];
  if(!r || r.status !== "dirty") return;

  scrub(el.cleanerGirl);
  r.status = "cleaning";
  renderAll();
  hint("Cleaning started…");

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

/* ================== Build room ================== */
function addRoom(){
  if(coins < ROOM_BUILD_COST) return hint(`Need ${ROOM_BUILD_COST}🪙`);
  coins -= ROOM_BUILD_COST;
  roomCount++;
  rooms.push({ id:roomCount, status:"free", guestEmoji:"", checkoutTimer:null, cleanTimer:null });
  hint(`Built Room ${roomCount}!`);
  renderAll();
  autoServeIfPossible();
}

/* ================== Snacks ================== */
function busyRoomsCount(){ return rooms.filter(r => r.status === "busy").length; }
function sellSnack(amount){
  if(busyRoomsCount() <= 0){
    rating = clamp(rating - 0.05, 1.0, 5.0);
    renderAll();
    return hint("No guests checked in.");
  }
  const bonus = (oceanUnlocked ? 1 : 0) + (poolUnlocked ? 1 : 0);
  coins += amount + bonus;
  rating = clamp(rating + 0.02, 1.0, 5.0);
  renderAll();
  hint(`Snack sold! +${amount + bonus}🪙`);
}

/* ================== Unlocks ================== */
function renderUnlocks(){
  el.oceanStatus.textContent = oceanUnlocked ? "UNLOCKED" : "LOCKED";
  el.poolStatus.textContent  = poolUnlocked ? "UNLOCKED" : "LOCKED";
  el.oceanStatus.classList.toggle("on", oceanUnlocked);
  el.poolStatus.classList.toggle("on", poolUnlocked);

  el.btnUnlockOcean.disabled = oceanUnlocked;
  el.btnUnlockPool.disabled  = poolUnlocked;

  if(oceanUnlocked || poolUnlocked){
    el.vibesPreview.classList.add("vibes-on");
    const lines = [];
    if(oceanUnlocked) lines.push("🌊 Ocean View Active");
    if(poolUnlocked) lines.push("🏊 Pool Area Active");
    el.vibesPreview.innerHTML = `<div class="vibes-placeholder">${lines.join("<br>")}</div>`;
  }else{
    el.vibesPreview.classList.remove("vibes-on");
    el.vibesPreview.innerHTML = `<div class="vibes-placeholder">🔒 Unlock Ocean/Pool</div>`;
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
  el.btnServeNext.disabled = (queueCount <= 0 || findFirstRoom("free") === -1);
  el.btnCleanAll.disabled = rooms.every(r => r.status !== "dirty");
  el.btnAddRoom.disabled = coins < ROOM_BUILD_COST;
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
  el.movesText.textContent = moves;
  el.scoreText.textContent = score;
  el.puzzleCoinsText.textContent = puzzleCoinsEarned;
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
  if(selectedIndex !== null && el.grid.children[selectedIndex]){
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
  roomCount = 2; queueCount = 0;
  oceanUnlocked = false; poolUnlocked = false;

  initRooms();
  initPuzzle(true);
  hint("Reset done.");
  renderAll();
}










