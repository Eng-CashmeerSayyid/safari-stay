/* ==========================================================
   SAFARI STAY – MOMBASA HOTEL MANIA (SAFE VERSION)
   - Works with your current Mombasa.html + style.css
   - Fixes "spawn guest doesn't work" by:
     ✅ waiting for DOM load
     ✅ not crashing if something is missing
     ✅ attaching button handler reliably
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Tabs (safe) ---------- */
  (function(){
    const tabPuzzle  = document.getElementById("tabPuzzle");
    const tabHotel   = document.getElementById("tabHotel");
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

  /* ---------- HUD ---------- */
  const servedEl      = document.getElementById("served");
  const queueCountEl  = document.getElementById("queueCount");
  const roomsFreeEl   = document.getElementById("roomsFree");
  const hotelCashEl   = document.getElementById("hotelCash");
  const cleanerModeEl = document.getElementById("cleanerMode");
  const spawnGuestBtn = document.getElementById("spawnGuestBtn");

  /* ---------- Map / Stations ---------- */
  const mapEl      = document.getElementById("hotelMap");
  const guestLayer = document.getElementById("guestLayer");

  const stReception = document.getElementById("stReception");
  const stSnack     = document.getElementById("stSnack");
  const stClean     = document.getElementById("stClean");
  const stExit      = document.getElementById("stExit");

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
  const bellboyEl  = document.getElementById("bellboy");
  const cleanerEl  = document.getElementById("cleaner");

  /* ---------- Storage Keys ---------- */
  const COIN_KEY     = "coins";
  const KEY_BELL     = "mombasaBellboy";
  const KEY_CLEAN    = "mombasaCleaner";
  const KEY_ROOM_LVL = "mombasaRoomLevel";

  /* ---------- Rewards ---------- */
  const BASE_PAY_COINS = 5;
  const ITEMS = {
    soda:      { icon:"🥤", seconds: 7,  bonus: 2 },
    coconut:   { icon:"🥥", seconds: 8,  bonus: 3 },
    pineapple: { icon:"🍍", seconds: 12, bonus: 5 }
  };
  const ITEM_KEYS = Object.keys(ITEMS);

  /* Pool bonuses */
  const POOL_STAY_MS = 3800;
  const POOL_TIP_BONUS = 2;

  /* ---------- Room State ---------- */
  const ROOM_FREE  = "FREE";
  const ROOM_OCC   = "OCCUPIED";
  const ROOM_DIRTY = "DIRTY";

  let rooms = [
    { status: ROOM_FREE,  guestId: null },
    { status: ROOM_FREE,  guestId: null },
    { status: ROOM_FREE,  guestId: null },
    { status: ROOM_FREE,  guestId: null },
  ];

  /* ---------- World ---------- */
  let served = 0;
  let hotelCash = 0;
  let guests = [];
  let queue = [];
  let nextGuestId = 1;

  /* ---------- Hire State ---------- */
  let bellHired = localStorage.getItem(KEY_BELL) === "true";
  let cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

  /* Pool unlock by room level */
  function getRoomLevel(){
    return Number(localStorage.getItem(KEY_ROOM_LVL)) || 0;
  }
  function poolUnlocked(){
    return getRoomLevel() >= 1;
  }

  /* ---------- Bellboy ---------- */
  let bellboy = {
    x: 220, y: 290,
    speed: 2.7,
    state: "IDLE",
    target: null,
    carrying: null,
    targetGuestId: null,
  };

  /* ---------- Cleaner ---------- */
  let cleaner = {
    x: 620, y: 380,
    speed: 2.4,
    state: "IDLE",
    target: null,
    carrying: false,
    selectedRoom: null,
    cleanDoneAt: 0
  };
  let cleanerStep = "TAP_STATION";

  /* ---------- Helpers ---------- */
  function setPos(el, x, y){
    if (!el) return;
    el.style.left = x + "px";
    el.style.top  = y + "px";
  }

  function centerOf(el){
    const mapRect = mapEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - mapRect.left) + r.width/2 - 22,
      y: (r.top  - mapRect.top)  + r.height/2 - 22
    };
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

  function addGlobalCoins(amount){
    const current = Number(localStorage.getItem(COIN_KEY)) || 0;
    localStorage.setItem(COIN_KEY, String(current + amount));
  }

  /* ---------- Ocean + Pool build ---------- */
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
    if (!poolZoneEl) return;
    const ok = poolUnlocked();
    poolZoneEl.classList.toggle("locked", !ok);
    if (poolLockedEl) poolLockedEl.style.display = ok ? "none" : "block";
  }

  function poolSpot(){
    const zr = poolZoneEl.getBoundingClientRect();
    const mr = mapEl.getBoundingClientRect();
    return { x: (zr.left - mr.left) + zr.width/2 - 22, y: (zr.top - mr.top) + zr.height/2 - 22 };
  }

  /* ---------- Cleaner carry UI ---------- */
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

  /* ---------- Hire sync + visibility ---------- */
  function syncHiresAndVisibility() {
    bellHired = localStorage.getItem(KEY_BELL) === "true";
    cleanerHired = localStorage.getItem(KEY_CLEAN) === "true";

    if (bellboyEl) bellboyEl.style.display = bellHired ? "" : "none";
    if (cleanerEl) cleanerEl.style.display = cleanerHired ? "" : "none";

    if (!cleanerHired) {
      cleanerStep = "TAP_STATION";
      cleaner.state = "IDLE";
      cleaner.target = null;
      cleaner.selectedRoom = null;
      cleaner.cleanDoneAt = 0;
      setCleanerCarry(false);
    }

    refreshPoolUI();
    updateHUD();
  }
  window.addEventListener("staffUpdated", syncHiresAndVisibility);

  /* ---------- Requests ---------- */
  function rollRequests(){
    const r = Math.random();
    let count = 0;
    if (r < 0.30) count = 0;
    else if (r < 0.68) count = 1;
    else if (r < 0.92) count = 2;
    else count = 3;

    const picks = [];
    for (let i = 0; i < count; i++){
      const k = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
      picks.push(k);
    }
    return picks;
  }

  /* ---------- Rooms ---------- */
  function roomsFreeCount(){ return rooms.filter(r => r.status === ROOM_FREE).length; }
  function findFreeRoomIndex(){ return rooms.findIndex(r => r.status === ROOM_FREE); }

  function setRoomStatus(i, status){
    rooms[i].status = status;
    if (badgeEls[i]) {
      if (status === ROOM_FREE)  badgeEls[i].textContent = "✅";
      if (status === ROOM_OCC)   badgeEls[i].textContent = "🧳";
      if (status === ROOM_DIRTY) badgeEls[i].textContent = "🧺";
    }
    updateHUD();
  }

  function updateHUD(){
    if (roomsFreeEl) roomsFreeEl.textContent = String(roomsFreeCount());
    if (queueCountEl) queueCountEl.textContent = String(queue.length);
    if (servedEl) servedEl.textContent = String(served);
    if (hotelCashEl) hotelCashEl.textContent = String(hotelCash);

    if (!cleanerModeEl) return;

    if (!cleanerHired) {
      cleanerModeEl.textContent = "Hire Cleaner to clean";
    } else {
      cleanerModeEl.textContent = cleanerStep === "TAP_STATION"
        ? "Tap 🧴 station"
        : "Tap 🧺 dirty room";
    }
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

    return {
      id: nextGuestId++,
      el, bubble, ring,
      x: 10, y: 10,
      speed: 2.0,
      state: "SPAWN",
      target: null,

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
    g.requestDeadline = Date.now() + def.seconds * 1000;
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
    const base = g.angry ? Math.max(1, BASE_PAY_COINS - 3) : BASE_PAY_COINS;
    const payCoins = base + g.totalBonus;

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

  function updatePatienceAll(){
    const now = Date.now();
    guests.forEach(g => {
      if (g.state !== "WAITING" || !g.currentRequest) return;

      const total = ITEMS[g.currentRequest].seconds * 1000;
      const left = g.requestDeadline - now;
      const pct = Math.max(0, Math.min(1, left / total));

      g.ring.style.borderWidth = (3 + (1 - pct) * 2) + "px";
      g.ring.style.opacity = String(0.6 + (1 - pct) * 0.4);

      if (left <= 0 && !g.angry){
        g.angry = true;
        g.el.classList.add("angry");
        g.currentRequest = null;
        hideGuestBubble(g);
        setTimeout(() => startNextRequestOrCheckout(g), 250);
      }
    });
  }

  /* ---------- Bellboy AUTO ---------- */
  function findServeTargetGuest(){
    return guests.find(g => g.state === "WAITING" && !!g.currentRequest);
  }
  function getGuestById(id){ return guests.find(g => g.id === id); }

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
      setTimeout(() => startNextRequestOrCheckout(g), 350);
    }
    bellboy.carrying = null;
    bellboy.targetGuestId = null;
    bellboy.state = "RETURNING";
    bellboy.target = centerOf(stSnack);
  }
  function onBellboyReturn(){ bellboy.state = "IDLE"; }

  /* ---------- Cleaner MANUAL ---------- */
  if (stClean) {
    stClean.addEventListener("click", () => {
      if (!cleanerHired) return;
      if (cleanerStep !== "TAP_STATION") return;
      if (cleaner.state !== "IDLE") return;

      cleaner.state = "GOT_DETERGENT";
      setCleanerCarry(true);
      cleanerStep = "TAP_ROOM";
      updateHUD();
    });
  }

  function startCleaningRoom(i){
    if (!cleanerHired) return;
    if (cleanerStep !== "TAP_ROOM") return;
    if (!cleaner.carrying) return;
    if (cleaner.state !== "GOT_DETERGENT" && cleaner.state !== "IDLE") return;
    if (rooms[i].status !== ROOM_DIRTY) return;

    cleaner.selectedRoom = i;
    cleaner.state = "TO_ROOM";
    cleaner.target = centerOf(roomEls[i]);
  }

  roomEls.forEach((el, i) => {
    if (!el) return;
    el.addEventListener("click", () => startCleaningRoom(i));
  });

  function onCleanerArriveRoom(){
    cleaner.state = "CLEANING";
    cleaner.cleanDoneAt = Date.now() + 6000;
  }

  function finishCleaning(){
  const i = cleaner.selectedRoom;

  if (i !== null){
    // 1) mark room as FREE
    setRoomStatus(i, ROOM_FREE);

    // 2) if there is someone waiting in the queue, move them into this room
    if (queue.length > 0){
      const g = queue.shift(); // take first guest in line

      g.state = "TO_ROOM";
      g.roomIndex = i;

      // room becomes occupied again
      setRoomStatus(i, ROOM_OCC);

      // send guest to this room
      g.target = centerOf(roomEls[i]);

      updateHUD();
    }
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

  /* ---------- Spawn Guests ---------- */
  function spawnGuest(){
    if (guests.length >= 8) return;
    const g = makeGuest();
    guests.push(g);

    g.x = 10 + (guests.length % 3) * 14;
    g.y = 10 + (guests.length % 3) * 14;
    setPos(g.el, g.x, g.y);
    hideGuestBubble(g);

    sendToReception(g);
    updateHUD();
  }

  if (spawnGuestBtn) {
    spawnGuestBtn.addEventListener("click", spawnGuest);
  }

  /* ---------- Loop ---------- */
  function loop(){
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

    queue.forEach((g, idx) => {
      const p = queueSpot(idx);
      g.x += (p.x - g.x) * 0.08;
      g.y += (p.y - g.y) * 0.08;
      setPos(g.el, g.x, g.y);
    });

    if (bellHired) {
      const bellArrived = moveToward(bellboy);
      setPos(bellboyEl, bellboy.x, bellboy.y);
      if (bellArrived){
        if (bellboy.state === "TO_SNACK") onBellboySnack();
        else if (bellboy.state === "TO_GUEST") onBellboyGuest();
        else if (bellboy.state === "RETURNING") onBellboyReturn();
      }
      bellboyTryServe();
    }

    if (cleanerHired) {
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

    updatePatienceAll();
    requestAnimationFrame(loop);
  }

  /* ---------- START ---------- */
  function start(){
    // Hard fail message if essentials are missing
    const essentialsOk =
      mapEl && guestLayer && stReception && stSnack && stClean && stExit &&
      roomEls.every(Boolean);

    if (!essentialsOk) {
      // Show a clear signal in the UI
      if (cleanerModeEl) cleanerModeEl.textContent = "hotel.js loaded ✅ but missing elements";
      console.error("Hotel essentials missing. Check IDs in Mombasa.html:", {
        mapEl, guestLayer, stReception, stSnack, stClean, stExit, roomEls
      });
      return;
    }

    // UI signal that hotel.js is alive
    if (cleanerModeEl) cleanerModeEl.textContent = "hotel.js loaded ✅ tap 🧴 station";

    buildOceanAndPool();

    for (let i = 0; i < 4; i++) setRoomStatus(i, ROOM_FREE);

    setPos(bellboyEl, bellboy.x, bellboy.y);
    setPos(cleanerEl, cleaner.x, cleaner.y);
    setCleanerCarry(false);

    syncHiresAndVisibility();
    updateHUD();

    setInterval(refreshPoolUI, 900);
    loop();
  }

  start();
});







