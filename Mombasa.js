// Safari Stay – Mombasa Hotel logic (persistent)

// Shared wallet with the main game
let coins = Number(localStorage.getItem("coins")) || 0;

// Hotel progress
let rooms = Number(localStorage.getItem("mombasaRooms")) || 0;
let cleanerHired = localStorage.getItem("mombasaCleaner") === "true";
let pendingEarnings = Number(localStorage.getItem("mombasaEarnings")) || 0;

// Costs
const ROOM_COST = 150;
const CLEANER_COST = 200;

// Earnings rules
// Each room generates coins over time. Cleaner boosts earnings.
function earningsPerMinute() {
  if (rooms <= 0) return 0;
  const base = rooms * 6;              // 6 coins per room per minute
  const boost = cleanerHired ? 1.5 : 1;
  return Math.floor(base * boost);
}

function save() {
  localStorage.setItem("coins", String(coins));
  localStorage.setItem("mombasaRooms", String(rooms));
  localStorage.setItem("mombasaCleaner", cleanerHired ? "true" : "false");
  localStorage.setItem("mombasaEarnings", String(pendingEarnings));
}

function $(id) { return document.getElementById(id); }

function render() {
  $("coins").textContent = coins;
  $("roomsStation").textContent = `🛏️ Rooms: ${rooms}`;
  $("cleanerStation").textContent = cleanerHired ? "🧹 Cleaner: Hired ✅" : "🧹 Cleaner: Not hired";

  const rate = earningsPerMinute();
  $("progressText").textContent =
    `Earnings rate: ${rate} coins/min • Pending: ${pendingEarnings} coins`;
}

function addEarningsTick() {
  // Add earnings every 10 seconds (like a mini idle game)
  const ratePerMin = earningsPerMinute();
  const per10s = Math.floor(ratePerMin / 6); // 60s / 10s = 6 ticks
  pendingEarnings += per10s;
  save();
  render();
}

// Buttons
function buildRoom() {
  if (coins < ROOM_COST) return alert("Not enough coins to build a room!");
  coins -= ROOM_COST;
  rooms += 1;
  save();
  render();
  alert("✅ Room built! Your hotel earns more now.");
}

function hireCleaner() {
  if (cleanerHired) return alert("Cleaner already hired ✅");
  if (coins < CLEANER_COST) return alert("Not enough coins to hire cleaner!");
  coins -= CLEANER_COST;
  cleanerHired = true;
  save();
  render();
  alert("✅ Cleaner hired! Earnings boosted.");
}

function collectEarnings() {
  if (pendingEarnings <= 0) return alert("No earnings to collect yet.");
  coins += pendingEarnings;
  pendingEarnings = 0;
  save();
  render();
  alert("💰 Earnings collected!");
}

// Wire up
window.addEventListener("load", () => {
  $("buildRoomBtn").addEventListener("click", buildRoom);
  $("hireCleanerBtn").addEventListener("click", hireCleaner);
  $("collectBtn").addEventListener("click", collectEarnings);

  render();

  // Start idle earnings loop
  setInterval(addEarningsTick, 10000);
});
