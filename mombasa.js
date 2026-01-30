/* =========================
Safari Stay – mombasa.js (FULL GAME CONTROLLER)
- Tabs (Hotel/Puzzle/Shop)
- Hotel mini-tycoon (rooms, queue, cleaning, snacks)
- Puzzle Match-3 (5x5) with images: images/tiles/*.png
- Shared coins in localStorage
========================= */

(() => {
  "use strict";

  // ===============================
  // Shared Coins
  // ===============================
  const COINS_KEY = "coins";
  function getCoins() {
    const v = Number(localStorage.getItem(COINS_KEY) || "0");
    return Number.isFinite(v) ? v : 0;
  }
  function setCoins(n) {
    localStorage.setItem(COINS_KEY, String(n));
    const coinsEl = document.getElementById("coins");
    if (coinsEl) coinsEl.textContent = String(n);
  }
  function addCoins(n) {
    setCoins(getCoins() + n);
  }

  // ===============================
  // Tabs
  // ===============================
  function initTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const panels = {
      hotel: document.getElementById("tab-hotel"),
      puzzle: document.getElementById("tab-puzzle"),
      shop: document.getElementById("tab-shop"),
    };

    if (tabs.length === 0) return; // if your page uses a different tabs UI, this won’t break

    function activate(name) {
      Object.values(panels).forEach(p => p && p.classList.remove("active"));
      tabs.forEach(t => t.classList.remove("active"));

      const panel = panels[name];
      if (panel) panel.classList.add("active");

      const tabBtn = tabs.find(t => (t.dataset.tab || "").toLowerCase() === name);
      if (tabBtn) tabBtn.classList.add("active");
    }

    tabs.forEach(btn => {
      btn.addEventListener("click", () => {
        const name = (btn.dataset.tab || "").toLowerCase();
        if (!name) return;
        activate(name);
      });
    });

    // Ensure one active panel
    const anyActive = Object.values(panels).some(p => p && p.classList.contains("active"));
    if (!anyActive) activate("hotel");
  }

  // ===============================
  // HOTEL (simple but working)
  // ===============================
  const HOTEL = {
    rooms: [
      { id: 1, state: "empty", guest: null, snack: false },
      { id: 2, state: "empty", guest: null, snack: false },
      { id: 3, state: "empty", guest: null, snack: false },
      { id: 4, state: "empty", guest: null, snack: false },
    ],
    queue: [],
    served: 0,
    selectedRoomId: null,
    snackLimit: 2
  };

  function el(id) { return document.getElementById(id); }

  function roomEmoji(state) {
    if (state === "empty") return "🟢";
    if (state === "occupied") return "🛏️";
    if (state === "dirty") return "🟠";
    if (state === "cleaning") return "🧼";
    return "❔";
  }

  function roomStateLabel(state) {
    if (state === "empty") return "Empty";
    if (state === "occupied") return "Occupied";
    if (state === "dirty") return "Dirty";
    if (state === "cleaning") return "Cleaning";
    return state;
  }

  function renderHotel() {
    const grid = el("hotelGrid");
    const queueEl = document.getElementById("queueCount");
    const servedEl = document.getElementById("servedCount");

    // Your HUD might already have spans for Queue/Served. If not, we won't crash.
    // We'll also attempt to update the "Queue: 0" pill by searching for text? No — keep it simple.

    if (grid) {
      grid.innerHTML = "";
      HOTEL.rooms.forEach(room => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "roomBtn " + (HOTEL.selectedRoomId === room.id ? "selected " : "") + `state-${room.state}`;
        btn.innerHTML = `
          <div class="rRow">
            <div class="rTitle">Room ${room.id}</div>
            <div class="rBadge">${roomEmoji(room.state)}${room.snack ? "🛎️" : ""}</div>
          </div>
          <div class="rState">${roomStateLabel(room.state)}</div>
        `;
        btn.addEventListener("click", () => {
          HOTEL.selectedRoomId = room.id;
          renderHotel();
          renderRoomDetails();
        });
        grid.appendChild(btn);
      });
    }

    // Optional HUD spans (only update if you have these IDs)
    if (queueEl) queueEl.textContent = String(HOTEL.queue.length);
    if (servedEl) servedEl.textContent = String(HOTEL.served);

    // Always update coins pill
    setCoins(getCoins());
  }

  function getSelectedRoom() {
    if (!HOTEL.selectedRoomId) return null;
    return HOTEL.rooms.find(r => r.id === HOTEL.selectedRoomId) || null;
  }

  function renderRoomDetails() {
    const details = el("roomDetails");
    const hint = el("hint");
    const room = getSelectedRoom();

    if (hint && !room) hint.textContent = "Welcome to Mombasa 🌴";
    if (!details) return;

    if (!room) {
      details.textContent = "Select a room.";
      return;
    }

    details.innerHTML = `
      <div><b>Room ${room.id}</b> — ${roomStateLabel(room.state)}</div>
      <div class="smallMuted">Guest: ${room.guest ? room.guest : "None"}</div>
      <div class="smallMuted">Snack Order: ${room.snack ? "Yes 🛎️" : "No"}</div>
    `;
  }

  function hotelMsg(t) {
    const msg = el("hotelMsg");
    if (msg) msg.textContent = t;
  }

  function randomGuestName() {
    const names = ["Amina","Brian","Chao","Daisy","Eli","Fatuma","Gideon","Hawa","Imani","Jamal"];
    return names[Math.floor(Math.random() * names.length)];
  }

  function maybeAddSnack(room) {
    const activeSnackRooms = HOTEL.rooms.filter(r => r.snack).length;
    if (activeSnackRooms >= HOTEL.snackLimit) return;

    // 35% chance occupied guest orders snack
    if (room.state === "occupied" && !room.snack && Math.random() < 0.35) {
      room.snack = true;
    }
  }

  function initHotelButtons() {
    const btnCheckIn = el("btnCheckIn");
    const btnServeQueue = el("btnServeQueue");
    const btnEmergencyClean = el("btnEmergencyClean");

    const btnDeliverSnack = el("btnDeliverSnack");
    const btnCheckoutGuest = el("btnCheckoutGuest");
    const btnStartCleaning = el("btnStartCleaning");

    if (btnCheckIn) {
      btnCheckIn.addEventListener("click", () => {
        const empty = HOTEL.rooms.find(r => r.state === "empty");
        if (!empty) { hotelMsg("No empty rooms right now."); return; }

        empty.state = "occupied";
        empty.guest = randomGuestName();
        empty.snack = false;

        // guest will be ready to checkout later
        setTimeout(() => {
          // if still occupied with same guest, mark dirty-ready (simulate checkout readiness)
          if (empty.state === "occupied") {
            // add to queue as "ready to checkout"
            HOTEL.queue.push({ type: "checkout", roomId: empty.id });
            renderHotel();
          }
        }, 9000);

        // snack chance
        setTimeout(() => { maybeAddSnack(empty); renderHotel(); renderRoomDetails(); }, 2500);

        addCoins(2); // small bonus for check-in
        hotelMsg(`Checked in ${empty.guest} to Room ${empty.id} ✅ (+2 coins)`);
        renderHotel();
        renderRoomDetails();
      });
    }

    if (btnServeQueue) {
      btnServeQueue.addEventListener("click", () => {
        if (HOTEL.queue.length === 0) { hotelMsg("Queue is empty."); return; }
        const item = HOTEL.queue.shift();
        HOTEL.served += 1;
        addCoins(3);
        hotelMsg(`Served: ${item.type} for Room ${item.roomId} ✅ (+3 coins)`);
        renderHotel();
      });
    }

    if (btnEmergencyClean) {
      btnEmergencyClean.addEventListener("click", () => {
        const room = getSelectedRoom();
        if (!room) { hotelMsg("Select a room first."); return; }

        room.state = "cleaning";
        room.snack = false;
        hotelMsg(`Cleaning Room ${room.id}...`);
        renderHotel();
        renderRoomDetails();

        setTimeout(() => {
          room.state = "empty";
          room.guest = null;
          room.snack = false;
          addCoins(4);
          hotelMsg(`Room ${room.id} cleaned ✅ (+4 coins)`);
          renderHotel();
          renderRoomDetails();
        }, 2800);
      });
    }

    if (btnDeliverSnack) {
      btnDeliverSnack.addEventListener("click", () => {
        const room = getSelectedRoom();
        if (!room) { hotelMsg("Select a room first."); return; }
        if (!room.snack) { hotelMsg("No snack order for this room."); return; }
        room.snack = false;
        addCoins(5);
        hotelMsg(`Snack delivered to Room ${room.id} 🛎️✅ (+5 coins)`);
        renderHotel();
        renderRoomDetails();
      });
    }

    if (btnCheckoutGuest) {
      btnCheckoutGuest.addEventListener("click", () => {
        const room = getSelectedRoom();
        if (!room) { hotelMsg("Select a room first."); return; }
        if (room.state !== "occupied") { hotelMsg("This room is not occupied."); return; }

        room.state = "dirty";
        room.guest = null;
        room.snack = false;
        addCoins(6);
        hotelMsg(`Checked out Room ${room.id}. Now dirty 🧽 (+6 coins)`);
        renderHotel();
        renderRoomDetails();
      });
    }

    if (btnStartCleaning) {
      btnStartCleaning.addEventListener("click", () => {
        const room = getSelectedRoom();
        if (!room) { hotelMsg("Select a room first."); return; }
        if (room.state !== "dirty") { hotelMsg("Room must be dirty to start cleaning."); return; }

        room.state = "cleaning";
        hotelMsg(`Cleaning started for Room ${room.id}...`);
        renderHotel();
        renderRoomDetails();

        setTimeout(() => {
          room.state = "empty";
          room.guest = null;
          room.snack = false;
          addCoins(4);
          hotelMsg(`Room ${room.id} cleaned ✅ (+4 coins)`);
          renderHotel();
          renderRoomDetails();
        }, 2800);
      });
    }
  }

  // ===============================
  // PUZZLE (Match-3 5×5)
  // ===============================
  function initPuzzle() {
    const boardEl  = document.getElementById("board");
    const targetEl = document.getElementById("target");
    const msgEl    = document.getElementById("msg");
    const resetBtn = document.getElementById("resetPuzzle");

    if (!boardEl) return; // puzzle panel may not be on some pages
    if (targetEl) targetEl.textContent = "300";

    const SIZE = 5;
    const TYPES = 6;
    const COINS_PER_TILE = 5;
    const ANIM_MS = 220;
    const CASCADE_DELAY = 80;

    const TILE_ASSETS = [
      "images/tiles/palm.png",
      "images/tiles/shell.png",
      "images/tiles/fish.png",
      "images/tiles/coconut.png",
      "images/tiles/wave.png",
      "images/tiles/sun.png",
    ];
    const TILE_EMOJI = ["🌴","🐚","🐟","🥥","🌊","☀️"];

    let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
    let selected = null;
    let locked = false;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const vibrate = (ms=60) => navigator.vibrate && navigator.vibrate(ms);
    const neighbors = (a,b) => (Math.abs(a.r-b.r)+Math.abs(a.c-b.c))===1;

    const setMsg = (t) => { if (msgEl) msgEl.textContent = t || ""; };

    function randomType(){ return Math.floor(Math.random()*TYPES); }

    function safeRandomType(r,c){
      for(let tries=0; tries<30; tries++){
        const t = randomType();
        const l1 = c-1>=0 ? grid[r][c-1] : null;
        const l2 = c-2>=0 ? grid[r][c-2] : null;
        if(l1===t && l2===t) continue;
        const u1 = r-1>=0 ? grid[r-1][c] : null;
        const u2 = r-2>=0 ? grid[r-2][c] : null;
        if(u1===t && u2===t) continue;
        return t;
      }
      return randomType();
    }

    function buildBoard(){
      boardEl.style.setProperty("--size", SIZE);
      boardEl.innerHTML = "";
      for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tile";
          btn.dataset.r = String(r);
          btn.dataset.c = String(c);
          boardEl.appendChild(btn);
        }
      }
      boardEl.addEventListener("click", onClick);
    }

    function getTileEl(r,c){
      return boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
    }

    function paint(){
      boardEl.querySelectorAll(".tile").forEach(el=>{
        const r = Number(el.dataset.r);
        const c = Number(el.dataset.c);
        const t = grid[r][c];

        el.classList.toggle("selected", !!selected && selected.r===r && selected.c===c);

        if(t===-1){
          el.classList.add("empty");
          el.style.backgroundImage = "";
          el.textContent = "";
          return;
        }

        el.classList.remove("empty");
        el.style.backgroundImage = `url("${TILE_ASSETS[t]}")`;
        el.textContent = TILE_EMOJI[t];
        el.classList.add("hasEmoji");
      });
    }

    function findMatches(){
      const set = new Set();

      // horizontal
      for(let r=0;r<SIZE;r++){
        let start=0;
        while(start<SIZE){
          const t = grid[r][start];
          if(t===-1){ start++; continue; }
          let end=start+1;
          while(end<SIZE && grid[r][end]===t) end++;
          if(end-start>=3){
            for(let c=start;c<end;c++) set.add(`${r},${c}`);
          }
          start=end;
        }
      }

      // vertical
      for(let c=0;c<SIZE;c++){
        let start=0;
        while(start<SIZE){
          const t = grid[start][c];
          if(t===-1){ start++; continue; }
          let end=start+1;
          while(end<SIZE && grid[end][c]===t) end++;
          if(end-start>=3){
            for(let r=start;r<end;r++) set.add(`${r},${c}`);
          }
          start=end;
        }
      }

      return [...set].map(s=>{
        const [r,c] = s.split(",").map(Number);
        return {r,c};
      });
    }

    function anyMatch(){ return findMatches().length>0; }

    function swap(a,b){
      const tmp = grid[a.r][a.c];
      grid[a.r][a.c] = grid[b.r][b.c];
      grid[b.r][b.c] = tmp;
    }

    async function shake(a,b){
      const A=getTileEl(a.r,a.c), B=getTileEl(b.r,b.c);
      if(A) A.classList.add("shake");
      if(B) B.classList.add("shake");
      vibrate(70);
      await sleep(ANIM_MS);
      if(A) A.classList.remove("shake");
      if(B) B.classList.remove("shake");
    }

    async function crush(matches){
      matches.forEach(({r,c})=>{
        const el = getTileEl(r,c);
        if(el) el.classList.add("crush");
      });
      vibrate(35);
      await sleep(ANIM_MS);

      matches.forEach(({r,c})=>{
        grid[r][c] = -1;
        const el = getTileEl(r,c);
        if(el) el.classList.remove("crush");
      });

      // Coins per tile cleared
      addCoins(matches.length * COINS_PER_TILE);
    }

    function gravity(){
      for(let c=0;c<SIZE;c++){
        let write=SIZE-1;
        for(let r=SIZE-1;r>=0;r--){
          if(grid[r][c]!==-1){
            grid[write][c]=grid[r][c];
            if(write!==r) grid[r][c]=-1;
            write--;
          }
        }
        for(let r=write;r>=0;r--) grid[r][c]=-1;
      }
    }

    function refill(){
      for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
          if(grid[r][c]===-1) grid[r][c]=safeRandomType(r,c);
        }
      }
    }

    async function resolve(){
      while(true){
        const m = findMatches();
        if(m.length===0) break;
        await crush(m);
        gravity();
        refill();
        paint();
        await sleep(CASCADE_DELAY);
      }
    }

    async function onClick(e){
      if(locked) return;
      const tile = e.target.closest(".tile");
      if(!tile) return;

      const r = Number(tile.dataset.r);
      const c = Number(tile.dataset.c);

      if(!selected){
        selected = {r,c};
        paint();
        return;
      }

      const prev = selected;
      selected = null;

      if(prev.r===r && prev.c===c){
        paint();
        return;
      }

      if(!neighbors(prev,{r,c})){
        selected = {r,c};
        paint();
        return;
      }

      locked = true;
      setMsg("");

      swap(prev,{r,c});
      paint();

      if(anyMatch()){
        await resolve();
        locked = false;
        paint();
        return;
      }

      await shake(prev,{r,c});
      swap(prev,{r,c});
      paint();
      locked = false;
      setMsg("No match ❌ Try a different swap.");
    }

    async function reset(){
      locked = true;
      selected = null;
      setMsg("New board ready ✅");
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
      for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
          grid[r][c] = safeRandomType(r,c);
        }
      }
      paint();
      await resolve();
      locked = false;
    }

    if(resetBtn) resetBtn.addEventListener("click", reset);

    buildBoard();
    reset();
  }

  // ===============================
  // INIT (run once)
  // ===============================
  function init() {
    // Make sure coins show immediately
    setCoins(getCoins());

    initTabs();
    initHotelButtons();
    renderHotel();
    renderRoomDetails();

    initPuzzle();

    // If your HTML includes these IDs, they will update:
    // queueCount, servedCount, roomDetails, hotelMsg
  }
   const btnSpawnGuest = document.getElementById("btnSpawnGuest");

if (btnSpawnGuest) {
  btnSpawnGuest.addEventListener("click", () => {
    // Push a guest into the lobby queue (doesn't occupy a room yet)
    const guest = randomGuestName();
    HOTEL.queue.push({ type: "checkin", guest });

    hotelMsg(`Guest spawned: ${guest} is waiting in the lobby 👤`);
    renderHotel();
  });
}

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
