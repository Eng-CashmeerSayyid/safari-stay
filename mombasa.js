/* =========================
Safari Stay – mombasa.js
Auto checkout version
========================= */

(() => {
  const elCoins = document.getElementById("coinsTop") || document.getElementById("coins");
  const elServed = document.getElementById("served");
  const elAngry = document.getElementById("angry");
  const elQueueCount = document.getElementById("queueCount");

  const elHint = document.getElementById("hint");
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

  const snackButtons = Array.from(document.querySelectorAll("#snacks .itemBtn"));
  const roomButtons = Array.from(document.querySelectorAll(".room"));

  const roomStateEl = (i) => document.getElementById(`roomState${i}`);
  const roomBodyEl = (i) => document.getElementById(`roomBody${i}`);
  const roomFootEl = (i) => document.getElementById(`roomFoot${i}`);
  const roomBarEl = (i) => document.getElementById(`roomBar${i}`);

  const ORDERS = [
    { key: "coconut", label: "🥥 Coconut" },
    { key: "soda", label: "🥤 Soda" },
    { key: "fries", label: "🍟 Fries" },
    { key: "sandwich", label: "🥪 Sandwich" },
  ];

  const EMOJI_GUESTS = ["🧑🏽‍🦱", "👩🏽‍🦱", "🧑🏿‍🦰", "👩🏾‍🦳", "🧑🏾", "👩🏿", "👩🏾‍🦱"];

  const TICK_MS = 1000;
  const PATIENCE_DEC_QUEUE = 1;
  const PATIENCE_DEC_ROOM = 1;
  const ORDER_CHANCE_QUEUE = 0.18;
  const ORDER_CHANCE_ROOM = 0.15;
  const STAY_MIN = 18;
  const STAY_MAX = 30;

  let coins = getCoins();
  let served = loadNum("ss_served", 0);
  let angry = loadNum("ss_angry", 0);
  let snackStock = loadNum("ss_snackStock", 12);
  let detStock = loadNum("ss_detStock", 6);
  let handL = loadStr("ss_handL", "");
  let handR = loadStr("ss_handR", "");

  let selectedGuestId = null;
  let selectedRoom = null;

  let queue = [];
  let rooms = [newRoom(), newRoom(), newRoom(), newRoom()];
  const guestMap = new Map();

  function loadNum(k, d) {
    const v = localStorage.getItem(k);
    return v == null ? d : Number(v) || d;
  }

  function loadStr(k, d) {
    const v = localStorage.getItem(k);
    return v == null ? d : String(v);
  }

  function getCoins() {
    if (typeof ssGetCoins === "function") return ssGetCoins();
    return loadNum("ss_coins", 0);
  }

  function addCoins(amount) {
    if (typeof ssAddCoins === "function") {
      ssAddCoins(amount);
      coins = ssGetCoins();
    } else {
      coins += amount;
      localStorage.setItem("ss_coins", String(coins));
    }
    popCoins();
  }

  function popCoins() {
    const pill = elCoins?.parentElement;
    if (!pill) return;
    pill.classList.add("pop");
    setTimeout(() => pill.classList.remove("pop"), 250);
  }

  function saveAll() {
    localStorage.setItem("ss_coins", String(coins));
    localStorage.setItem("ss_served", String(served));
    localStorage.setItem("ss_angry", String(angry));
    localStorage.setItem("ss_snackStock", String(snackStock));
    localStorage.setItem("ss_detStock", String(detStock));
    localStorage.setItem("ss_handL", String(handL || ""));
    localStorage.setItem("ss_handR", String(handR || ""));
  }

  function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function uid() {
    return "g" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function newRoom() {
    return {
      state: "empty",
      guestId: null,
      stayLeft: 0,
      stayMax: 0,
    };
  }

  function setHint(text) {
    elHint.textContent = text;
  }

  function setResult(msg, kind) {
    resultBar.classList.remove("good", "bad");
    if (kind === "good") resultBar.classList.add("good");
    if (kind === "bad") resultBar.classList.add("bad");
    resultBar.textContent = msg;
  }

  function orderLabel(orderKey) {
    const found = ORDERS.find((o) => o.key === orderKey);
    return found ? found.label : "—";
  }

  function itemToDisplay(key) {
    if (key === "detergent") return "🧴 Detergent";
    const found = ORDERS.find((o) => o.key === key);
    return found ? found.label : key;
  }

  function guestMoodText(g) {
    const p = g.patience / g.maxPatience;
    if (p > 0.66) return "😊 Happy";
    if (p > 0.33) return "😐 Impatient";
    return "😠 Angry";
  }

  function getGuestById(id) {
    if (!id) return null;
    const q = queue.find((g) => g.id === id);
    if (q) return q;
    return guestMap.get(id) || null;
  }

  function registerGuest(g) {
    guestMap.set(g.id, g);
  }

  function renderHUD() {
    coins = getCoins();

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

  function renderQueue() {
    elQueue.innerHTML = "";

    queue.forEach((g) => {
      const card = document.createElement("div");
      card.className = "guestCard" + (selectedGuestId === g.id ? " selected" : "");

      card.innerHTML = `
        <div class="guestLeft">
          <div class="avatar">${g.avatar}</div>
          <div class="guestMeta">
            <div class="guestName">${g.name}</div>
            <div class="mood">${guestMoodText(g)} • Patience ${g.patience}/${g.maxPatience}</div>
          </div>
        </div>
        <div class="orderBadge">${g.orderKey ? "Order: " + orderLabel(g.orderKey) : "Order: —"}</div>
      `;

      card.addEventListener("click", () => {
        selectedGuestId = g.id;
        setHint(`Selected guest: ${g.name}. Now click an EMPTY room to check-in.`);
        renderAll();
      });

      elQueue.appendChild(card);
    });
  }

  function renderRooms() {
    roomButtons.forEach((btn) =>
      btn.classList.remove("selected", "priority", "occupied", "dirty", "cleaning", "empty")
    );

    rooms.forEach((r, i) => {
      const btn = roomButtons[i];

      if (selectedRoom === i) btn.classList.add("selected");
      btn.classList.add(r.state);
      if (r.state === "empty") btn.classList.add("empty");

      const g = getGuestById(r.guestId);

      if (r.state === "empty") {
        roomStateEl(i).textContent = "Empty";
        roomBodyEl(i).textContent = "Empty";
        roomFootEl(i).textContent = "—";
        roomBarEl(i).style.width = "0%";
      } else if (r.state === "dirty") {
        roomStateEl(i).textContent = "Dirty";
        roomBodyEl(i).textContent = "Needs cleaning";
        roomFootEl(i).textContent = "Pick 🧴 detergent then press Clean";
        roomBarEl(i).style.width = "100%";
      } else if (r.state === "cleaning") {
        roomStateEl(i).textContent = "Cleaning…";
        roomBodyEl(i).textContent = "In progress";
        roomFootEl(i).textContent = "Wait…";
        roomBarEl(i).style.width = "60%";
      } else {
        const pct = r.stayMax ? 1 - r.stayLeft / r.stayMax : 0;

        roomStateEl(i).textContent = "Occupied";
        roomBodyEl(i).textContent = g ? `${g.avatar} ${g.name}` : "Guest";
        roomFootEl(i).textContent = g
          ? `${guestMoodText(g)} • ${g.orderKey ? "Order: " + orderLabel(g.orderKey) : "No order"}`
          : "—";
        roomBarEl(i).style.width = `${Math.round(pct * 100)}%`;

        if (g && g.orderKey) btn.classList.add("priority");
      }
    });
  }

  function renderAll() {
    renderHUD();
    renderQueue();
    renderRooms();
  }

  function createGuest() {
    const id = uid();
    const avatar = pick(EMOJI_GUESTS);
    const name = `Guest ${id.slice(-4).toUpperCase()}`;
    const maxPat = randInt(70, 100);
    const orderKey = Math.random() < ORDER_CHANCE_QUEUE ? pick(ORDERS).key : null;

    const g = {
      id,
      name,
      avatar,
      patience: maxPat,
      maxPatience: maxPat,
      orderKey,
      location: "queue",
    };

    registerGuest(g);
    return g;
  }

  function addGuest() {
    if (queue.length >= 7) {
      setResult("Queue is full. Check guests into rooms first.", "bad");
      return;
    }

    const g = createGuest();
    queue.push(g);
    setResult(`New guest arrived: ${g.name}`, "good");
    renderAll();
  }

  function checkInToRoom(roomIndex) {
    const room = rooms[roomIndex];

    if (room.state !== "empty") {
      setResult("That room is not empty.", "bad");
      return;
    }

    if (!selectedGuestId) {
      setResult("Select a guest first.", "bad");
      return;
    }

    const g = getGuestById(selectedGuestId);

    if (!g || g.location !== "queue") {
      setResult("Select a guest from the queue.", "bad");
      return;
    }

    queue = queue.filter((x) => x.id !== g.id);

    room.state = "occupied";
    room.guestId = g.id;
    room.stayMax = randInt(STAY_MIN, STAY_MAX);
    room.stayLeft = room.stayMax;

    g.location = "room";
    g.roomIndex = roomIndex;

    addCoins(1);

    selectedRoom = roomIndex;
    selectedGuestId = g.id;

    setHint("Guest checked in. They will checkout automatically.");
    setResult(`${g.name} checked into Room ${roomIndex + 1}. (+1 coin)`, "good");

    renderAll();
  }

  function putInHand(itemKey) {
    if (!handL) {
      handL = itemKey;
      return "L";
    }

    if (!handR) {
      handR = itemKey;
      return "R";
    }

    return null;
  }

  function dropHand(which) {
    if (which === "L") handL = "";
    if (which === "R") handR = "";
    setResult("Dropped item.", "good");
    renderHUD();
  }

  function deliverToSelectedGuest() {
    if (!selectedGuestId) {
      setResult("Select a guest first.", "bad");
      return;
    }

    const g = getGuestById(selectedGuestId);

    if (!g) {
      setResult("Selected guest not found.", "bad");
      return;
    }

    const hand =
      handL && handL !== "detergent" ? "L" : handR && handR !== "detergent" ? "R" : null;

    if (!hand) {
      setResult("Pick a snack into a hand first.", "bad");
      return;
    }

    const item = hand === "L" ? handL : handR;

    if (!g.orderKey) {
      g.patience = clamp(g.patience + 10, 0, g.maxPatience);
      addCoins(1);

      if (hand === "L") handL = "";
      else handR = "";

      setResult("No order — but you cheered them up. (+1 coin)", "good");
      renderAll();
      return;
    }

    if (g.orderKey !== item) {
      g.patience = clamp(g.patience - 12, 0, g.maxPatience);
      setResult(`Wrong item! They wanted ${orderLabel(g.orderKey)}.`, "bad");
      renderAll();
      return;
    }

    g.orderKey = null;
    g.patience = clamp(g.patience + 18, 0, g.maxPatience);
    served += 1;
    snackStock = Math.max(0, snackStock - 1);

    addCoins(3);

    if (hand === "L") handL = "";
    else handR = "";

    setResult("Delivered successfully! (+3 coins)", "good");
    renderAll();
  }

  function checkoutSelectedRoom() {
    setResult("Guests now checkout automatically. Just clean dirty rooms.", "good");
  }

  function cleanSelectedRoom() {
    if (selectedRoom == null) {
      setResult("Select a room first.", "bad");
      return;
    }

    const room = rooms[selectedRoom];

    if (room.state !== "dirty") {
      setResult("Room is not dirty.", "bad");
      return;
    }

    if (handL !== "detergent" && handR !== "detergent") {
      setResult("You need 🧴 detergent in a hand to clean.", "bad");
      return;
    }

    detStock = Math.max(0, detStock - 1);

    if (handL === "detergent") handL = "";
    if (handR === "detergent") handR = "";

    room.state = "cleaning";
    setResult("Cleaning started…", "good");
    renderAll();

    setTimeout(() => {
      room.state = "empty";
      setResult("Room cleaned! Now EMPTY again.", "good");
      renderAll();
    }, 1300);
  }

  function maybeAssignOrder(g, chance) {
    if (!g.orderKey && Math.random() < chance) {
      g.orderKey = pick(ORDERS).key;
    }
  }

  function guestLeaves(g, reason) {
    if (g.location === "queue") {
      queue = queue.filter((x) => x.id !== g.id);
    }

    if (g.location === "room" && typeof g.roomIndex === "number") {
      const r = rooms[g.roomIndex];

      if (r.state === "occupied") {
        r.state = "dirty";
        r.guestId = null;
        r.stayLeft = 0;
        r.stayMax = 0;
      }
    }

    angry += 1;
    guestMap.delete(g.id);

    if (selectedGuestId === g.id) selectedGuestId = null;

    setResult(`${g.name} left 😡 (${reason})`, "bad");
  }

  function autoCheckoutRoom(room, guest, roomIndex) {
    addCoins(4);
    setResult(`${guest.name} checked out from Room ${roomIndex + 1}. Room is now DIRTY. (+4 coins)`, "good");

    guestMap.delete(guest.id);

    room.state = "dirty";
    room.guestId = null;
    room.stayLeft = 0;
    room.stayMax = 0;

    if (selectedGuestId === guest.id) selectedGuestId = null;
  }

  function tick() {
    coins = getCoins();

    for (const g of [...queue]) {
      g.patience = clamp(g.patience - PATIENCE_DEC_QUEUE, 0, g.maxPatience);
      maybeAssignOrder(g, ORDER_CHANCE_QUEUE);

      if (g.patience <= 0) {
        guestLeaves(g, "lost patience in queue");
      }
    }

    rooms.forEach((r, index) => {
      if (r.state === "occupied" && r.guestId) {
        const g = getGuestById(r.guestId);

        if (g) {
          g.patience = clamp(g.patience - PATIENCE_DEC_ROOM, 0, g.maxPatience);
          maybeAssignOrder(g, ORDER_CHANCE_ROOM);

          if (g.patience <= 0) {
            guestLeaves(g, "got too angry in room");
            return;
          }

          r.stayLeft = Math.max(0, r.stayLeft - 1);

          if (r.stayLeft === 0) {
            autoCheckoutRoom(r, g, index);
          }
        }
      }
    });

    if (queue.length < 3 && Math.random() < 0.16) {
      addGuest();
    }

    renderAll();
  }

  function showTab(which) {
    if (which === "hotel") {
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
    selectedRoom = idx;

    const room = rooms[idx];
    const g = selectedGuestId ? getGuestById(selectedGuestId) : null;

    if (room.state === "empty" && g && g.location === "queue") {
      checkInToRoom(idx);
      return;
    }

    if (room.state === "occupied" && room.guestId) {
      selectedGuestId = room.guestId;
      const g2 = getGuestById(selectedGuestId);

      if (g2) setHint(`Selected ${g2.name}. Deliver their order if any.`);
    }

    renderAll();
  });

  snackButtons.forEach((b) => {
    b.addEventListener("click", () => {
      if (snackStock <= 0) {
        setResult("Snack station is empty.", "bad");
        return;
      }

      const itemKey = b.dataset.item;
      const hand = putInHand(itemKey);

      if (!hand) {
        setResult("Both hands are full. Drop something first.", "bad");
        return;
      }

      setResult(
        `Picked ${itemToDisplay(itemKey)} into ${hand === "L" ? "Left" : "Right"} hand.`,
        "good"
      );

      renderAll();
    });
  });

  btnDetergent.addEventListener("click", () => {
    if (detStock <= 0) {
      setResult("No detergent left.", "bad");
      return;
    }

    const hand = putInHand("detergent");

    if (!hand) {
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

  function boot() {
    for (let i = 0; i < 3; i++) addGuest();

    renderAll();
    setResult("Ready. Select a guest then click an empty room.", "good");

    setInterval(tick, TICK_MS);
  }

  boot();
})();
