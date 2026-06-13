/* =========================
Safari Stay – mombasa.js
- Manual check-in: select guest -> click empty room
- Two hands inventory
- Snacks sometimes ordered (queue + rooms)
- Stay timer -> room becomes READY TO CHECKOUT (manual click checkout)
- Cleaning manual + requires detergent in a hand
- Coins sync with puzzle via localStorage
========================= */

(() => {
  // ---------- DOM ----------
  const elCoins = document.getElementById("coinsTop");
  const elServed = document.getElementById("served");
  const elAngry = document.getElementById("angry");
  const elQueueCount = document.getElementById("queueCount");

  const elHint = document.getElementById("hint");
  const elSubhint = document.getElementById("subhint");

  const btnSpawn = document.getElementById("btnSpawn");
  const btnReset = document.getElementById("btnReset");

  const tabBtnHotel = document.getElementById("tabBtnHotel");
  const tabBtnPuzzle = document.getElementById("tabBtnPuzzle");
  const panelHotel = document.getElementById("panel-hotel");
  const panelPuzzle = document.getElementById("panel-puzzle");

  const elQueue = document.getElementById("queue");
  const roomsWrap = document.getElementById("rooms");

  const snackStockEl = document.getElementById("snackStock");
  const detStockEl = document.getElementById("detStock");

  const leftItemEl = document.getElementById("leftItem");
  const rightItemEl = document.getElementById("rightItem");
  const dropL = document.getElementById("dropL");
  const dropR = document.getElementById("dropR");

  const btnDeliver = document.getElementById("btnDeliver");
  const btnCheckout = document.getElementById("btnCheckout");
  const btnClean = document.getElementById("btnClean");

  const btnDetergent = document.getElementById("btnDetergent");
  const resultBar = document.getElementById("resultBar");

  // Snack buttons
  const snackButtons = Array.from(document.querySelectorAll('#snacks .itemBtn'));

  // Room nodes by index
  const roomButtons = Array.from(document.querySelectorAll(".room"));

  // Room UI helpers
  const roomStateEl = (i) => document.getElementById(`roomState${i}`);
  const roomBodyEl = (i) => document.getElementById(`roomBody${i}`);
  const roomFootEl = (i) => document.getElementById(`roomFoot${i}`);
  const roomBarEl  = (i) => document.getElementById(`roomBar${i}`);

  // ---------- State ----------
  const EMOJI_GUESTS = ["🧑🏽‍🦱","👩🏽‍🦱","🧑🏿‍🦰","👩🏾‍🦳","🧑🏾","👩🏿","🧑🏽‍🦱","👩🏾‍🦱"];
  const ORDERS = [
    { key:"coconut", label:"🥥 Coconut" },
    { key:"soda", label:"🥤 Soda" },
    { key:"fries", label:"🍟 Fries" },
    { key:"sandwich", label:"🥪 Sandwich" },
  ];

  let coins = loadNum("ss_coins", 0);
  let served = loadNum("ss_served", 0);
  let angry = loadNum("ss_angry", 0);

  let snackStock = loadNum("ss_snackStock", 12);
  let detStock   = loadNum("ss_detStock", 6);

  let handL = loadStr("ss_handL", "");
  let handR = loadStr("ss_handR", "");

  let selectedGuestId = null;   // guest id from queue or in-room
  let selectedRoom = null;      // 0..3

  // Guests: queue list + rooms occupancy
  // guest object:
  // { id, name, avatar, patience, maxPatience, moodStage, orderKey, location: "queue" or "room", roomIndex? }
  let queue = [];
  let rooms = [
    newRoom(), newRoom(), newRoom(), newRoom()
  ];

  // Timers
  const TICK_MS = 600; // mood tick
  const PATIENCE_DEC_QUEUE = 3; // per tick
  const PATIENCE_DEC_ROOM  = 2; // per tick
  const ORDER_CHANCE_QUEUE = 0.35;
  const ORDER_CHANCE_ROOM  = 0.25;

  // stay duration (ticks)
  const STAY_MIN = 16;
  const STAY_MAX = 26;

  // init from storage (optional)
  // For simplicity, start fresh each reload; keep coins + stats only.

  // ---------- Helpers ----------
  function loadNum(k, d){ const v = localStorage.getItem(k); return v==null? d : Number(v)||d; }
  function loadStr(k, d){ const v = localStorage.getItem(k); return v==null? d : String(v); }
  function saveAll(){
    localStorage.setItem("ss_coins", String(coins));
    localStorage.setItem("ss_served", String(served));
    localStorage.setItem("ss_angry", String(angry));
    localStorage.setItem("ss_snackStock", String(snackStock));
    localStorage.setItem("ss_detStock", String(detStock));
    localStorage.setItem("ss_handL", String(handL||""));
    localStorage.setItem("ss_handR", String(handR||""));
  }
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function uid(){ return "g" + Math.random().toString(16).slice(2) + Date.now().toString(16); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

  function newRoom(){
    return {
      state: "empty",  // empty | occupied | ready | dirty | cleaning
      guestId: null,
      stayLeft: 0,
      stayMax: 0,
    };
  }

  function guestMoodText(g){
    const p = g.patience / g.maxPatience;
    if (p > 0.66) return "😊 Happy";
    if (p > 0.33) return "😐 Impatient";
    return "😠 Angry";
  }

  function orderLabel(orderKey){
    const found = ORDERS.find(o => o.key === orderKey);
    return found ? found.label : "—";
  }

  function setResult(msg, kind){
    resultBar.classList.remove("good","bad");
    if (kind === "good") resultBar.classList.add("good");
    if (kind === "bad") resultBar.classList.add("bad");
    resultBar.textContent = msg;
  }

  function syncCoinsFromPuzzle(){
    // puzzle.js writes ss_coins too; we just reload it
    coins = loadNum("ss_coins", coins);
    renderHUD();
  }

  // ---------- Render ----------
  function renderHUD(){
    elCoins.textContent = coins;
    elServed.textContent = served;
    elAngry.textContent = angry;
    elQueueCount.textContent = queue.length;
    snackStockEl.textContent = snackStock;
    detStockEl.textContent = detStock;

    leftItemEl.textContent = handL ? itemToDisplay(handL) : "Empty";
    rightItemEl.textContent = handR ? itemToDisplay(handR) : "Empty";

    saveAll();
  }

  function itemToDisplay(key){
    if (key === "detergent") return "🧴 Detergent";
    const found = ORDERS.find(o => o.key === key);
    return found ? found.label : key;
  }

  function renderQueue(){
    elQueue.innerHTML = "";
    queue.forEach((g) => {
      const card = document.createElement("div");
      card.className = "guestCard" + (selectedGuestId === g.id ? " selected" : "");
      card.dataset.id = g.id;

      const left = document.createElement("div");
      left.className = "guestLeft";

      const av = document.createElement("div");
      av.className = "avatar";
      av.textContent = g.avatar;

      const meta = document.createElement("div");
      meta.className = "guestMeta";

      const name = document.createElement("div");
      name.className = "guestName";
      name.textContent = g.name;

      const mood = document.createElement("div");
      mood.className = "mood";
      mood.textContent = `${guestMoodText(g)} • Patience ${g.patience}/${g.maxPatience}`;

      meta.appendChild(name);
      meta.appendChild(mood);

      left.appendChild(av);
      left.appendChild(meta);

      const badge = document.createElement("div");
      badge.className = "orderBadge";
      badge.textContent = g.orderKey ? `Order: ${orderLabel(g.orderKey)}` : "Order: —";

      card.appendChild(left);
      card.appendChild(badge);

      card.addEventListener("click", () => {
        selectedGuestId = g.id;
        // clear room selection optional
        setHint(`Selected guest: ${g.name}. Now click an EMPTY room to check-in.`);
        renderAll();
      });

      elQueue.appendChild(card);
    });
  }

  function renderRooms(){
    roomButtons.forEach((btn) => btn.classList.remove("selected","priority","occupied","dirty","cleaning","empty"));

    rooms.forEach((r, i) => {
      const btn = roomButtons[i];

      // selection ring
      if (selectedRoom === i) btn.classList.add("selected");

      // state classes
      btn.classList.add(r.state === "ready" ? "occupied" : r.state); // ready looks occupied-ish
      if (r.state === "empty") btn.classList.add("empty");

      const g = getGuestById(r.guestId);

      if (r.state === "empty"){
        roomStateEl(i).textContent = "Empty";
        roomBodyEl(i).textContent = "Empty";
        roomFootEl(i).textContent = "—";
        roomBarEl(i).style.width = "0%";
      } else if (r.state === "dirty"){
        roomStateEl(i).textContent = "Dirty";
        roomBodyEl(i).textContent = "Needs cleaning";
        roomFootEl(i).textContent = "Pick 🧴 detergent then press Clean";
        roomBarEl(i).style.width = "100%";
      } else if (r.state === "cleaning"){
        roomStateEl(i).textContent = "Cleaning…";
        roomBodyEl(i).textContent = "In progress";
        roomFootEl(i).textContent = "Wait…";
        roomBarEl(i).style.width = "60%";
      } else if (r.state === "ready"){
        roomStateEl(i).textContent = "Ready to checkout";
        roomBodyEl(i).textContent = g ? `${g.avatar} ${g.name}` : "Guest";
        roomFootEl(i).textContent = "Click Checkout (selected)";
        roomBarEl(i).style.width = "100%";
        btn.classList.add("priority");
      } else { // occupied
        roomStateEl(i).textContent = "Occupied";
        roomBodyEl(i).textContent = g ? `${g.avatar} ${g.name}` : "Guest";
        const pct = r.stayMax ? (1 - (r.stayLeft / r.stayMax)) : 0;
        roomFootEl(i).textContent = g
          ? `${guestMoodText(g)} • ${g.orderKey ? "Order: " + orderLabel(g.orderKey) : "No order"}`
          : "—";
        roomBarEl(i).style.width = `${Math.round(pct * 100)}%`;

        // if guest is angry and has an order, make it priority
        if (g && g.orderKey && (g.patience / g.maxPatience) <= 0.33) btn.classList.add("priority");
      }
    });
  }

  function renderAll(){
    renderHUD();
    renderQueue();
    renderRooms();
  }

  function setHint(text){
    elHint.textContent = text;
  }

  // ---------- Guest lookup ----------
  function getGuestById(id){
    if (!id) return null;
    const q = queue.find(g => g.id === id);
    if (q) return q;
    // guest may be in room: we keep guest object in a map
    return guestMap.get(id) || null;
  }

  const guestMap = new Map(); // store all guests by id (queue + rooms)
  function registerGuest(g){ guestMap.set(g.id, g); }

  // ---------- Spawning ----------
  function createGuest(){
    const id = uid();
    const avatar = pick(EMOJI_GUESTS);
    const name = `Guest ${id.slice(-4).toUpperCase()}`;
    const maxPat = randInt(60, 90);
    const patience = maxPat;

    // 1/3 chance they already have an order
    const orderKey = Math.random() < ORDER_CHANCE_QUEUE ? pick(ORDERS).key : null;

    const g = { id, name, avatar, patience, maxPatience:maxPat, orderKey, location:"queue" };
    registerGuest(g);
    return g;
  }

  function addGuest(){
    if (queue.length >= 7){
      setResult("Queue is full. Check guests into rooms first.", "bad");
      return;
    }
    const g = createGuest();
    queue.push(g);
    setResult(`New guest arrived: ${g.name}`, "good");
    renderAll();
  }

  // ---------- Selection helpers ----------
  function selectRoom(i){
    selectedRoom = i;
    renderRooms();
  }

  function clearRoomSelection(){
    selectedRoom = null;
    roomButtons.forEach(b => b.classList.remove("selected"));
  }

  function clearGuestSelection(){
    selectedGuestId = null;
    renderQueue();
  }

  // ---------- Check-in ----------
  function checkInToRoom(roomIndex){
    const room = rooms[roomIndex];
    if (room.state !== "empty"){
      setResult("That room is not empty.", "bad");
      return;
    }
    if (!selectedGuestId){
      setResult("Select a guest first.", "bad");
      return;
    }
    const g = getGuestById(selectedGuestId);
    if (!g || g.location !== "queue"){
      setResult("Select a guest from the queue.", "bad");
      return;
    }

    // remove from queue
    queue = queue.filter(x => x.id !== g.id);

    // occupy
    room.state = "occupied";
    room.guestId = g.id;
    room.stayMax = randInt(STAY_MIN, STAY_MAX);
    room.stayLeft = room.stayMax;

    g.location = "room";
    g.roomIndex = roomIndex;

    // reward a little for successful check-in
    coins += 1;
    setHint("Guest checked in. Watch mood + fulfill orders.");
    setResult(`${g.name} checked into Room ${roomIndex+1}. (+1 coin)`, "good");

    // keep selection on room
    selectedRoom = roomIndex;
    selectedGuestId = g.id;

    renderAll();
  }

  // ---------- Hands ----------
  function putInHand(itemKey){
    // first empty hand gets it
    if (!handL){
      handL = itemKey;
      return "L";
    }
    if (!handR){
      handR = itemKey;
      return "R";
    }
    return null;
  }

  function dropHand(which){
    if (which === "L") handL = "";
    if (which === "R") handR = "";
    setResult("Dropped item.", "good");
    renderHUD();
  }

  // ---------- Deliver ----------
  function deliverToSelectedGuest(){
    if (!selectedGuestId){
      setResult("Select a guest first.", "bad");
      return;
    }
    const g = getGuestById(selectedGuestId);
    if (!g){
      setResult("Selected guest not found.", "bad");
      return;
    }

    // must have a snack item in any hand (not detergent)
    const hand = handL && handL !== "detergent" ? "L"
               : (handR && handR !== "detergent" ? "R" : null);

    if (!hand){
      setResult("Pick a snack into a hand first (not detergent).", "bad");
      return;
    }

    const item = (hand === "L") ? handL : handR;

    if (!g.orderKey){
      // allow “wrong timing” delivery: small tip + mood boost
      g.patience = clamp(g.patience + 10, 0, g.maxPatience);
      coins += 1;
      if (hand === "L") handL = "";
      else handR = "";
      setResult(`No order right now — but you cheered them up. (+1 coin)`, "good");
      renderAll();
      return;
    }

    if (g.orderKey !== item){
      // wrong item: penalty
      g.patience = clamp(g.patience - 12, 0, g.maxPatience);
      setResult(`Wrong item! They wanted ${orderLabel(g.orderKey)}.`, "bad");
      renderAll();
      return;
    }

    // correct delivery
    g.orderKey = null;
    g.patience = clamp(g.patience + 18, 0, g.maxPatience);
    served += 1;
    coins += 3;
    snackStock = Math.max(0, snackStock - 1);

    if (hand === "L") handL = "";
    else handR = "";

    setResult(`Delivered successfully! (+3 coins)`, "good");
    renderAll();
  }

  // ---------- Checkout ----------
  function checkoutSelectedRoom(){
    if (selectedRoom == null){
      setResult("Select a room first.", "bad");
      return;
    }
    const room = rooms[selectedRoom];
    if (room.state !== "ready"){
      setResult("Room is not ready to checkout yet.", "bad");
      return;
    }

    const g = getGuestById(room.guestId);
    if (g){
      // reward checkout
      coins += 4;
      setResult(`${g.name} checked out. Room is now DIRTY. (+4 coins)`, "good");
      guestMap.delete(g.id);
    } else {
      setResult(`Checked out. Room is now DIRTY. (+4 coins)`, "good");
      coins += 4;
    }

    // set room dirty
    room.state = "dirty";
    room.guestId = null;
    room.stayLeft = 0;
    room.stayMax = 0;

    // clear guest selection if it was this guest
    if (selectedGuestId === (g ? g.id : null)) selectedGuestId = null;

    renderAll();
  }

  // ---------- Clean ----------
  function cleanSelectedRoom(){
    if (selectedRoom == null){
      setResult("Select a room first.", "bad");
      return;
    }
    const room = rooms[selectedRoom];
    if (room.state !== "dirty"){
      setResult("Room is not dirty.", "bad");
      return;
    }

    const hasDet = (handL === "detergent" || handR === "detergent");
    if (!hasDet){
      setResult("You need 🧴 detergent in a hand to clean.", "bad");
      return;
    }

    // consume detergent stock and clear the detergent hand
    detStock = Math.max(0, detStock - 1);
    if (handL === "detergent") handL = "";
    if (handR === "detergent") handR = "";

    room.state = "cleaning";
    setResult("Cleaning started…", "good");
    renderAll();

    // after short delay, room becomes empty
    setTimeout(() => {
      room.state = "empty";
      setResult("Room cleaned! Now EMPTY again.", "good");
      renderAll();
    }, 1300);
  }

  // ---------- Ticking mood + stay ----------
  function maybeAssignOrder(g, chance){
    if (g.orderKey) return;
    if (Math.random() < chance){
      g.orderKey = pick(ORDERS).key;
    }
  }

  function guestLeaves(g, reason){
    // remove from queue if in queue
    if (g.location === "queue"){
      queue = queue.filter(x => x.id !== g.id);
    }
    // if in room, mark room dirty immediately (they left angrily)
    if (g.location === "room" && typeof g.roomIndex === "number"){
      const r = rooms[g.roomIndex];
      // if still occupied or ready, they storm out -> dirty
      if (r.state === "occupied" || r.state === "ready"){
        r.state = "dirty";
        r.guestId = null;
        r.stayLeft = 0; r.stayMax = 0;
      }
    }
    angry += 1;
    guestMap.delete(g.id);

    if (selectedGuestId === g.id) selectedGuestId = null;
    setResult(`${g.name} left 😡 (${reason})`, "bad");
  }

  function tick(){
    // sync coins in case puzzle changed them
    syncCoinsFromPuzzle();

    // queue guests patience drops
    for (const g of [...queue]){
      g.patience = clamp(g.patience - PATIENCE_DEC_QUEUE, 0, g.maxPatience);
      maybeAssignOrder(g, ORDER_CHANCE_QUEUE);

      if (g.patience <= 0){
        guestLeaves(g, "lost patience in queue");
      }
    }

    // room guests: patience drops slower + stay timer reduces
    rooms.forEach((r, i) => {
      if (r.state === "occupied" && r.guestId){
        const g = getGuestById(r.guestId);
        if (g){
          g.patience = clamp(g.patience - PATIENCE_DEC_ROOM, 0, g.maxPatience);
          maybeAssignOrder(g, ORDER_CHANCE_ROOM);

          if (g.patience <= 0){
            guestLeaves(g, "got too angry in room");
            return;
          }
        }
        r.stayLeft = Math.max(0, r.stayLeft - 1);
        if (r.stayLeft === 0){
          // ready to checkout (manual)
          r.state = "ready";
        }
      }
    });

    // auto-spawn gently if queue low
    if (queue.length < 3 && Math.random() < 0.22){
      addGuest();
    }

    renderAll();
  }

  // ---------- Tabs ----------
  function showTab(which){
    if (which === "hotel"){
      panelHotel.classList.add("active");
      panelPuzzle.classList.remove("active");
      tabBtnHotel.classList.add("active");
      tabBtnPuzzle.classList.remove("active");
    } else {
      panelHotel.classList.remove("active");
      panelPuzzle.classList.add("active");
      tabBtnHotel.classList.remove("active");
      tabBtnPuzzle.classList.add("active");
    }
  }

  // ---------- Event wiring ----------
  tabBtnHotel.addEventListener("click", () => showTab("hotel"));
  tabBtnPuzzle.addEventListener("click", () => showTab("puzzle"));

  btnSpawn.addEventListener("click", addGuest);

  btnReset.addEventListener("click", () => {
    if (!confirm("Reset hotel state? Coins & stats will reset too.")) return;
    localStorage.removeItem("ss_coins");
    localStorage.removeItem("ss_served");
    localStorage.removeItem("ss_angry");
    localStorage.removeItem("ss_snackStock");
    localStorage.removeItem("ss_detStock");
    localStorage.removeItem("ss_handL");
    localStorage.removeItem("ss_handR");
    location.reload();
  });

  roomsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".room");
    if (!btn) return;
    const idx = Number(btn.dataset.room);
    selectRoom(idx);

    const room = rooms[idx];
    // click empty room + selected guest in queue => check-in
    const g = selectedGuestId ? getGuestById(selectedGuestId) : null;
    if (room.state === "empty" && g && g.location === "queue"){
      checkInToRoom(idx);
      return;
    }

    // if room has a guest, selecting room also selects that guest for delivery
    if ((room.state === "occupied" || room.state === "ready") && room.guestId){
      selectedGuestId = room.guestId;
      const g2 = getGuestById(selectedGuestId);
      if (g2) setHint(`Selected ${g2.name}. Deliver their order if any.`);
      renderAll();
    }
  });

  // pick snacks into hands
  snackButtons.forEach((b) => {
    b.addEventListener("click", () => {
      if (snackStock <= 0){
        setResult("Snack station is empty. Win coins in puzzle to restock later.", "bad");
        return;
      }
      const itemKey = b.dataset.item;
      const hand = putInHand(itemKey);
      if (!hand){
        setResult("Both hands are full. Drop something first.", "bad");
        return;
      }
      setResult(`Picked ${itemToDisplay(itemKey)} into ${hand === "L" ? "Left" : "Right"} hand.`, "good");
      renderAll();
    });
  });

  btnDetergent.addEventListener("click", () => {
    if (detStock <= 0){
      setResult("No detergent left.", "bad");
      return;
    }
    const hand = putInHand("detergent");
    if (!hand){
      setResult("Both hands are full. Drop something first.", "bad");
      return;
    }
    setResult(`Picked 🧴 detergent into ${hand === "L" ? "Left" : "Right"} hand.`, "good");
    renderAll();
  });

  dropL.addEventListener("click", () => dropHand("L"));
  dropR.addEventListener("click", () => dropHand("R"));

  btnDeliver.addEventListener("click", deliverToSelectedGuest);
  btnCheckout.addEventListener("click", checkoutSelectedRoom);
  btnClean.addEventListener("click", cleanSelectedRoom);

  // ---------- Start ----------
  function boot(){
    // initial small queue
    for (let i=0;i<3;i++) addGuest();
    renderAll();
    setResult("Ready. Select a guest then click an empty room.", "good");
    setInterval(tick, TICK_MS);
  }

  boot();
})();
