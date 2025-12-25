let coins = Number(localStorage.getItem("coins")) || 0;
let rooms = Number(localStorage.getItem("mombasaRooms")) || 0;
let cleanerHired = localStorage.getItem("mombasaCleaner") === "true";
let pending = Number(localStorage.getItem("mombasaEarnings")) || 0;

const ROOM_COST = 150;
const CLEANER_COST = 200;

function save() {
  localStorage.setItem("coins", coins);
  localStorage.setItem("mombasaRooms", rooms);
  localStorage.setItem("mombasaCleaner", cleanerHired);
  localStorage.setItem("mombasaEarnings", pending);
}

function render() {
  document.getElementById("coins").textContent = coins;
  document.getElementById("coinsLobby").textContent = coins;
  document.getElementById("roomsStation").textContent = `🛏️ Rooms: ${rooms}`;
  document.getElementById("cleanerStation").textContent =
    cleanerHired ? "🧹 Cleaner: Hired" : "🧹 Cleaner: Not hired";
  document.getElementById("progressText").textContent =
    `Pending earnings: ${pending} coins`;
}

window.onload = () => {
  const lobby = document.getElementById("lobbyScreen");
  const hotel = document.getElementById("hotelScreen");

  document.getElementById("playHotelBtn").onclick = () => {
    lobby.classList.add("hidden");
    hotel.classList.remove("hidden");
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
    save();
    render();
  };

  document.getElementById("hireCleanerBtn").onclick = () => {
    if (cleanerHired) return;
    if (coins < CLEANER_COST) return alert("Not enough coins");
    coins -= CLEANER_COST;
    cleanerHired = true;
    save();
    render();
  };

  document.getElementById("collectBtn").onclick = () => {
    coins += pending;
    pending = 0;
    save();
    render();
  };

  setInterval(() => {
    if (rooms > 0) pending += rooms * (cleanerHired ? 2 : 1);
    save();
    render();
  }, 5000);

  render();
};

