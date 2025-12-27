// ====== STORAGE HELPERS ======
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

// ====== GLOBAL COINS ======
function getCoins() {
  return getNum("coins", 0);
}
function setCoins(n) {
  setNum("coins", n);
}

// ====== MOMBASA STATE ======
let rooms = getNum("mombasaRooms", 0);
let cleaner = getBool("mombasaCleaner");
let bellboy = getBool("mombasaBellboy");
let queue = getNum("mombasaQueue", 0);
let served = getNum("mombasaGuestsServed", 0);

// ====== UI ======
const $ = (id) => document.getElementById(id);

function uiMessage(text) {
  const el = $("msg");
  if (el) el.textContent = text;
}

function render() {
  $("coins").textContent = getCoins();
  $("rooms").textContent = rooms;
  $("cleaner").textContent = cleaner ? "Yes" : "No";
  $("bellboy").textContent = bellboy ? "Yes" : "No";
  $("queue").textContent = queue;
  $("served").textContent = served;
}

function saveAll() {
  setNum("mombasaRooms", rooms);
  setBool("mombasaCleaner", cleaner);
  setBool("mombasaBellboy", bellboy);
  setNum("mombasaQueue", queue);
  setNum("mombasaGuestsServed", served);
}

// ====== GAME ACTIONS ======
function spend(cost) {
  const c = getCoins();
  if (c < cost) return false;
  setCoins(c - cost);
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  render();

  $("earnBtn").addEventListener("click", () => {
    setCoins(getCoins() + 25);
    uiMessage("You earned +25 coins 💰");
    render();
  });

  $("saveBtn").addEventListener("click", () => {
    saveAll();
    uiMessage("Saved ✅");
  });

  $("buyRoom").addEventListener("click", () => {
    if (!spend(100)) return uiMessage("Not enough coins for a room ❌");
    rooms += 1;
    uiMessage("Room built ✅ (+1 capacity)");
    saveAll();
    render();
  });

  $("buyCleaner").addEventListener("click", () => {
    if (cleaner) return uiMessage("Cleaner already hired ✅");
    if (!spend(150)) return uiMessage("Not enough coins to hire a cleaner ❌");
    cleaner = true;
    uiMessage("Cleaner hired ✅ Service is faster");
    saveAll();
    render();
  });

  $("buyBellboy").addEventListener("click", () => {
    if (bellboy) return uiMessage("Bellboy already hired ✅");
    if (!spend(200)) return uiMessage("Not enough coins to hire a bellboy ❌");
    bellboy = true;
    uiMessage("Bellboy hired ✅ You can serve more guests");
    saveAll();
    render();
  });

  $("callGuests").addEventListener("click", () => {
    queue += 3;
    uiMessage("New guests arrived! (+3) 🧳");
    saveAll();
    render();
  });

  $("serveGuest").addEventListener("click", () => {
    if (rooms <= 0) return uiMessage("Build at least 1 room first 🛏️");
    if (queue <= 0) return uiMessage("No guests in queue. Tap “Call New Guests” ✅");

    // simple capacity check: can't serve if too many guests vs rooms
    // (keeps it game-like but not complicated)
    queue -= 1;
    served += 1;

    // reward depends on staff upgrades
    let reward = 40;
    if (cleaner) reward += 10;
    if (bellboy) reward += 15;

    setCoins(getCoins() + reward);
    uiMessage(`Guest served ✅ You earned +${reward} coins 💰`);
    saveAll();
    render();
  });
});

