let coins = Number(localStorage.getItem("coins")) || 80;
let rooms = Number(localStorage.getItem("rooms")) || 0;
let cleaner = localStorage.getItem("cleaner") === "true";
let queue = 3;
let pending = 0;

const ROOM_COST = 150;
const CLEANER_COST = 200;

function save() {
  localStorage.setItem("coins", coins);
  localStorage.setItem("rooms", rooms);
  localStorage.setItem("cleaner", cleaner);
}

function render() {
  document.getElementById("coins").textContent = coins;
  document.getElementById("coinsLobby").textContent = coins;
  document.getElementById("roomsStation").textContent = rooms;
  document.getElementById("cleanerStation").textContent =
    cleaner ? "Hired" : "Not hired";
  document.getElementById("queueCount").textContent = queue;
  document.getElementById("progressText").textContent = pending;

  ["guest1","guest2","guest3"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (i < queue) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

document.getElementById("playHotelBtn").onclick = () => {
  document.getElementById("lobbyScreen").classList.add("hidden");
  document.getElementById("hotelScreen").classList.remove("hidden");
  render();
};

document.getElementById("saveProgressBtn").onclick = () => {
  save();
  alert("Progress saved ✅");
};

document.getElementById("buildRoomBtn").onclick = () => {
  if (coins < ROOM_COST) return alert("Not enough coins");
  coins -= ROOM_COST;
  rooms++;
  render();
};

document.getElementById("hireCleanerBtn").onclick = () => {
  if (cleaner) return;
  if (coins < CLEANER_COST) return alert("Not enough coins");
  coins -= CLEANER_COST;
  cleaner = true;
  render();
};

document.getElementById("checkInBtn").onclick = () => {
  if (queue <= 0) return alert("No guests waiting");
  queue--;
  coins += 25;
  render();
};

document.getElementById("collectBtn").onclick = () => {
  coins += pending;
  pending = 0;
  render();
};

setInterval(() => {
  if (rooms > 0) pending += rooms * (cleaner ? 2 : 1);
  render();
}, 4000);

render();

