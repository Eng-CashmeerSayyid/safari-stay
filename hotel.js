// ================= STORAGE HELPERS =================
function getNum(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function setNum(key, value) {
  localStorage.setItem(key, String(value));
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
    willOrder: false,
    orderSnack: null,
    orderAt: 0,
    needsDelivery: false,
    mood: "🏨",
    moodUntil: 0,
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
const stageRoomSpots = Array.from(document.querySelectorAll(".roomSpot"));
const stageStationSpots = Array.from(document.querySelectorAll(".stationSpot"));
const stageReception = document.querySelector(".receptionSpot");

// stage icons
const spotIcons = {
  1: $("spotI1"),
  2: $("spotI2"),
  3: $("spotI3"),
  4: $("spotI4"),
};

// ================= TABS =================
(function tabSwitcher(){
  const tabHotel = $("tabHotel");
  const tabPuzzle = $("tabPuzzle");
  const viewHotel = $("viewHotel");
  const viewPuzzle = $("viewPuzzle");

  tabHotel.addEventListener("click", () => {
    tabHotel.classList.add("active");
    tabPuzzle.classList.remove("active");
    viewHotel.classList.add("active");
    viewPuzzle.classList.remove("active");
  });

  tabPuzzle.addEventListener("click", () => {
    tabPuzzle.classList.add("active");
    tabHotel.classList.remove("active");
    viewPuzzle.classList.add("active");
    viewHotel.classList.remove("active");
  });
})();

// ================= HOTEL LOGIC =================
const SNACKS = ["🍟","🍹","🍉","🍔"];
let heldSnack = null;

function now() { return Date.now(); }

function saveAll() {
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
  saveAll();
  renderAll();
});

btnClear.addEventListener("click", () => {
  if (!confirm("Reset save? This clears coins + hotel + puzzle stats.")) return;
  localStorage.clear();
  location.reload();
});

function findFirstEmptyRoom() {
  return rooms.find(r => r.status === "empty");
}

function setRoomMood(room, emoji, ms=1200) {
  room.mood = emoji;
  room.moodUntil = now() + ms;
}

function scheduleOrder(room) {
  room.willOrder = Math.random() < 0.65;
  if (!room.willOrder) return;

  const delay = 2000 + Math.floor(Math.random() * 5000); // 2s to 7s
  room.orderAt = now() + delay;
  room.orderSnack = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  room.needsDelivery = false;
}

function checkInLoop() {
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
    if (room.moodUntil && t > room.moodUntil) {
      room.mood = room.status === "occupied" ? "🙂" : (room.status === "empty" ? "🏨" : room.mood);
      room.moodUntil = 0;
    }

    if (room.status === "occupied" && room.willOrder && room.orderAt && t >= room.orderAt && !room.needsDelivery) {
      room.needsDelivery = true;
      setRoomMood(room, room.orderSnack, 1200);
    }

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
  setCoins(getCoins() + 2);
  setRoomMood(room, "😍", 1200);

  setHint(`Delivered! +2 coins ✅`);
  setHeldSnack(null);

  saveAll();
  renderAll();
}

function startCleaning(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.status !== "dirty") return;

  room.status = "cleaning";
  room.cleaningUntil = now() + 3000; // 3 sec
  setRoomMood(room, "🧼", 900);

  saveAll();
  renderAll();
}

function renderHUD() {
  hudCoins.textContent = String(getCoins());
  hudQueue.textContent = String(queue);
  hudServed.textContent = String(served);

  const heads = Math.max(1, Math.min(queue, 7));
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

    el.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.clean) return;
      deliverToRoom(room.id);
    });

    roomsEl.appendChild(el);
  });

  Array.from(document.querySelectorAll("[data-clean]")).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      startCleaning(Number(btn.dataset.clean));
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
  btn.addEventListener("click", () => deliverToRoom(Number(btn.dataset.room)));
});

stageStationSpots.forEach(btn => {
  btn.addEventListener("click", () => {
    const st = btn.dataset.station;
    if (st === "snack") setHint("Pick a snack from the Snack Corner, then tap the room that ordered.");
    if (st === "cleaning") setHint("To clean: tap a DIRTY room, then press CLEAN in the room card.");
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

// loop
setInterval(() => {
  checkInLoop();
  tickRooms();
  saveAll();
  renderAll();
}, 500);

renderAll();

// ===================== PUZZLE (MATCH-3) =====================
const boardEl = $("board");
const pMovesEl = $("pMoves");
const pMatchesEl = $("pMatches");
const btnShuffle = $("btnShuffle");
const btnNewPuzzle = $("btnNewPuzzle");

const SIZE = 6;
const TYPES = [
  { emoji: "🌴", cls: "t-palm" },
  { emoji: "🐚", cls: "t-shell" },
  { emoji: "🐠", cls: "t-fish" },
  { emoji: "🥥", cls: "t-coconut" },
  { emoji: "🌊", cls: "t-wave" },
  { emoji: "☀️", cls: "t-sun" },
];

let grid = [];
let selected = null;
let pMoves = getNum("pMoves", 0);
let pMatches = getNum("pMatches", 0);

function savePuzzle(){
  setNum("pMoves", pMoves);
  setNum("pMatches", pMatches);
}

function randType(){ return Math.floor(Math.random() * TYPES.length); }

function makeGrid(){
  grid = Array.from({length: SIZE}, () => Array.from({length: SIZE}, randType));
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      while (createsMatchAt(r,c)) grid[r][c] = randType();
    }
  }
}

function createsMatchAt(r,c){
  const t = grid[r][c];
  if (c>=2 && grid[r][c-1]===t && grid[r][c-2]===t) return true;
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
      tile.textContent = t.emoji;
      tile.addEventListener("click", () => onTileClick(r,c));
      boardEl.appendChild(tile);
    }
  }
  pMovesEl.textContent = String(pMoves);
  pMatchesEl.textContent = String(pMatches);
}

function onTileClick(r,c){
  if (!selected){
    selected = {r,c};
    // highlight via re-render quick add
    const idx = r*SIZE + c;
    boardEl.children[idx].classList.add("selected");
    return;
  }

  const prev = selected;
  selected = null;
  Array.from(boardEl.children).forEach(x => x.classList.remove("selected"));

  const dr = Math.abs(prev.r - r);
  const dc = Math.abs(prev.c - c);
  if (dr + dc !== 1) return;

  swap(prev.r, prev.c, r, c);
  const matches = findAllMatches();
  if (matches.length === 0){
    swap(prev.r, prev.c, r, c);
    return;
  }

  pMoves += 1;
  setCoins(getCoins() + 1);
  resolveMatches(matches);

  savePuzzle();
  saveAll();
  renderHUD();
  renderBoard();
}

function swap(r1,c1,r2,c2){
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;
}

function findAllMatches(){
  const matches = [];

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

  const seen = new Set();
  const out = [];
  for (const [rr,cc] of matches){
    const k = rr + "-" + cc;
    if (!seen.has(k)){ seen.add(k); out.push([rr,cc]); }
  }
  return out;
}

function resolveMatches(initial){
  let matches = initial;
  while (matches.length){
    pMatches += matches.length;
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

makeGrid();
renderBoard();
renderHUD();
