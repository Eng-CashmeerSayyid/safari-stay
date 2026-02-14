// ===============================
// game.js (shared)
// Coins + progress saved in localStorage
// ===============================

const SS_KEYS = {
  COINS: "ss_coins",
  MOM_LEVEL: "ss_mombasa_level",
  UPGRADES: "ss_upgrades"
};

function ssGetCoins() {
  return Number(localStorage.getItem(SS_KEYS.COINS)) || 0;
}
function ssSetCoins(n) {
  localStorage.setItem(SS_KEYS.COINS, String(Math.max(0, Math.floor(n))));
  ssSyncCoinsUI();
}
function ssAddCoins(delta) {
  ssSetCoins(ssGetCoins() + delta);
}
function ssGetMombasaLevel() {
  const v = Number(localStorage.getItem(SS_KEYS.MOM_LEVEL)) || 1;
  return Math.min(10, Math.max(1, v));
}
function ssSetMombasaLevel(lvl) {
  const v = Math.min(10, Math.max(1, Math.floor(lvl)));
  localStorage.setItem(SS_KEYS.MOM_LEVEL, String(v));
  ssSyncLevelUI();
}
function ssGetUpgrades() {
  try { return JSON.parse(localStorage.getItem(SS_KEYS.UPGRADES)) || {}; }
  catch { return {}; }
}
function ssSetUpgrades(obj) {
  localStorage.setItem(SS_KEYS.UPGRADES, JSON.stringify(obj || {}));
  ssSyncUpgradesUI();
}

function ssSyncCoinsUI() {
  const el = document.getElementById("coinsTop");
  if (el) el.textContent = String(ssGetCoins());
}
function ssSyncLevelUI() {
  const top = document.getElementById("levelTop");
  if (top) top.textContent = String(ssGetMombasaLevel());

  const mapLvl = document.getElementById("mombasaLevel");
  if (mapLvl) mapLvl.textContent = String(ssGetMombasaLevel());
}
function ssSyncUpgradesUI() {
  const u = ssGetUpgrades();
  const count = Object.keys(u).filter(k => u[k]).length;
  const el = document.getElementById("upgradesCount");
  if (el) el.textContent = String(count);
}

function ssResetAll() {
  localStorage.removeItem(SS_KEYS.COINS);
  localStorage.removeItem(SS_KEYS.MOM_LEVEL);
  localStorage.removeItem(SS_KEYS.UPGRADES);
  ssSetCoins(0);
  ssSetMombasaLevel(1);
  ssSetUpgrades({});
}

document.addEventListener("DOMContentLoaded", () => {
  ssSyncCoinsUI();
  ssSyncLevelUI();
  ssSyncUpgradesUI();

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.addEventListener("click", () => ssResetAll());
});
