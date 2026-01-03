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

// ================= GLOBAL COINS =================
function getCoins() { return getNum("coins", 0); }
function setCoins(n) { setNum("coins", n); updateHUD(); }
function addCoins(n) { setCoins(getCoins() + n); }

// ================= MOMBASA STATE =================
let roomsCount = getNum("mombasaRooms", 4); // default 4
if (roomsCount < 4) roomsCount = 4;

let queue = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

function loadRoomsState() {
  const raw = localStorage.getItem("mombasaRoomState");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveRoomsState(state) {
  localStorage.setItem("mombasaRoomState", JSON.stringify(state));
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

let roomState = loadRoomsState();
if (!Array.isArray(roomState) || roomState.length !== roomsCount) {
  roomState = Array.from({ length: roomsCount }, (_, i) => ({
    id: i + 1,
    status: "empty",        // empty | waitingOrder | ordered | happy
    guestEmoji: "🛏️",
    order: null,
    canOrderAt: Date.now() + rand(2000, 7000),
  }));
  saveRoomsState(roomState);
}

// ================= DOM =================
const $ = (id) => document.getElementById(id);

const elCoins = $("coins");
const elQueue = $("queue");
const elServed = $("served");

const elRooms = $("rooms");
const elDeliveryHint = $("deliveryHint");

// Tabs
const tabHotel = $("tabHotel");
const tabPuzzle = $("tabPuzzle");
const viewHotel = $("viewHotel");
const viewPuzzle = $("viewPuzzle");

// Buttons
const btnAddRoom = $("btnAddRoom");
const btnSpawnGuest = $("btnSpawnGuest");
const btnClear = $("btnClear");

// Snack buttons
const snackBtns = Array.from(document.querySelectorAll(".snack"));

// ================= HUD =================
function updateHUD() {
  if (elCoins) elCoins.textContent = getCoins();
  if (elQueue) elQueue.textContent = queue;
  if (elServed) elServed.textContent = served;
}
updateHUD();

// ================= TABS =================
function showView(which) {
  const hotel = which === "hotel";
  tabHotel.classList.toggle("active", hotel);
  tabPuzzle.classList.toggle("active", !hotel);
  viewHotel.classList.toggle("active", hotel);
  viewPuzzle.classList.toggle("active", !hotel);
}
tabHotel.addEventListener("click", () => showView("hotel"));
tabPuzzle.addEventListener("click", () => showView("puzzle"));

// ================= HOTEL =================
function saveCore() {
  setNum("mombasaRooms", roomsCount);
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
  saveRoomsState(roomState);
  updateHUD();
}

function renderRooms() {
  elRooms.innerHTML = "";

  roomState.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = "room";
    div.dataset.roomIndex = String(idx);

    const top = document.createElement("div");
    top.className = "roomTop";
    top.innerHTML = `<div>Room ${r.id}</div><div class="roomBadge">${r.status}</div>`;

    const emoji = document.createElement("div");
    emoji.className = "roomEmoji";
    emoji.textContent = r.guestEmoji;

    const info = document.createElement("div");
    info.className = "roomInfo";

    if (r.status === "empty") {
      info.innerHTML = `<span class="tag">Available</span>`;
    } else if (r.status === "waitingOrder") {
      info.innerHTML = `<span class="tag warn">Guest staying</span>`;
    } else if (r.status === "ordered") {
      info.innerHTML = `<span class="tag danger">Order: ${r.order}</span><span class="tag">Tap snack then room</span>`;
    } else if (r.status === "happy") {
      info.innerHTML = `<span class="tag">😍 Served</span>`;
    }

    div.appendChild(top);
    div.appendChild(emoji);
    div.appendChild(info);

    div.addEventListener("click", () => onRoomClick(idx));
    elRooms.appendChild(div);
  });
}

renderRooms();

// Delivery selection
let holdingSnack = null;

function updateDeliveryHint() {
  if (!holdingSnack) {
    elDeliveryHint.textContent = "No delivery selected.";
    return;
  }
  elDeliveryHint.textContent = `Selected: ${holdingSnack} → Tap the room that ordered to deliver.`;
}

snackBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const snack = btn.dataset.snack;
    holdingSnack = (holdingSnack === snack) ? null : snack;

    snackBtns.forEach(b => b.classList.toggle("selected", b.dataset.snack === holdingSnack));
    updateDeliveryHint();
  });
});

function onRoomClick(roomIdx) {
  const r = roomState[roomIdx];
  if (!holdingSnack) return;

  if (r.status !== "ordered") {
    elDeliveryHint.textContent = `That room didn’t order yet. Pick the room with an order.`;
    return;
  }
  if (r.order !== holdingSnack) {
    elDeliveryHint.textContent = `Wrong snack 😅 They ordered ${r.order}.`;
    return;
  }

  // deliver success
  served++;
  addCoins(2);

  r.status = "happy";
  r.guestEmoji = "😍";
  r.order = null;

  // guest leaves after a moment
  setTimeout(() => {
    r.status = "empty";
    r.guestEmoji = "🛏️";
    r.canOrderAt = Date.now() + rand(2500, 7000);
    saveCore();
    renderRooms();
    tryAssignGuestFromQueue();
  }, 1400);

  // clear holding snack
  holdingSnack = null;
  snackBtns.forEach(b => b.classList.remove("selected"));
  updateDeliveryHint();

  saveCore();
  renderRooms();
}

function spawnGuest() {
  const emptyIdx = roomState.findIndex(r => r.status === "empty");
  if (emptyIdx === -1) {
    queue++;
    saveCore();
    return;
  }

  const r = roomState[emptyIdx];
  r.status = "waitingOrder";
  r.guestEmoji = "🧳";
  r.order = null;
  r.canOrderAt = Date.now() + rand(2500, 9000);

  saveCore();
  renderRooms();
}

function tryAssignGuestFromQueue() {
  if (queue <= 0) return;
  const emptyIdx = roomState.findIndex(r => r.status === "empty");
  if (emptyIdx === -1) return;

  queue--;
  spawnGuest();
  saveCore();
}

function maybeCreateOrders() {
  const now = Date.now();

  // only 1 active order at a time
  const activeOrders = roomState.filter(r => r.status === "ordered").length;
  if (activeOrders >= 1) return;

  const candidates = roomState
    .filter(r => r.status === "waitingOrder" && now >= r.canOrderAt);

  if (candidates.length === 0) return;

  const r = candidates[rand(0, candidates.length - 1)];
  const snacks = ["🍟", "🍹", "🍉", "🍔"];

  r.status = "ordered";
  r.order = snacks[rand(0, snacks.length - 1)];
  r.guestEmoji = "😋";
  r.canOrderAt = now + rand(6000, 12000);

  saveCore();
  renderRooms();
}

setInterval(() => {
  maybeCreateOrders();
}, 800);

btnSpawnGuest.addEventListener("click", () => spawnGuest());

btnAddRoom.addEventListener("click", () => {
  const cost = 25;
  if (getCoins() < cost) {
    elDeliveryHint.textContent = `Not enough coins. You need ${cost}🪙. Go puzzle or serve guests.`;
    return;
  }

  addCoins(-cost);
  roomsCount++;

  roomState.push({
    id: roomsCount,
    status: "empty",
    guestEmoji: "🛏️",
    order: null,
    canOrderAt: Date.now() + rand(2000, 7000),
  });

  saveCore();
  renderRooms();
});

btnClear.addEventListener("click", () => {
  localStorage.removeItem("coins");
  localStorage.removeItem("mombasaRooms");
  localStorage.removeItem("mombasaQueue");
  localStorage.removeItem("mombasaGuestsServed");
  localStorage.removeItem("mombasaRoomState");
  localStorage.removeItem("puzzleMoves");
  localStorage.removeItem("puzzleMatches");
  location.reload();
});

// ================= PUZZLE (MATCH-3) =================
const elBoard = $("board");
const elPMoves = $("pMoves");
const elPMatches = $("pMatches");
const btnShuffle = $("btnShuffle");
const btnNewPuzzle = $("btnNewPuzzle");

// 6x6
const W = 6;
const H = 6;

// ✅ Mombasa-themed tile IDs (used for images + matching)
const candies = ["palm","shell","fish","coconut","wave","sun"];

// ✅ Emoji fallback (so tiles never go blank)
const emojiFallback = {
  palm: "🌴",
  shell: "🐚",
  fish: "🐠",
  coconut: "🥥",
  wave: "🌊",
  sun: "☀️"
};

let board = [];
let selected = null;
let pMoves = getNum("puzzleMoves", 0);
let pMatches = getNum("puzzleMatches", 0);

function savePuzzleStats(){
  setNum("puzzleMoves", pMoves);
  setNum("puzzleMatches", pMatches);
}

function updatePuzzleHUD(){
  elPMoves.textContent = pMoves;
  elPMatches.textContent = pMatches;
  updateHUD();
}

function idx(x,y){ return y*W + x; }
function xy(i){ return { x: i%W, y: Math.floor(i/W) }; }
function randomCandy(){ return candies[rand(0, candies.length - 1)]; }

function findMatches(){
  const matched = new Set();

  // rows
  for (let y=0;y<H;y++){
    let run = 1;
    for (let x=1;x<W;x++){
      const cur = board[idx(x,y)];
      const prev = board[idx(x-1,y)];
      if (cur === prev) run++;
      else {
        if (run >= 3){
          for (let k=0;k<run;k++) matched.add(idx(x-1-k,y));
        }
        run = 1;
      }
    }
    if (run >= 3){
      for (let k=0;k<run;k++) matched.add(idx(W-1-k,y));
    }
  }

  // cols
  for (let x=0;x<W;x++){
    let run = 1;
    for (let y=1;y<H;y++){
      const cur = board[idx(x,y)];
      const prev = board[idx(x,y-1)];
      if (cur === prev) run++;
      else {
        if (run >= 3){
          for (let k=0;k<run;k++) matched.add(idx(x,y-1-k));
        }
        run = 1;
      }
    }
    if (run >= 3){
      for (let k=0;k<run;k++) matched.add(idx(x,H-1-k));
    }
  }

  return matched;
}

function collapseAndRefill(matched){
  matched.forEach(i => board[i] = null);

  for (let x=0;x<W;x++){
    const col = [];
    for (let y=H-1;y>=0;y--){
      const v = board[idx(x,y)];
      if (v !== null) col.push(v);
    }
    while (col.length < H) col.push(randomCandy());
    for (let y=H-1;y>=0;y--){
      board[idx(x,y)] = col[H-1-y];
    }
  }
}

function makeBoard() {
  board = Array.from({length: W*H}, () => randomCandy());
  // remove initial matches
  for (let pass=0; pass<10; pass++){
    const m = findMatches();
    if (m.size === 0) break;
    m.forEach(i => { board[i] = randomCandy(); });
  }
}

function renderBoard() {
  elBoard.innerHTML = "";
  board.forEach((type, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = String(i);

    // ✅ image class
    tile.classList.add(`t-${type}`);

    // ✅ emoji fallback text (won’t disappear)
    tile.textContent = emojiFallback[type] || "❓";

    if (selected === i) tile.classList.add("selected");

    tile.addEventListener("click", () => onTileClick(i));
    elBoard.appendChild(tile);
  });
}

function areAdjacent(a,b){
  const A = xy(a), B = xy(b);
  const dx = Math.abs(A.x - B.x);
  const dy = Math.abs(A.y - B.y);
  return (dx + dy) === 1;
}

function swap(a,b){
  const t = board[a];
  board[a] = board[b];
  board[b] = t;
}

function popAnimation(indices){
  indices.forEach(i => {
    const tile = elBoard.querySelector(`.tile[data-index="${i}"]`);
    if (tile) tile.classList.add("pop");
  });
}

let busy = false;

function onTileClick(i){
  if (busy) return;

  if (selected === null){
    selected = i;
    renderBoard();
    return;
  }

  if (selected === i){
    selected = null;
    renderBoard();
    return;
  }

  if (!areAdjacent(selected, i)){
    selected = i;
    renderBoard();
    return;
  }

  busy = true;

  swap(selected, i);
  renderBoard();

  const matched = findMatches();
  if (matched.size === 0){
    setTimeout(() => {
      swap(selected, i);
      selected = null;
      renderBoard();
      busy = false;
    }, 120);
    return;
  }

  // ✅ successful move = +1 coin
  pMoves++;
  addCoins(1);
  savePuzzleStats();
  updatePuzzleHUD();

  function stepClear(){
    const m = findMatches();
    if (m.size === 0){
      selected = null;
      renderBoard();
      busy = false;
      return;
    }

    pMatches += m.size;
    savePuzzleStats();
    updatePuzzleHUD();

    popAnimation([...m]);
    setTimeout(() => {
      collapseAndRefill(m);
      renderBoard();
      setTimeout(stepClear, 80);
    }, 140);
  }

  setTimeout(stepClear, 120);
}

btnShuffle.addEventListener("click", () => {
  if (busy) return;
  busy = true;

  for (let i=board.length-1;i>0;i--){
    const j = rand(0,i);
    const t = board[i]; board[i]=board[j]; board[j]=t;
  }

  selected = null;
  renderBoard();

  setTimeout(() => {
    const m = findMatches();
    if (m.size) {
      collapseAndRefill(m);
      renderBoard();
    }
    busy = false;
  }, 120);
});

btnNewPuzzle.addEventListener("click", () => {
  if (busy) return;
  makeBoard();
  selected = null;
  renderBoard();
});

makeBoard();
updatePuzzleHUD();
renderBoard();

// keep HUD fresh
setInterval(updateHUD, 500);
