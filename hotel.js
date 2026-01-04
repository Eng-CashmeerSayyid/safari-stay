// ================= STORAGE HELPERS =================
function getNum(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function getBool(key) {
  return localStorage.getItem(key) === "true";
}
function setNum(key, value) {
  localStorage.setItem(key, String(value));
}
function setBool(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
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

// ================= MOMBASA STATE =================
let queue = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

// 4 fixed rooms
// status: "empty" | "occupied" | "dirty" | "cleaning"
let rooms = getJSON("mombasaRoomsV2", null);
if (!rooms || !Array.isArray(rooms) || rooms.length !== 4) {
  rooms = Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    status: "empty",
    guestId: null,
    checkoutAt: 0,
    // snack ordering
    willOrder: false,
    orderSnack: null,
    orderAt: 0,
    needsDelivery: false,
    // emoji moment
    mood: "🙂",
    moodUntil: 0,
    // cleaning
    cleaningUntil: 0
  }));
}

// ================= UI HELPERS =================
const $ = (id) => document.getElementById(id);
const hudCoins = $("coins");
const hudQueue = $("queue");
const hudServed = $("served");

const roomsEl = $("rooms");
const deliveryHint = $("deliveryHint");
const spawnPeople = $("spawnPeople");

const btnSpawnGuest = $("btnSpawnGuest");
const btnClear = $("btnClear");

const snackButtons = Array.from(document.querySelectorAll(".snack"));

const spotIcons = {
  1: $("spotI1"),
  2: $("spotI2"),
  3: $("spotI3"),
  4: $("spotI4"),
};

// stage hotspots
const stageRoomSpots = Array.from(document.querySelectorAll(".roomSpot"));
const stageStationSpots = Array.from(document.querySelectorAll(".stationSpot"));
const stageReception = document.querySelector(".receptionSpot");

// ================= TABS =================
(function tabSwitcher(){
  const tabHotel = $("tabHotel");
  const tabPuzzle = $("tabPuzzle");
  const viewHotel = $("viewHotel");
  const viewPuzzle = $("viewPuzzle");

  function showHotel(){
    tabHotel.classList.add("active");
    tabPuzzle.classList.remove("active");
    viewHotel.classList.add("active");
    viewPuzzle.classList.remove("active");
  }
  function showPuzzle(){
    tabPuzzle.classList.add("active");
    tabHotel.classList.remove("active");
    viewPuzzle.classList.add("active");
    viewHotel.classList.remove("active");
  }

  tabHotel.addEventListener("click", showHotel);
  tabPuzzle.addEventListener("click", showPuzzle);
})();

// ================= HOTEL LOGIC =================
const SNACKS = ["🍟","🍹","🍉","🍔"];
let heldSnack = null;

function saveHotel() {
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  setJSON("mombasaRoomsV2", rooms);
  setCoins(getCoins());
}

function setHint(msg) {
  deliveryHint.textContent = msg;
}

function setHeldSnack(snack) {
  heldSnack = snack;
  snackButtons.forEach(b => b.classList.toggle("selected", b.dataset.snack === snack));
  setHint(snack ? `Holding ${snack}. Tap the room that ordered.` : "No delivery selected.");
}

snackButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const s = btn.dataset.snack;
    setHeldSnack(heldSnack === s ? null : s);
  });
});

btnSpawnGuest.addEventListener("click", () => {
  queue += 1;
  saveHotel();
  renderAll();
});

btnClear.addEventListener("click", () => {
  if (!confirm("Reset save? This clears coins + hotel + puzzle stats.")) return;
  localStorage.clear();
  location.reload();
});

function now() { return Date.now(); }

function findFirstEmptyRoom() {
  return rooms.find(r => r.status === "empty");
}

function setRoomMood(room, emoji, ms=1200) {
  room.mood = emoji;
  room.moodUntil = now() + ms;
}

function scheduleOrder(room) {
  // only some guests order, and not immediately
  room.willOrder = Math.random() < 0.65; // 65% chance
  if (!room.willOrder) return;
  const delay = 2000 + Math.floor(Math.random() * 5000); // 2s to 7s
  room.orderAt = now() + delay;
  room.orderSnack = SNACKS[Math.floor(Math.random()*SNACKS.length)];
  room.needsDelivery = false; // becomes true when time comes
}

function checkInLoop() {
  // auto check-in if queue > 0 and a room is empty
  while (queue > 0) {
    const room = findFirstEmptyRoom();
    if (!room) break;

    queue -= 1;
    room.status = "occupied";
    room.guestId = "G" + Math.floor(Math.random() * 9000 + 1000);
    room.checkoutAt = now() + 10000; // 10s stay
    room.orderSnack = null;
    room.needsDelivery = false;
    room.orderAt = 0;
    setRoomMood(room, "😄", 900);
    scheduleOrder(room);
  }
}

function tickRooms() {
  const t = now();

  rooms.forEach(room => {
    // mood timeout
    if (room.moodUntil && t > room.moodUntil) {
      room.mood = room.status === "occupied" ? "🙂" : "🏨";
      room.moodUntil = 0;
    }

    // ordering trigger
    if (room.status === "occupied" && room.willOrder && room.orderAt && t >= room.orderAt && !room.needsDelivery) {
      room.needsDelivery = true;
      setRoomMood(room, room.orderSnack, 1200);
    }

    // checkout -> dirty
    if (room.status === "occupied" && t >= room.checkoutAt) {
      room.status = "dirty";
      room.guestId = null;
      room.checkoutAt = 0;
      room.willOrder = false;
      room.orderSnack = null;
      room.orderAt = 0;
      room.needsDelivery = false;
      setRoomMood(room, "🧺", 1200);
    }

    // cleaning finishes
    if (room.status === "cleaning" && t >= room.cleaningUntil) {
      room.status = "empty";
      room.cleaningUntil = 0;
      setRoomMood(room, "✨", 900);
    }
  });
}

function deliverToRoom(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  // if dirty: do nothing (clean button exists)
  if (room.status === "dirty") {
    setHint(`Room ${roomId} is dirty. Tap CLEAN in the room card.`);
    return;
  }
  if (room.status !== "occupied") {
    setHint(`Room ${roomId} is empty.`);
    return;
  }

  if (!heldSnack) {
    if (room.needsDelivery) setHint(`Room ${roomId} ordered something. Pick a snack first.`);
    else setHint(`Room ${roomId} has no snack order right now.`);
    return;
  }

  if (!room.needsDelivery) {
    setHint(`Wrong timing. Room ${roomId} didn’t order.`);
    setRoomMood(room, "😐", 800);
    return;
  }

  // needsDelivery true: must match snack
  if (heldSnack !== room.orderSnack) {
    setHint(`Wrong snack. Room ${roomId} wanted ${room.orderSnack}.`);
    setRoomMood(room, "😤", 800);
    return;
  }

  // success
  room.needsDelivery = false;
  room.orderSnack = null;
  room.orderAt = 0;
  room.willOrder = false;

  served += 1;
  setCoins(getCoins() + 2); // delivery reward
  setRoomMood(room, "😍", 1200);
  setHint(`Delivered! +2 coins ✅`);

  // drop held snack
  setHeldSnack(null);

  saveHotel();
  renderAll();
}

function startCleaning(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.status !== "dirty") return;

  room.status = "cleaning";
  room.cleaningUntil = now() + 3000; // 3 sec
  setRoomMood(room, "🧼", 900);

  saveHotel();
  renderAll();
}

function renderHUD() {
  hudCoins.textContent = String(getCoins());
  hudQueue.textContent = String(queue);
  hudServed.textContent = String(served);

  // spawn lane emojis
  const heads = Math.max(1, Math.min(queue, 6));
  spawnPeople.textContent = queue === 0 ? "✨" : "👤".repeat(heads);
}

function roomStatusTag(room) {
  if (room.status === "empty") return `<span class="tag">Empty</span>`;
  if (room.status === "occupied") {
    if (room.needsDelivery) return `<span class="tag warn">Ordered</span>`;
    return `<span class="tag">Occupied</span>`;
  }
  if (room.status === "dirty") return `<span class="tag danger">Dirty</span>`;
  if (room.status === "cleaning") return `<span class="tag warn">Cleaning…</span>`;
  return `<span class="tag">?</span>`;
}

function renderRoomsList() {
  roomsEl.innerHTML = "";

  rooms.forEach(room => {
    const el = document.createElement("div");
    el.className = "room";
    el.dataset.room = String(room.id);

    const emoji = room.needsDelivery ? (room.orderSnack || "🛎️") : room.mood;

    const extra =
      room.status === "occupied" && room.needsDelivery
        ? `<span class="tag warn">Wants ${room.orderSnack}</span>`
        : "";

    const cleanBtn =
      room.status === "dirty"
        ? `<button class="smallBtn clean" data-clean="${room.id}">🧼 Clean (3s)</button>`
        : `<button class="smallBtn clean" disabled>🧼 Clean</button>`;

    el.innerHTML = `
      <div class="roomTop">
        <div>Room ${room.id}</div>
        <div class="roomBadge">${roomStatusTag(room)}</div>
      </div>

      <div class="roomEmoji">${emoji}</div>

      <div class="roomInfo">
        ${extra}
        ${room.status === "occupied" ? `<span class="tag">Stay: 10s</span>` : ""}
      </div>

      <div class="roomButtons">
        ${cleanBtn}
      </div>
    `;

    // clicking room delivers if possible
    el.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.clean) return; // avoid double
      deliverToRoom(room.id);
    });

    roomsEl.appendChild(el);
  });

  // clean button listeners
  Array.from(document.querySelectorAll("[data-clean]")).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.clean);
      startCleaning(id);
    });
  });
}

function renderStageIcons() {
  rooms.forEach(room => {
    const iconEl = spotIcons[room.id];
    if (!iconEl) return;

    let icon = "";
    if (room.status === "empty") icon = "";
    if (room.status === "occupied") icon = room.needsDelivery ? (room.orderSnack || "🛎️") : "🙂";
    if (room.status === "dirty") icon = "🧺";
    if (room.status === "cleaning") icon = "🧼";
    iconEl.textContent = icon;
  });
}

stageRoomSpots.forEach(btn => {
  btn.addEventListener("click", () => {
    const rid = Number(btn.dataset.room);
    deliverToRoom(rid);
  });
});
stageStationSpots.forEach(btn => {
  btn.addEventListener("click", () => {
    const st = btn.dataset.station;
    if (st === "snack") {
      setHint("Pick a snack from the Snack Corner, then tap the room that ordered.");
    } else if (st === "cleaning") {
      setHint("To clean: tap a DIRTY room, then press CLEAN in the room card.");
    }
  });
});
if (stageReception) {
  stageReception.addEventListener("click", () => {
    setHint("Reception: Guests spawn in queue. Rooms auto check-in when free.");
  });
}

function renderAll() {
  renderHUD();
  renderRoomsList();
  renderStageIcons();
}

// main loop
setInterval(() => {
  checkInLoop();
  tickRooms();
  saveHotel();
  renderAll();
}, 500);

// initial
renderAll();

// ===================== PUZZLE (MATCH-3) =====================
const boardEl = $("board");
const pMovesEl = $("pMoves");
const pMatchesEl = $("pMatches");
const btnShuffle = $("btnShuffle");
const btnNewPuzzle = $("btnNewPuzzle");

const SIZE = 6;
const TYPES = [
  { key: "palm", emoji: "🌴", cls: "t-palm" },
  { key: "shell", emoji: "🐚", cls: "t-shell" },
  { key: "fish", emoji: "🐠", cls: "t-fish" },
  { key: "coconut", emoji: "🥥", cls: "t-coconut" },
  { key: "wave", emoji: "🌊", cls: "t-wave" },
  { key: "sun", emoji: "☀️", cls: "t-sun" },
];

let grid = [];
let selected = null;
let pMoves = getNum("pMoves", 0);
let pMatches = getNum("pMatches", 0);

function savePuzzle(){
  setNum("pMoves", pMoves);
  setNum("pMatches", pMatches);
}

function randType(){
  return Math.floor(Math.random() * TYPES.length);
}

function inBounds(r,c){ return r>=0 && r<SIZE && c>=0 && c<SIZE; }

function makeGrid(){
  grid = Array.from({length: SIZE}, () => Array.from({length: SIZE}, randType));
  // avoid initial matches
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      while (createsMatchAt(r,c)){
        grid[r][c] = randType();
      }
    }
  }
}

function createsMatchAt(r,c){
  const t = grid[r][c];
  // check left
  if (c>=2 && grid[r][c-1]===t && grid[r][c-2]===t) return true;
  // check up
  if (r>=2 && grid[r-1][c]===t && grid[r-2][c]===t) return true;
  return false;
}

function renderBoard(){
  boardEl.innerHTML = "";
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      const tIndex = grid[r][c];
      const t = TYPES[tIndex];
      const tile = document.createElement("button");
      tile.className = `tile ${t.cls}`;
      tile.type = "button";
      tile.dataset.r = String(r);
      tile.dataset.c = String(c);
      tile.textContent = t.emoji; // emoji fallback if images fail
      tile.addEventListener("click", () => onTileClick(r,c,tile));
      boardEl.appendChild(tile);
    }
  }
  pMovesEl.textContent = String(pMoves);
  pMatchesEl.textContent = String(pMatches);
}

function onTileClick(r,c,el){
  if (!selected){
    selected = {r,c};
    el.classList.add("selected");
    return;
  }
  const prev = selected;
  selected = null;
  clearTileSelection();

  const dr = Math.abs(prev.r - r);
  const dc = Math.abs(prev.c - c);
  if (dr + dc !== 1) return; // must be adjacent

  swap(prev.r, prev.c, r, c);
  const matches = findAllMatches();
  if (matches.length === 0){
    // swap back
    swap(prev.r, prev.c, r, c);
    return;
  }

  // valid move
  pMoves += 1;
  setCoins(getCoins() + 1); // +1 coin per valid move
  resolveMatches(matches);
  savePuzzle();
  saveHotel();
  renderHUD();
  renderBoard();
}

function clearTileSelection(){
  document.querySelectorAll(".tile.selected").forEach(x => x.classList.remove("selected"));
}

function swap(r1,c1,r2,c2){
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;
}

function findAllMatches(){
  const matches = [];
  // rows
  for (let r=0;r<SIZE;r++){
    let runStart = 0;
    for (let c=1;c<=SIZE;c++){
      const same = c<SIZE && grid[r][c] === grid[r][c-1];
      if (!same){
        const runLen = c - runStart;
        if (runLen >= 3){
          for (let k=runStart;k<c;k++) matches.push([r,k]);
        }
        runStart = c;
      }
    }
  }
  // cols
  for (let c=0;c<SIZE;c++){
    let runStart = 0;
    for (let r=1;r<=SIZE;r++){
      const same = r<SIZE && grid[r][c] === grid[r-1][c];
      if (!same){
        const runLen = r - runStart;
        if (runLen >= 3){
          for (let k=runStart;k<r;k++) matches.push([k,c]);
        }
        runStart = r;
      }
    }
  }
  // dedupe
  const key = (a)=>a[0]+"-"+a[1];
  const seen = new Set();
  const out = [];
  for (const m of matches){
    const k = key(m);
    if (!seen.has(k)){ seen.add(k); out.push(m); }
  }
  return out;
}

function resolveMatches(initialMatches){
  let matches = initialMatches;
  while (matches.length){
    pMatches += matches.length;
    // clear
    matches.forEach(([r,c]) => grid[r][c] = null);
    dropDown();
    fillBlanks();
    matches = findAllMatches();
  }
}

function dropDown(){
  for (let c=0;c<SIZE;c++){
    let write = SIZE-1;
    for (let r=SIZE-1;r>=0;r--){
      if (grid[r][c] !== null){
        grid[write][c] = grid[r][c];
        if (write !== r) grid[r][c] = null;
        write--;
      }
    }
    for (;write>=0;write--) grid[write][c] = null;
  }
}

function fillBlanks(){
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      if (grid[r][c] === null) grid[r][c] = randType();
    }
  }
}

btnShuffle.addEventListener("click", () => {
  makeGrid();
  renderBoard();
});

btnNewPuzzle.addEventListener("click", () => {
  pMoves = 0; pMatches = 0;
  savePuzzle();
  makeGrid();
  renderBoard();
});

// init puzzle
makeGrid();
renderBoard();
renderHUD();
