let coins = Number(localStorage.getItem("coins")) || 0;
let rooms = Number(localStorage.getItem("mombasaRooms")) || 0;
let queue = Number(localStorage.getItem("mombasaQueue")) || 0;
let cleanerHired = localStorage.getItem("mombasaCleaner") === "true";
let pending = Number(localStorage.getItem("mombasaEarnings")) || 0;

const ROOM_COST = 150;
const CLEANER_COST = 200;

function save() {
  localStorage.setItem("coins", String(coins));
  localStorage.setItem("mombasaRooms", String(rooms));
  localStorage.setItem("mombasaQueue", String(queue));
  localStorage.setItem("mombasaCleaner", cleanerHired ? "true" : "false");
  localStorage.setItem("mombasaEarnings", String(pending));
}

function render() {
  // coins in hotel screen + lobby screen
  const coinsEl = document.getElementById("coins");
  const coinsLobbyEl = document.getElementById("coinsLobby");
  if (coinsEl) coinsEl.textContent = coins;
  if (coinsLobbyEl) coinsLobbyEl.textContent = coins;

  const roomsStation = document.getElementById("roomsStation");
  if (roomsStation) roomsStation.textContent = `🛏️ Rooms: ${rooms}`;

  const cleanerStation = document.getElementById("cleanerStation");
  if (cleanerStation) {
    cleanerStation.textContent = cleanerHired
      ? "🧹 Cleaner: Hired"
      : "🧹 Cleaner: Not hired";
  }

  const progressText = document.getElementById("progressText");
  if (progressText) {
    progressText.textContent = `Pending earnings: ${pending} coins`;
  }

  renderQueue();
}

function renderQueue() {
  const qEl = document.getElementById("queueCount");
  if (qEl) qEl.textContent = queue;

  const g1 = document.getElementById("guest1");
  const g2 = document.getElementById("guest2");
  const g3 = document.getElementById("guest3");

  [g1, g2, g3].forEach(g => g && g.classList.remove("show"));

  if (queue >= 1 && g1) g1.classList.add("show");
  if (queue >= 2 && g2) g2.classList.add("show");
  if (queue >= 3 && g3) g3.classList.add("show");
}

function addGuest() {
  // We only visually show max 3
  queue = Math.min(queue + 1, 3);
  save();
  renderQueue();
}

window.onload = () => {
  const lobby = document.getElementById("lobbyScreen");
  const hotel = document.getElementById("hotelScreen");

  // PLAY -> go to hotel screen
  const playBtn = document.getElementById("playHotelBtn");
  if (playBtn) {
    playBtn.onclick = () => {
      if (lobby) lobby.classList.add("hidden");
      if (hotel) hotel.classList.remove("hidden");
      render();
    };
  }

  // SAVE PROGRESS
  const saveBtn = document.getElementById("saveProgressBtn");
  if (saveBtn) {
    saveBtn.onclick = () => {
      save();
      alert("Progress saved ✅");
    };
  }

  // BUILD ROOM
  const buildBtn = document.getElementById("buildRoomBtn");
  if (buildBtn) {
    buildBtn.onclick = () => {
      if (coins < ROOM_COST) return alert("Not enough coins");
      coins -= ROOM_COST;
      rooms++;
      save();
      render();
    };
  }

  // HIRE CLEANER
  const cleanerBtn = document.getElementById("hireCleanerBtn");
  if (cleanerBtn) {
    cleanerBtn.onclick = () => {
      if (cleanerHired) return alert("Cleaner already hired ✅");
      if (coins < CLEANER_COST) return alert("Not enough coins");
      coins -= CLEANER_COST;
      cleanerHired = true;
      save();
      render();
    };
  }

  // COLLECT EARNINGS
  const collectBtn = document.getElementById("collectBtn");
  if (collectBtn) {
    collectBtn.onclick = () => {
      coins += pending;
      pending = 0;
      save();
      render();
    };
  }

  // CHECK-IN GUEST
  const checkInBtn = document.getElementById("checkInBtn");
  if (checkInBtn) {
    checkInBtn.onclick = () => {
      if (queue <= 0) return alert("No guests in queue yet 🙂");

      queue -= 1;
      coins += 25; // reward for check-in

      save();
      render();
    };
  }

  // LOOP: earnings + guest arrivals
  setInterval(() => {
    // hotel makes money
    if (rooms > 0) pending += rooms * (cleanerHired ? 2 : 1);

    // 35% chance a guest arrives
    if (Math.random() < 0.35) addGuest();

    save();
    render();
  }, 5000);

  // initial render
  render();
};

