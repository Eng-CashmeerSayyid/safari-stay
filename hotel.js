/* ==========================================================
   SAFARI STAY – MOMBASA HOTEL MANIA (FULL)
   Includes:
   ✅ VIP guests + priority queue
   ✅ Room cooldown (⏳) after cleaning before next check-in
   ✅ Pool + ocean visuals inside map
   ✅ Bellboy AUTO serve (if hired)
   ✅ Cleaner MANUAL (if hired) + queue auto-seating after cleaning
   ✅ Progression unlock to Masai Mara
   ✅ Optional sounds toggle (safe)
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Tabs ---------- */
  (function(){
    const tabPuzzle = document.getElementById("tabPuzzle");
    const tabHotel  = document.getElementById("tabHotel");
    const viewPuzzle = document.getElementById("viewPuzzle");
    const viewHotel  = document.getElementById("viewHotel");
    if (!tabPuzzle || !tabHotel || !viewPuzzle || !viewHotel) return;

    function showPuzzle(){
      tabPuzzle.classList.add("active");
      tabHotel.classList.remove("active");
      viewPuzzle.classList.remove("hidden");
      viewHotel.classList.add("hidden");
    }
    function showHotel(){
      tabHotel.classList.add("active");
      tabPuzzle.classList.remove("active");
      viewHotel.classList.remove("hidden");
      viewPuzzle.classList.add("hidden");
    }
    tabPuzzle.onclick = showPuzzle;
    tabHotel.onclick = showHotel;
  })();

  /* ---------- Elements ---------- */
  const servedEl = document.getElementById("served");
  const queueCountEl = document.getElementById("queueCount");
  const roomsFreeEl = document.getElementById("roomsFree");
  const hotelCashEl = document.getElementById("hotelCash");
  const cleanerModeEl = document.getElementById("cleanerMode");
  const spawnGuestBtn = document.getElementById("spawnGuestBtn");

  const coinsTopEl = document.getElementById("coins"); // shared coins display

  // Upgrades UI
  const roomCostEl = document.getElementById("roomCost");
  const buyRoomBtn = document.getElementById("buyRoomBtn");
  const roomLevelEl = document.getElementById("roomLevel");

  const hireBellBtn = document.getElementById("hireBellBtn");
  const bellStatusEl = document.getElementById("bellStatus");

  const hireCleanBtn = document.getElementById("hireCleanBtn");
  const cleanStatusEl = document.getElementById("cleanStatus");

  const poolStatusEl = document.getElementById("poolStatus");
  const poolHudEl = document.getElementById("poolHud");

  // Progression UI
  const needServedEl = document.getElementById("needServed");
  const needCoinsEl = document.getElementById("needCoins");
  const maraStatusEl = document.getElementById("maraStatus");
  const goMaraBtn = document.getElementById("goMaraBtn");

  // Sound UI
  const soundBtn = document.getElementById("soundBtn");
  const soundStateEl = document.getElementById("soundState");

  /* ---------- Map / Stations ---------- */
  const mapEl = document.getElementById("hotelMap");
  const guestLayer = document.getElementById("guestLayer");

  const stReception = document.getElementById("stReception");
  const stSnack = document.getElementById("stSnack");
  const stClean = document.getElementById("stClean");
  const stExit = document.getElementById("stExit");

  /* ---------- Rooms ---------- */
  const roomEls = [
    document.getElementById("room0"),
    document.getElementById("room1"),
    document.getElementById("room2"),
    document.getElementById("room3"),
  ];
  const badgeEls = [
    document.getElementById("badge0"),
    document.getElementById("badge1"),
    document.getElementById("badge2"),
    document.getElementById("badge3"),
  ];

  /* ---------- Workers ---------- */
  const bellboyEl = document.getElementById("bellboy");
  const cleanerEl = document.getElementById("cleaner");

  /* ---------- Storage Keys ---------- */
  const COIN_KEY = "coins";
  const KEY_BELL = "mombasaBellboy";
  const KEY_CLEAN = "mombasaCleaner";
  const KEY_ROOM_LVL = "mombasaRoomLevel";
  const KEY_SOUND = "soundOn";
  const KEY_MARA = "unlockMara";

  /* ---------- Economy / rules ---------- */
  const BASE_PAY_COINS = 5;

  // room cooldown after cleaning (prevents instant flip)
  const ROOM_COOLDOWN_MS = 1400;

  // progression
  const NEED_SERVED = 10;
  const NEED_COINS = 200;

  /* Requests */
  const ITEMS = {
    soda:      { icon:"🥤", seconds: 7,  bonus: 2 },
    coconut:   { icon:"🥥", seconds: 8,  bonus: 3 },
    pineapple: { icon:"🍍", seconds: 12, bonus: 5 }
  };
  const ITEM_KEYS = Object.keys(ITEMS);

  /* Pool bonuses */
  const POOL_STAY_MS = 3800;
  const POOL_TIP_BONUS = 2;

  /* ---------- Guest types ---------- */
  // VIP: more patient and pays more
  const GUEST_TYPES = [
    { name: "VIP", badge: "👑", payMult: 1.6, patienceMult: 1.25, chance: 0.18 },
    { name: "Regular", badge: "🙂", payMult: 1.0, patienceMult: 1.0, chance: 0.62 },
    { name: "Budget", badge: "🎒", payMult: 0.85, patienceMult: 0.85, chance: 0.20 },
  ];

  function rollGuestType(){
    const r = Math.random();
    let acc = 0;
    for (const t of GUEST_TYPES){
      acc += t.chance;
      if (r <= acc) return t;
    }
    return GUEST_TYPES[1];
  }

  /* ---------- Room State ---------- */
  const ROOM_FREE  = "FREE";
  const ROOM_OCC   = "OCCUPIED";
  const ROOM_DIRTY = "DIRTY";

  let rooms = [
    { status: ROOM_FREE,  guestId: null, cooldownUntil: 0 },
    { status: ROOM_FREE,  guestId: null, cooldownUntil: 0 },
    { status: ROOM_FREE,  guestId: null, cooldownUntil: 0 },
    { status: ROOM_FREE,  guestId: null, cooldownUntil: 0 },
  ];

  /* ---------- World ---------- */
  let served = 0;
  let hotelCash = 0;

  let guests = [];
  let queue = [];
  let nextGuestId = 1;

  /* ---------- Hire state ---------- */
  let bellHired = localStorage.getItem(KEY_BELL) === "true";
  let cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

  /* ---------- Sound (safe) ---------- */
  let soundOn = (localStorage.getItem(KEY_SOUND) ?? "true") === "true";
  function setSoundUI(){
    if (soundStateEl) soundStateEl.textContent = soundOn ? "ON" : "OFF";
  }
  function playSound(name){
    if (!soundOn) return;
    // optional files (won't crash if missing)
    const map = {
      click: "sounds/swap.mp3",
      coin: "sounds/coin.mp3",
      match: "sounds/match.mp3"
    };
    const src = map[name];
    if (!src) return;
    try {
      const a = new Audio(src);
      a.volume = 0.6;
      a.play().catch(()=>{});
    } catch {}
  }
  soundBtn?.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem(KEY_SOUND, String(soundOn));
    setSoundUI();
    playSound("click");
  });
  setSoundUI();

  /* ---------- Helpers ---------- */
  function setPos(el, x, y){ if (el){ el.style.left = x+"px"; el.style.top = y+"px"; } }

  function centerOf(el){
    const mapRect = mapEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x:(r.left-mapRect.left)+r.width/2-22, y:(r.top-mapRect.top)+r.height/2-22 };
  }

  function moveToward(entity){
    if (!entity.target) return false;
    const dx = entity.target.x - entity.x;
    const dy = entity.target.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2){
      entity.x = entity.target.x;
      entity.y = entity.target.y;
      entity.target = null;
      return true;
    }
    entity.x += (dx/dist) * entity.speed;
    entity.y += (dy/dist) * entity.speed;
    return false;
  }

  function getCoins(){
    return Number(localStorage.getItem(COIN_KEY)) || 0;
  }
  function addGlobalCoins(amount){
    const current = getCoins();
    localStorage.setItem(COIN_KEY, String(current + amount));
    if (coinsTopEl) coinsTopEl.textContent = String(current + amount);
  }
  function spendCoins(amount){
    const current = getCoins();
    if (current < amount) return false;
    localStorage.setItem(COIN_KEY, String(current - amount));
    if (coinsTopEl) coinsTopEl.textContent = String(current - amount);
    return true;
  }

  /* ---------- Room Level + Pool unlock ---------- */
  function getRoomLevel(){ return Number(localStorage.getItem(KEY_ROOM_LVL)) || 0; }
  function setRoomLevel(v){ localStorage.setItem(KEY_ROOM_LVL, String(v)); }
  function poolUnlocked(){ return getRoomLevel() >= 1; }

  /* ---------- Pool build ---------- */
  let poolZoneEl = null;
  let poolLockedEl = null;

  function buildOceanAndPool(){
    if (!mapEl) return;

    if (!mapEl.querySelector(".oceanSky")){
      const ocean = document.createElement("div");
      ocean.className = "oceanSky";
      mapEl.appendChild(ocean);
    }

    if (!mapEl.querySelector(".poolZone")){
      poolZoneEl = document.createElement("div");
      poolZoneEl.className = "poolZone";

      const water = document.createElement("div");
      water.className = "poolWater";

      const deck = document.createElement("div");
      deck.className = "poolDeck";
      deck.textContent = "POOL 🏊";

      poolLockedEl = document.createElement("div");
      poolLockedEl.className = "poolLockBadge";
      poolLockedEl.textContent = "Locked 🔒 (Room Lvl 1)";

      poolZoneEl.appendChild(water);
      poolZoneEl.appendChild(deck);
      poolZoneEl.appendChild(poolLockedEl);
      mapEl.appendChild(poolZoneEl);
    } else {
      poolZoneEl = mapEl.querySelector(".poolZone");
      poolLockedEl = mapEl.querySelector(".poolLockBadge");
    }

    refreshPoolUI();
  }

  function refreshPoolUI(){
    const ok = poolUnlocked();
    if (poolZoneEl) poolZoneEl.classList.toggle("locked", !ok);
    if (poolLockedEl) poolLockedEl.style.display = ok ? "none" : "block";

    if (poolStatusEl) poolStatusEl.textContent = ok ? "Unlocked ✅" : "Locked 🔒";
    if (poolHudEl) poolHudEl.textContent = ok ? "Unlocked ✅" : "Locked 🔒";
  }

  function poolSpot(){
    const zr = poolZoneEl.getBoundingClientRect();
    const mr = mapEl.getBoundingClientRect();
    return { x:(zr.left-mr.left)+zr.width/2-22, y:(zr.top-mr.top)+zr.height/2-22 };
  }

  /* ---------- Requests rolling ---------- */
  function rollRequests(){
    const r = Math.random();
    let count = 0;
    if (r < 0.30) count = 0;
    else if (r < 0.68) count = 1;
    else if (r < 0.92) count = 2;
    else count = 3;

    const picks = [];
    for (let i=0;i<count;i++){
      picks.push(ITEM_KEYS[Math.floor(Math.random()*ITEM_KEYS.length)]);
    }
    return picks;
  }

  /* ---------- Rooms helpers ---------- */
  function roomUsable(i){
    return rooms[i].status === ROOM_FREE && Date.now() >= (rooms[i].cooldownUntil || 0);
  }
  function roomsFreeCount(){
    return rooms.filter((r, i) => roomUsable(i)).length;
  }
  function findFreeRoomIndex(){
    for (let i=0;i<rooms.length;i++){
      if (roomUsable(i)) return i;
    }
    return -1;
  }

  function setRoomStatus(i, status){
    rooms[i].status = status;

    // badge shows status + cooldown
    if (badgeEls[i]) {
      if (status === ROOM_FREE)  badgeEls[i].textContent = "✅";
      if (status === ROOM_OCC)   badgeEls[i].textContent = "🧳";
      if (status === ROOM_DIRTY) badgeEls[i].textContent = "🧺";
    }

    updateHUD();
  }

  function setRoomCooldown(i, ms){
    rooms[i].cooldownUntil = Date.now() + ms;
    // show ⏳ while cooling
    if (badgeEls[i]) badgeEls[i].textContent = "⏳";
  }

  /* ---------- HUD + Progression ---------- */
  function updateProgressionUI(){
    if (needServedEl) needServedEl.textContent = String(NEED_SERVED);
    if (needCoinsEl) needCoinsEl.textContent = String(NEED_COINS);

    const coins = getCoins();
    const unlocked = (served >= NEED_SERVED && coins >= NEED_COINS) || localStorage.getItem(KEY_MARA)==="true";

    if (unlocked){
      localStorage.setItem(KEY_MARA, "true");
      if (maraStatusEl) maraStatusEl.textContent = "Unlocked ✅";
      if (goMaraBtn) goMaraBtn.classList.remove("hidden");
    } else {
      if (maraStatusEl) maraStatusEl.textContent = "Locked 🔒";
      if (goMaraBtn) goMaraBtn.classList.add("hidden");
    }
  }

  function updateHUD(){
    if (roomsFreeEl) roomsFreeEl.textContent = String(roomsFreeCount());
    if (queueCountEl) queueCountEl.textContent = String(queue.length);
    if (servedEl) servedEl.textContent = String(served);
    if (hotelCashEl) hotelCashEl.textContent = String(hotelCash);

    if (cleanerModeEl){
      if (!cleanerHired) cleanerModeEl.textContent = "Hire Cleaner to clean";
      else cleanerModeEl.textContent = (cleanerStep === "TAP_STATION") ? "Tap 🧴 station" : "Tap 🧺 dirty room";
    }

    // top coins refresh (in case puzzle changed it)
    if (coinsTopEl) coinsTopEl.textContent = String(getCoins());

    refreshPoolUI();
    updateProgressionUI();
    syncUpgradeUI();
  }

  /* ---------- Upgrade UI + logic ---------- */
  function roomUpgradeCost(){
    // scales a bit
    const lvl = getRoomLevel();
    return 20 + (lvl * 15);
  }

  function syncUpgradeUI(){
    const lvl = getRoomLevel();
    if (roomLevelEl) roomLevelEl.textContent = String(lvl);
    if (roomCostEl) roomCostEl.textContent = String(roomUpgradeCost());

    bellHired = localStorage.getItem(KEY_BELL) === "true";
    cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

    if (bellStatusEl) bellStatusEl.textContent = bellHired ? "Hired ✅" : "Not hired";
    if (cleanStatusEl) cleanStatusEl.textContent = cleanerHired ? "Hired ✅" : "Not hired";

    if (bellboyEl) bellboyEl.style.display = bellHired ? "" : "none";
    if (cleanerEl) cleanerEl.style.display = cleanerHired ? "" : "none";
  }

  buyRoomBtn?.addEventListener("click", () => {
    playSound("click");
    const cost = roomUpgradeCost();
    if (!spendCoins(cost)) return;
    setRoomLevel(getRoomLevel() + 1);
    updateHUD();
  });

  hireBellBtn?.addEventListener("click", () => {
    playSound("click");
    if (bellHired) return;
    if (!spendCoins(30)) return;
    localStorage.setItem(KEY_BELL, "true");
    updateHUD();
    window.dispatchEvent(new Event("staffUpdated"));
  });

  hireCleanBtn?.addEventListener("click", () => {
    playSound("click");
    if (cleanerHired) return;
    if (!spendCoins(30)) return;
    localStorage.setItem(KEY_CLEAN, "true");
    updateHUD();
    window.dispatchEvent(new Event("staffUpdated"));
  });

  /* ---------- Queue priority (VIP first) ---------- */
  function dequeueNextGuest(){
    // VIP priority
    const vipIndex = queue.findIndex(g => g.type?.name === "VIP");
    if (vipIndex !== -1) return queue.splice(vipIndex, 1)[0];
    return queue.shift();
  }

  function seatQueueIntoFreeRooms(){
    while (queue.length > 0){
      const freeRoom = findFreeRoomIndex();
      if (freeRoom === -1) break;

      const g = dequeueNextGuest();
      if (!g) break;

      g.roomIndex = freeRoom;
      setRoomStatus(freeRoom, ROOM_OCC);

      g.state = "TO_ROOM";
      g.target = centerOf(roomEls[freeRoom]);
    }
    updateHUD();
  }

  /* ---------- Guests ---------- */
  function makeGuest(){
    const el = document.createElement("div");
    el.className = "guestToken";
    el.textContent = "🧳";
    guestLayer.appendChild(el);

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const ring = document.createElement("div");
    ring.className = "ring";
    bubble.appendChild(ring);
    bubble.style.display = "none";
    el.appendChild(bubble);

    const type = rollGuestType();
    el.dataset.badge = type.badge;

    return {
      id: nextGuestId++,
      el, bubble, ring,
      x: 10, y: 10,
      speed: 2.0,
      state: "SPAWN",
      target: null,

      type,
      roomIndex: null,
      requests: [],
      currentRequest: null,
      requestDeadline: 0,
      totalBonus: 0,
      angry: false,

      poolDoneAt: 0,
      usedPool: false,
    };
  }

  function showGuestBubble(g, icon){
    g.bubble.style.display = "grid";
    [...g.bubble.childNodes].forEach(n => { if (n !== g.ring) g.bubble.removeChild(n); });
    const iconNode = document.createElement("div");
    iconNode.textContent = icon;
    g.bubble.appendChild(iconNode);
  }
  function hideGuestBubble(g){ g.bubble.style.display = "none"; }

  function queueSpot(index){
    const base = centerOf(stReception);
    return { x: base.x - 40, y: base.y + 55 + index * 30 };
  }

  function sendToReception(g){
    g.state = "TO_RECEPTION";
    g.target = centerOf(stReception);
  }

  function onArriveReception(g){
    const freeRoom = findFreeRoomIndex();
    if (freeRoom === -1){
      g.state = "QUEUED";
      g.target = null;
      queue.push(g);
      updateHUD();
      return;
    }

    g.roomIndex = freeRoom;
    setRoomStatus(freeRoom, ROOM_OCC);

    g.state = "TO_ROOM";
    g.target = centerOf(roomEls[freeRoom]);
  }

  function startNextRequestOrCheckout(g){
    if (g.requests.length === 0){
      g.state = "TO_PAY";
      hideGuestBubble(g);
      g.el.classList.remove("angry");
      g.angry = false;
      g.target = centerOf(stReception);
      return;
    }

    const next = g.requests.shift();
    g.currentRequest = next;
    const def = ITEMS[next];

    const patienceMs = def.seconds * 1000 * (g.type?.patienceMult ?? 1);
    g.requestDeadline = Date.now() + patienceMs;

    g.state = "WAITING";
    g.angry = false;
    g.el.classList.remove("angry");
    showGuestBubble(g, def.icon);
  }

  function onArriveRoom(g){
    if (poolUnlocked() && !g.usedPool){
      g.usedPool = true;
      g.state = "TO_POOL";
      g.target = poolSpot();
      return;
    }

    g.requests = rollRequests();
    g.totalBonus = 0;
    g.currentRequest = null;
    startNextRequestOrCheckout(g);
  }

  function onArrivePool(g){
    g.state = "POOLING";
    g.poolDoneAt = Date.now() + POOL_STAY_MS;
  }

  function finishPool(g){
    g.totalBonus += POOL_TIP_BONUS;
    if (g.roomIndex !== null){
      g.state = "TO_ROOM_AFTER_POOL";
      g.target = centerOf(roomEls[g.roomIndex]);
    } else {
      g.requests = rollRequests();
      startNextRequestOrCheckout(g);
    }
  }

  function onArriveRoomAfterPool(g){
    g.requests = rollRequests();
    g.currentRequest = null;
    startNextRequestOrCheckout(g);
  }

  function onArrivePay(g){
    served += 1;
    playSound("coin");

    const payMult = g.type?.payMult ?? 1;
    const base = g.angry ? Math.max(1, BASE_PAY_COINS - 3) : BASE_PAY_COINS;
    const payCoins = Math.max(1, Math.round((base + g.totalBonus) * payMult));

    hotelCash += payCoins;
    addGlobalCoins(payCoins);

    if (g.roomIndex !== null){
      setRoomStatus(g.roomIndex, ROOM_DIRTY);
      g.roomIndex = null;
    }

    g.state = "TO_EXIT";
    g.target = centerOf(stExit);

    updateHUD();
  }

  function onArriveExit(g){
    g.state = "DONE";
    hideGuestBubble(g);
    g.el.remove();
    guests = guests.filter(x => x.id !== g.id);
  }

  /* ---------- Patience + ring ---------- */
  function updatePatienceAll(){
    const now = Date.now();
    guests.forEach(g => {
      if (g.state !== "WAITING" || !g.currentRequest) return;

      const def = ITEMS[g.currentRequest];
      const total = def.seconds * 1000 * (g.type?.patienceMult ?? 1);
      const left = g.requestDeadline - now;
      const pct = Math.max(0, Math.min(1, left / total));

      g.ring.style.borderWidth = (3 + (1 - pct) * 2) + "px";
      g.ring.style.opacity = String(0.6 + (1 - pct) * 0.4);

      if (left <= 0 && !g.angry){
        g.angry = true;
        g.el.classList.add("angry");
        g.currentRequest = null;
        hideGuestBubble(g);
        setTimeout(() => startNextRequestOrCheckout(g), 200);
      }
    });
  }

  /* ---------- Bellboy AUTO serve ---------- */
  function findServeTargetGuest(){
    // prioritize VIP waiting first
    return guests.find(g => g.state==="WAITING" && g.currentRequest && g.type?.name==="VIP")
        || guests.find(g => g.state==="WAITING" && g.currentRequest);
  }
  function getGuestById(id){ return guests.find(g => g.id===id); }

  let bellboy = { x: 220, y: 290, speed: 2.7, state: "IDLE", target: null, carrying: null, targetGuestId: null };

  function bellboyTryServe(){
    if (!bellHired) return;
    if (bellboy.state !== "IDLE") return;

    const targetGuest = findServeTargetGuest();
    if (!targetGuest) return;

    bellboy.targetGuestId = targetGuest.id;
    bellboy.carrying = targetGuest.currentRequest;
    bellboy.state = "TO_SNACK";
    bellboy.target = centerOf(stSnack);
  }

  function onBellboySnack(){
    bellboy.state = "TO_GUEST";
    const g = getGuestById(bellboy.targetGuestId);
    if (!g){
      bellboy.state = "RETURNING";
      bellboy.target = centerOf(stSnack);
      return;
    }
    bellboy.target = { x: g.x, y: g.y };
  }

  function onBellboyGuest(){
    const g = getGuestById(bellboy.targetGuestId);
    if (g && g.state === "WAITING" && g.currentRequest === bellboy.carrying){
      const def = ITEMS[bellboy.carrying];
      g.totalBonus += def.bonus;
      g.currentRequest = null;
      hideGuestBubble(g);
      g.el.classList.remove("angry");
      g.angry = false;
      playSound("match");
      setTimeout(() => startNextRequestOrCheckout(g), 250);
    }
    bellboy.carrying = null;
    bellboy.targetGuestId = null;
    bellboy.state = "RETURNING";
    bellboy.target = centerOf(stSnack);
  }
  function onBellboyReturn(){ bellboy.state = "IDLE"; }

  /* ---------- Cleaner MANUAL ---------- */
  let cleaner = { x: 620, y: 380, speed: 2.4, state: "IDLE", target: null, carrying: false, selectedRoom: null, cleanDoneAt: 0 };
  let cleanerStep = "TAP_STATION";

  function setCleanerCarry(on){
    cleaner.carrying = on;
    if (!cleanerEl) return;
    if (on){
      cleanerEl.classList.add("carrying");
      cleanerEl.dataset.carry = "🧴";
    } else {
      cleanerEl.classList.remove("carrying");
      cleanerEl.dataset.carry = "";
    }
  }

 stClean?.addEventListener("click", () => {
  if (!cleanerHired) return;

  playSound("click");

  // Always "arm" the cleaner even if UI/state got stuck
  cleaner.state = "GOT_DETERGENT";
  setCleanerCarry(true);
  cleanerStep = "TAP_ROOM";
  updateHUD();
});


function startCleaningRoom(i){
  if (!cleanerHired) return;
  if (rooms[i].status !== ROOM_DIRTY) return;

  // auto-arm cleaner if needed
  if (!cleaner.carrying){
    cleaner.state = "GOT_DETERGENT";
    setCleanerCarry(true);
    cleanerStep = "TAP_ROOM";
  }

  cleaner.selectedRoom = i;
  cleaner.state = "TO_ROOM";
  cleaner.target = centerOf(roomEls[i]);
  updateHUD();
}

  roomEls.forEach((el, i) => el?.addEventListener("click", () => startCleaningRoom(i)));

  function onCleanerArriveRoom(){
    cleaner.state = "CLEANING";
    cleaner.cleanDoneAt = Date.now() + 6000;
  }

  function finishCleaning(){
    const i = cleaner.selectedRoom;
    if (i !== null){
      setRoomStatus(i, ROOM_FREE);
      setRoomCooldown(i, ROOM_COOLDOWN_MS);
      setTimeout(() => { seatQueueIntoFreeRooms(); }, ROOM_COOLDOWN_MS + 30);
    }
    cleaner.selectedRoom = null;
    cleaner.state = "RETURNING";
    cleaner.target = centerOf(stClean);
  }

  function onCleanerReturn(){
    cleaner.state = "IDLE";
    setCleanerCarry(false);
    cleanerStep = "TAP_STATION";
    updateHUD();
  }
   function fxPopAt(x, y, icon){
  if (!mapEl) return;
  const d = document.createElement("div");
  d.className = "popFx";
  d.textContent = icon;
  d.style.left = (x + 8) + "px";
  d.style.top  = (y - 10) + "px";
  mapEl.appendChild(d);
  setTimeout(()=>d.remove(), 650);
}

function fxCoinAt(x, y, icon="🪙"){
  if (!mapEl) return;
  const d = document.createElement("div");
  d.className = "coinFx";
  d.textContent = icon;
  d.style.left = (x + 10) + "px";
  d.style.top  = (y - 10) + "px";
  mapEl.appendChild(d);
  setTimeout(()=>d.remove(), 750);
}


  /* ---------- Spawn guests ---------- */
  function spawnGuest(){
    if (guests.length >= 8) return;
    if (!guestLayer) return;

    const g = makeGuest();
    guests.push(g);

    g.x = 10 + (guests.length % 3) * 14;
    g.y = 10 + (guests.length % 3) * 14;
    setPos(g.el, g.x, g.y);
    hideGuestBubble(g);

    playSound("click");
    sendToReception(g);
    updateHUD();
  }
  spawnGuestBtn?.addEventListener("click", spawnGuest);

  /* ---------- Queue positions ---------- */
  function updateQueuePositions(){
    queue.forEach((g, idx) => {
      const p = queueSpot(idx);
      g.x += (p.x - g.x) * 0.08;
      g.y += (p.y - g.y) * 0.08;
      setPos(g.el, g.x, g.y);
    });
  }

  /* ---------- Loop ---------- */
  function loop(){
    // Guests
    guests.forEach(g => {
      const arrived = moveToward(g);
      setPos(g.el, g.x, g.y);

      if (arrived){
        if (g.state === "TO_RECEPTION") onArriveReception(g);
        else if (g.state === "TO_ROOM") onArriveRoom(g);
        else if (g.state === "TO_POOL") onArrivePool(g);
        else if (g.state === "TO_ROOM_AFTER_POOL") onArriveRoomAfterPool(g);
        else if (g.state === "TO_PAY") onArrivePay(g);
        else if (g.state === "TO_EXIT") onArriveExit(g);
      }

      if (g.state === "POOLING" && Date.now() >= g.poolDoneAt){
        finishPool(g);
      }
    });

    // Queue
    updateQueuePositions();

    // Bellboy
    if (bellHired){
      const bellArrived = moveToward(bellboy);
      setPos(bellboyEl, bellboy.x, bellboy.y);
      if (bellArrived){
        if (bellboy.state === "TO_SNACK") onBellboySnack();
        else if (bellboy.state === "TO_GUEST") onBellboyGuest();
        else if (bellboy.state === "RETURNING") onBellboyReturn();
      }
      bellboyTryServe();
    }

    // Cleaner
    if (cleanerHired){
      const cleanArrived = moveToward(cleaner);
      setPos(cleanerEl, cleaner.x, cleaner.y);
      if (cleanArrived){
        if (cleaner.state === "TO_ROOM") onCleanerArriveRoom();
        else if (cleaner.state === "RETURNING") onCleanerReturn();
      }
      if (cleaner.state === "CLEANING" && Date.now() >= cleaner.cleanDoneAt){
        finishCleaning();
      }
    }

    // room cooldown badge update
    for (let i=0;i<rooms.length;i++){
      if (rooms[i].status===ROOM_FREE && Date.now() < (rooms[i].cooldownUntil||0)){
        if (badgeEls[i]) badgeEls[i].textContent = "⏳";
      } else if (rooms[i].status===ROOM_FREE){
        if (badgeEls[i]) badgeEls[i].textContent = "✅";
      }
    }

    updatePatienceAll();
    requestAnimationFrame(loop);
  }

  /* ---------- Start ---------- */
  function start(){
    const essentialsOk = mapEl && guestLayer && stReception && stSnack && stClean && stExit && roomEls.every(Boolean);
    if (!essentialsOk) return;

    buildOceanAndPool();

    // initial room badges
    for (let i=0;i<4;i++) setRoomStatus(i, ROOM_FREE);

    // place workers
    setPos(bellboyEl, bellboy.x, bellboy.y);
    setPos(cleanerEl, cleaner.x, cleaner.y);
    setCleanerCarry(false);

    updateHUD();
    loop();
  }

  // Keep top coins synced if puzzle changes it while hotel open
  setInterval(() => {
    if (coinsTopEl) coinsTopEl.textContent = String(getCoins());
    updateProgressionUI();
    refreshPoolUI();
    syncUpgradeUI();
  }, 900);

  start();
});







