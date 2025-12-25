// ===============================
// SAFARI STAY — MOMBASA HOTEL
// Grand-Hotel-style simple economy
// ===============================

// --- SAVE STATE ---
let coins = Number(localStorage.getItem("coins")) || 0;
let rooms = Number(localStorage.getItem("mombasaRooms")) || 0;
let queue = Number(localStorage.getItem("mombasaQueue")) || 0;
let cleanerHired = localStorage.getItem("mombasaCleaner") === "true";
let pending = Number(localStorage.getItem("mombasaEarnings")) || 0;

// --- COSTS ---
const ROOM_COST = 150;
const CLEANER_COST = 200;

// --- HELPERS ---
function save() {
  localStorage.setItem("coins", String(coins));
  localStorage.setItem("mombasaRooms", String(rooms));
  localStorage.setItem("mombasaQueue", String(queue));
  localStorage.setItem("mombasaCleaner", cleanerHired ? "true" : "false");
  localStorage.setItem("mombasaEarnings", String(pending));
}

function render() {
  const coinsEl = document.getElementById("coins");
  const coinsLobbyEl = document.getElementById("coinsLobby");
  const roomsStationEl = document.getElementById("roomsStation");
  const cleanerStationEl = document.getElementById("cleanerStation");
  const progressTextEl = document.getElementById("progressText");
  const qCount = document.getElementById("queueCount");

  if (coinsEl) coinsEl.textContent = coins;
  if (coinsLobbyEl) coinsLobbyEl.textContent = coins;

  if (roomsStationEl) roomsStationEl.textContent = `🛏️ Rooms: ${rooms}`;
  if (cleanerStationEl)
    cleanerStationEl.textContent = cleanerHired ? "🧹 Cleaner: Hired" : "🧹 Cleaner: Not hired";

  if (progressTextEl) progressTextEl.textContent = `Pending earnings: ${pending} coins`;
  if (qCount) qCount.textContent = queue;

  renderQueue();
}

function renderQueue() {
  const g1 = document.getElementById("guest1");
  const g2 = document.getElementById("guest2");
  const g3 = document.getElementById("guest3");

  [g1, g2, g3].forEach(g => {
    if (!g) return;
    g.classList.remove("show");
  });

  if (queue >= 1 && g1) g1.classList.add("show");
  if (queue >= 2 && g2) g2.classList.add("show");
  if (queue >= 3 && g3) g3.classList.add("show");
}

function addGuest() {
  queue = Math.min(queue + 1, 3);
  save();
  render();
}

// --- SCREEN NAV ---
function goHotel() {
  const lobby = document.getElementById("lobbyScreen");
  const hotel = document.getElementById("hotelScreen");
  if (!lobby || !hotel) return;

  lobby.classList.add("hidden");
  hotel.classList.remove("hidden");
  render();
}

function backLobby() {
  const lobby = document.getElementById("lobbyScreen");
  const hotel = document.getElementById("hotelScreen");
  if (!lobby || !hotel) return;

  hotel.classList.add("hidden");
  lobby.classList.remove("hidden");
  render();
}

// --- ACTIONS ---
function buildRoom() {
  if (coins < ROOM_COST) return alert("Not enough coins 🥲");
  coins -= ROOM_COST;
  rooms += 1;
  save();
  render();
}

function hireCleaner() {
  if (cleanerHired) return alert("Cleaner already hired ✅");
  if (coins < CLEANER_COST) return alert("Not enough coins 🥲");
  coins -= CLEANER_COST;
  cleanerHired = true;
  save();
  render();
}

function collectEarnings() {
  if (pending <= 0) return alert("No earnings yet 🙂");
  coins += pending;
  pending = 0;
  save();
  render();
}

function checkInGuest() {
  if (queue <= 0) return alert("No guests in queue yet 🙂");
  queue -= 1;
  coins += 25; // check-in bonus
  save();
  render();
}

// --- LOOP: earn + new guests ---
function tick() {
  // earnings
  if (rooms > 0) {
    pending += rooms * (cleanerHired ? 2 : 1);
  }

  // guest arrival chance
  if (Math.random() < 0.35) addGuest();

  save();
  render();
}

// --- START ---
window.onload = () => {
  // Buttons
  const playBtn = document.getElementById("playHotelBtn");
  const saveBtn = document.getElementById("saveProgressBtn");
  const buildBtn = document.getElementById("buildRoomBtn");
  const cleanerBtn = document.getElementById("hireCleanerBtn");
  const collectBtn = document.getElementById("collectBtn");
  const checkInBtn = document.getElementById("checkInBtn");
  const backBtn = document.getElementById("backBtn");

  if (playBtn) playBtn.onclick = goHotel;
  if (saveBtn) saveBtn.onclick = () => { save(); alert("Progress saved ✅"); };

  if (buildBtn) buildBtn.onclick = buildRoom;
  if (cleanerBtn) cleanerBtn.onclick = hireCleaner;
  if (collectBtn) collectBtn.onclick = collectEarnings;
  if (checkInBtn) checkInBtn.onclick = checkInGuest;

  if (backBtn) backBtn.onclick = backLobby;

  // First paint
  render();

  // Loop
  setInterval(tick, 5000);
};

