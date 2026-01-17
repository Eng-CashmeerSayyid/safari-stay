// ================= SETTINGS =================
const GUEST_STAY_MS = 10000;     // 10s stay
const CLEAN_MS = 3000;           // 3s cleaning
const ORDER_CHANCE = 0.45;       // not all guests order snacks
const AUTO_SPAWN_MS = 4500;      // guest arrival frequency

// ================= STATE =================
let coins = 0;
let served = 0;
let queue = 0;

const rooms = [
  makeRoom(), makeRoom(), makeRoom(), makeRoom()
];

function makeRoom(){
  return {
    state: "empty",       // empty | occupied | dirty | cleaning
    guestId: null,
    wantsSnack: false,
    snackDelivered: false,
    stayEndsAt: 0
  };
}

let mode = "none"; // none | clean | snack
let selectedRoomForAction = null;

// ================= UI REFS =================
const elCoins = document.getElementById("coins");
const elQueue = document.getElementById("queue");
const elServed = document.getElementById("served");
const elTimer = document.getElementById("timer");
const hint = document.getElementById("hint");
const queueDots = document.getElementById("queueDots");
const sprites = document.getElementById("sprites");
const modeTag = document.getElementById("modeTag");

const btnClean = document.getElementById("btnClean");
const btnSnack = document.getElementById("btnSnack");
const btnSpawn = document.getElementById("btnSpawn");
const btnReset = document.getElementById("btnReset");

// ================= COORDS (tuned for this layout) =================
// These coordinates match the door positions in THIS starter layout.
// If you change layout, we can adjust these quickly.
const SPOTS = {
  QUEUE:   { x: 860, y: 520 },
  COUNTER: { x: 510, y: 340 },

  R0:      { x: 245, y: 205 },
  R1:      { x: 505, y: 205 },
  R2:      { x: 765, y: 205 },
  R3:      { x: 1025, y: 205 },

  LOBBY:   { x: 360, y: 520 },

  CLEANER_HOME: { x: 650, y: 520 },
  BELLBOY_HOME: { x: 710, y: 520 }
};

// ================= SPRITES =================
const spriteMap = new Map();

function createSprite(id, type, emoji, x, y){
  const el = document.createElement("div");
  el.className = `sprite ${type}`;
  el.dataset.id = id;
  el.textContent = emoji;
  el.style.left = x + "px";
  el.style.top = y + "px";
  sprites.appendChild(el);
  spriteMap.set(id, el);
  return el;
}

function bubble(el, text, ms=900){
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  el.appendChild(b);
  setTimeout(()=> b.remove(), ms);
}

function moveTo(el, x, y, ms=850){
  el.style.transition = `left ${ms}ms linear, top ${ms}ms linear`;
  el.style.left = x + "px";
  el.style.top = y + "px";
}

function getSprite(id){
  return spriteMap.get(id) || null;
}

// Staff (always present)
const cleaner = createSprite("cleaner", "cleaner", "🧹", SPOTS.CLEANER_HOME.x, SPOTS.CLEANER_HOME.y);
const bellboy = createSprite("bellboy", "bellboy", "🛎️", SPOTS.BELLBOY_HOME.x, SPOTS.BELLBOY_HOME.y);

// ================= HUD / RENDER =================
function setHint(msg){
  hint.textContent = msg;
}

function setMode(m){
  mode = m;
  if(mode === "none"){
    modeTag.classList.add("hidden");
    selectedRoomForAction = null;
    setHint("Tap a room to view. Use Clean or Snacks when needed.");
    return;
  }
  modeTag.classList.remove("hidden");
  modeTag.textContent = mode === "clean" ? "MODE: CLEAN 🧹 (click a DIRTY room)" : "MODE: SNACKS 🧃 (click an OCCUPIED room with order)";
}

function renderHUD(){
  elCoins.textContent = String(coins);
  elQueue.textContent = String(queue);
  elServed.textContent = String(served);
  renderQueueDots();
  renderRoomsUI();
}

function renderQueueDots(){
  queueDots.innerHTML = "";
  for(let i=0;i<Math.min(queue,10);i++){
    const d = document.createElement("div");
    d.className = "dot";
    d.textContent = "🧍🏾";
    queueDots.appendChild(d);
  }
}

function renderRoomsUI(){
  rooms.forEach((r, i)=>{
    const status = document.getElementById(`status${i}`);
    const door = document.querySelector(`.hotspot[data-spot="R${i}"]`);

    // door state classes
    door.classList.remove("state-empty","state-occupied","state-dirty","state-cleaning","closed");
    door.classList.add(`state-${r.state}`);
    if(r.state !== "empty") door.classList.add("closed");

    // status text
    let txt = "";
    if(r.state === "empty") txt = "Empty ✅";
    if(r.state === "occupied") txt = r.wantsSnack && !r.snackDelivered ? "Occupied • Snack ordered 🛎️" : "Occupied";
    if(r.state === "dirty") txt = "Dirty ❗";
    if(r.state === "cleaning") txt = "Cleaning… ⏳";
    status.textContent = txt;
  });
}

// ================= GAME LOOP =================
let startTime = Date.now();

function formatTime(ms){
  const s = Math.floor(ms/1000);
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function tick(){
  // Timer
  elTimer.textContent = formatTime(Date.now() - startTime);

  // Checkout logic
  const now = Date.now();
  rooms.forEach((r, i)=>{
    if(r.state === "occupied" && now >= r.stayEndsAt){
      // checkout -> dirty
      r.state = "dirty";
      r.guestId = null;
      r.wantsSnack = false;
      r.snackDelivered = false;
      setHint(`Room ${101+i} checkout. Needs cleaning 🧹`);
    }
  });

  // Auto-checkin if queue exists
  autoCheckin();

  // Refresh UI frequently
  renderRoomsUI();

  requestAnimationFrame(tick);
}

// ================= GUEST FLOW =================
let guestCounter = 0;

function spawnGuest(){
  guestCounter += 1;
  const id = `g${guestCounter}`;
  const g = createSprite(id, "guest", "🧍🏾‍♀️", SPOTS.QUEUE.x, SPOTS.QUEUE.y);

  // slight offset per guest so they don't stack perfectly
  const offset = Math.min(queue, 6) * 18;
  g.style.left = (SPOTS.QUEUE.x + offset) + "px";
  g.style.top = (SPOTS.QUEUE.y - offset*0.35) + "px";

  queue += 1;
  bubble(g, "Hi!");
  setHint("A guest arrived! Checking for an empty room…");
  renderHUD();
}

function autoCheckin(){
  if(queue <= 0) return;

  const emptyIdx = rooms.findIndex(r => r.state === "empty");
  if(emptyIdx === -1) return;

  // take one from queue
  queue -= 1;

  // create a new guest sprite for the room (simple approach)
  // (Alternative: move the front guest from queue. We’ll do that later if you want.)
  guestCounter += 1;
  const gid = `g${guestCounter}`;
  const guest = createSprite(gid, "guest", Math.random() < 0.5 ? "🧍🏾‍♂️" : "🧍🏾‍♀️", SPOTS.COUNTER.x, SPOTS.COUNTER.y);
  bubble(guest, "Check-in");

  // assign to room
  const r = rooms[emptyIdx];
  r.state = "occupied";
  r.guestId = gid;
  r.wantsSnack = Math.random() < ORDER_CHANCE;
  r.snackDelivered = false;
  r.stayEndsAt = Date.now() + GUEST_STAY_MS;

  // walk to room
  const spot = SPOTS[`R${emptyIdx}`];
  setTimeout(()=>{
    moveTo(guest, spot.x, spot.y, 900);
    setTimeout(()=>{
      if(r.wantsSnack){
        bubble(guest, "Snacks 🛎️", 1100);
        setHint(`Guest in Room ${101+emptyIdx} ordered snacks. Tap 🧃 Snacks, then tap the room.`);
      } else {
        bubble(guest, "😊", 900);
        setHint(`Guest checked into Room ${101+emptyIdx}.`);
      }
      coins += 10;
      served += 1;
      renderHUD();
    }, 950);
  }, 200);

  renderHUD();
}

// ================= ACTION MODES =================
btnClean.addEventListener("click", ()=>{
  setMode(mode === "clean" ? "none" : "clean");
});

btnSnack.addEventListener("click", ()=>{
  setMode(mode === "snack" ? "none" : "snack");
});

btnSpawn.addEventListener("click", ()=>{
  spawnGuest();
});

btnReset.addEventListener("click", ()=>{
  if(!confirm("Reset game?")) return;
  localStorage.clear();
  location.reload();
});

// Click on doors
document.addEventListener("click", (e)=>{
  const door = e.target.closest(".hotspot");
  if(!door) return;

  const key = door.dataset.spot; // R0..R3
  const idx = Number(key.replace("R",""));
  const r = rooms[idx];

  // No mode: show info / quick hint
  if(mode === "none"){
    if(r.state === "empty"){
      setHint(`Room ${101+idx} is empty. Waiting for guests…`);
      return;
    }
    if(r.state === "occupied"){
      setHint(`Room ${101+idx} occupied${r.wantsSnack && !r.snackDelivered ? " • Snack ordered 🛎️" : ""}.`);
      return;
    }
    if(r.state === "dirty"){
      setHint(`Room ${101+idx} is dirty. Tap 🧹 Clean then tap the room.`);
      return;
    }
    if(r.state === "cleaning"){
      setHint(`Room ${101+idx} is cleaning…`);
      return;
    }
  }

  // CLEAN MODE
  if(mode === "clean"){
    if(r.state !== "dirty"){
      setHint(`That room is not dirty. Choose a DIRTY room.`);
      return;
    }
    doClean(idx);
    return;
  }

  // SNACK MODE
  if(mode === "snack"){
    if(r.state !== "occupied"){
      setHint(`Snacks can only be delivered to an OCCUPIED room.`);
      return;
    }
    if(!r.wantsSnack || r.snackDelivered){
      setHint(`No pending snack order in Room ${101+idx}.`);
      return;
    }
    doSnackDelivery(idx);
    return;
  }
});

function doClean(idx){
  const r = rooms[idx];
  r.state = "cleaning";
  renderHUD();

  // move cleaner
  bubble(cleaner, "On it!");
  moveTo(cleaner, SPOTS[`R${idx}`].x - 55, SPOTS[`R${idx}`].y + 25, 650);

  setHint(`Cleaning Room ${101+idx}…`);

  setTimeout(()=>{
    r.state = "empty";
    coins += 6;
    bubble(cleaner, "Done ✅", 900);
    moveTo(cleaner, SPOTS.CLEANER_HOME.x, SPOTS.CLEANER_HOME.y, 700);
    setHint(`Room ${101+idx} is clean and ready ✅`);
    renderHUD();
  }, CLEAN_MS);
}

function doSnackDelivery(idx){
  const r = rooms[idx];
  r.snackDelivered = true;
  renderHUD();

  bubble(bellboy, "Delivering!");
  moveTo(bellboy, SPOTS[`R${idx}`].x - 55, SPOTS[`R${idx}`].y + 25, 650);

  setHint(`Delivering snacks to Room ${101+idx}…`);

  setTimeout(()=>{
    coins += 8;
    const guestEl = getSprite(r.guestId);
    if(guestEl){
      bubble(guestEl, "😍", 1200);
    }
    bubble(bellboy, "Served ✅", 900);
    moveTo(bellboy, SPOTS.BELLBOY_HOME.x, SPOTS.BELLBOY_HOME.y, 700);
    setHint(`Snacks delivered to Room ${101+idx} ✅`);
    renderHUD();
  }, 900);
}

// ================= AUTO SPAWN =================
setInterval(()=>{
  // limit queue so it doesn't get crazy
  if(queue < 8){
    spawnGuest();
  }
}, AUTO_SPAWN_MS);

// ================= START =================
setMode("none");
renderHUD();
tick();
