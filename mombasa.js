// ===============================
// mombasa.js (FULL) — Safari Stay (Hotel Mania style)
// Rules requested:
// - Check-in: MANUAL (select guest -> click empty room)
// - Serving: MANUAL by CLICKING THE ROOM (pick item -> click room)
// - Checkout: AUTOMATIC (when stay ends, served++ and room becomes dirty)
// - Cleaning: MANUAL (must pick detergent first, then click Clean button)
// - Room service: requests during stay, timed; miss = guest leaves immediately (Option A)
// - Priority indicator: always shows most urgent request + highlights that room
// - Coins shared with puzzle via localStorage "safaristay_coins"
// ===============================

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Storage ----------
  const COINS_KEY = "safaristay_coins";
  const LEVEL_KEY = "safaristay_mombasa_level";

  const getInt = (k, d) => {
    const v = parseInt(localStorage.getItem(k) ?? "", 10);
    return Number.isFinite(v) ? v : d;
  };

  function getCoins() { return Math.max(0, getInt(COINS_KEY, 0)); }
  function setCoins(v) {
    localStorage.setItem(COINS_KEY, String(Math.max(0, Math.floor(v))));
    syncCoinsUI();
  }
  function addCoins(d) { setCoins(getCoins() + d); }
  function syncCoinsUI() {
    const el = $("coins");
    if (el) el.textContent = String(getCoins());
  }

  function getLevel() { return Math.min(10, Math.max(1, getInt(LEVEL_KEY, 1))); }
  function setLevel(v) {
    const lvl = Math.min(10, Math.max(1, Math.floor(v)));
    localStorage.setItem(LEVEL_KEY, String(lvl));
  }

  // ---------- Helpers ----------
  const ROOM_COUNT = 4;
  const MAX_QUEUE = 6;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function moodLabel(pct) {
    if (pct > 0.66) return "😊 Patient";
    if (pct > 0.33) return "😤 Impatient";
    return "😡 Angry";
  }

  function labelItem(type) {
    if (!type) return "—";
    if (type === "coconut") return "🥥 Coconut";
    if (type === "soda") return "🥤 Soda";
    if (type === "fries") return "🍟 Fries";
    if (type === "sandwich") return "🥪 Sandwich";
    if (type === "detergent") return "🧴 Detergent";
    return type;
  }

  // ---------- Level config (fair Option A) ----------
  function levelConfig(level) {
    if (level === 1) {
      return {
        name: "Mombasa L1 — Basics",
        timeLimitSec: 90,
        serveGoal: 10,
        angryLimit: 2,
        basePatienceSec: 18,
        spawnEveryMs: 2600,
        ordersEnabled: false,      // queue order before check-in OFF
        wasteLimit: 999,
        roomServiceEnabled: true,
        roomServiceChance: 0.55,   // fair intro
      };
    }
    if (level === 2) {
      return {
        name: "Mombasa L2 — Orders + No Waste",
        timeLimitSec: 100,
        serveGoal: 12,
        angryLimit: 2,
        basePatienceSec: 20,
        spawnEveryMs: 2400,
        ordersEnabled: true,       // queue order before check-in ON
        wasteLimit: 0,
        roomServiceEnabled: true,
        roomServiceChance: 0.75,
      };
    }
    // Levels 3–10 baseline (playable, tougher)
    return {
      name: `Mombasa L${level} — Challenge`,
      timeLimitSec: 105,
      serveGoal: 12 + (level - 2),
      angryLimit: Math.max(1, 2 - Math.floor((level - 2) / 3)),
      basePatienceSec: Math.max(12, 20 - Math.floor((level - 2) / 2)),
      spawnEveryMs: Math.max(1600, 2400 - (level - 2) * 100),
      ordersEnabled: true,
      wasteLimit: 0,
      roomServiceEnabled: true,
      roomServiceChance: clamp(0.78 + (level - 2) * 0.02, 0.78, 0.9),
    };
  }

  // Request tuning (Option A fair)
  function maxRequestsPerStay(level) {
    return (level === 1) ? 1 : 2;
  }
  function requestTimerSeconds(level) {
    return (level === 1) ? randFrom([10, 11, 12]) : randFrom([8, 9, 10, 11]);
  }

  // ---------- State ----------
  let cfg = null;
  let level = 1;

  let served = 0;      // ✅ counts completed guests (AUTO checkout)
  let angryLeft = 0;
  let waste = 0;

  let queue = [];
  let rooms = [];

  let selectedGuestId = null; // for check-in (and for L2 queue orders if you want)
  let selectedRoomId = null;

  let tickTimer = null;
  let spawnTimer = null;

  // Hands (inventory)
  const HANDS = { L: null, R: null }; // {type}

  // ---------- UI ----------
  function setHint(text) {
    const h = $("hint");
    if (h) h.textContent = text;
  }
  function setSubhint(text) {
    const s = $("subhint");
    if (s) s.textContent = text;
  }

  function updateHud() {
    const s = $("served");
    const a = $("angry");
    const q = $("queueCount");
    if (s) s.textContent = String(served);
    if (a) a.textContent = String(angryLeft);
    if (q) q.textContent = String(queue.length);
    syncCoinsUI();
  }

  function updateHandsUI() {
    const li = $("leftItem");
    const ri = $("rightItem");
    if (li) li.textContent = HANDS.L?.type ? labelItem(HANDS.L.type) : "Empty";
    if (ri) ri.textContent = HANDS.R?.type ? labelItem(HANDS.R.type) : "Empty";
  }

  // ---------- Rooms ----------
  function initRooms() {
    rooms = [];
    for (let i = 0; i < ROOM_COUNT; i++) {
      rooms.push({
        id: i + 1,
        state: "empty",     // empty | occupied | dirty
        guest: null,        // guest object
        stayLeft: 0,
        stayTotal: 0,

        // Room service request
        request: null,      // { type, timeLeft, total }
        nextRequestIn: 0,   // seconds until next request attempt
        requestsDone: 0,
      });
    }
    selectedRoomId = null;
  }

  // Priority room highlight + messaging
  function computePriority() {
    let best = null;
    for (const r of rooms) {
      if (r.state === "occupied" && r.request) {
        if (!best || r.request.timeLeft < best.request.timeLeft) best = r;
      }
    }
    return best;
  }

  function renderRooms() {
    const wrap = $("rooms");
    if (!wrap) return;

    const priorityRoom = computePriority();

    // We update your existing 4 buttons (data-room=0..3)
    const roomEls = wrap.querySelectorAll(".room");
    roomEls.forEach((btn) => {
      const idx = parseInt(btn.dataset.room || "0", 10);
      const r = rooms[idx];
      if (!r) return;

      const body = btn.querySelector(`#roomBody${idx}`);
      const foot = btn.querySelector(`#roomFoot${idx}`);

      // selected state
      btn.classList.toggle("selected", r.id === selectedRoomId);

      // highlight priority room
      btn.classList.toggle("priority", !!priorityRoom && priorityRoom.id === r.id);

      if (body) {
        body.textContent =
          r.state === "empty" ? "Empty" :
          r.state === "occupied" ? (r.guest ? `${r.guest.avatar} ${r.guest.name}` : "Occupied") :
          "Dirty";
      }

      if (r.state === "occupied") {
  if (r.request) {
    foot.textContent =
      `🔔 ${labelItem(r.request.type)} (${Math.ceil(r.request.timeLeft)}s) • ` +
      `Stay: ${Math.ceil(r.stayLeft)}s`;
  } else {
    foot.textContent = `⏳ Stay: ${Math.ceil(r.stayLeft)}s`;
  }
}

      // click handler
      btn.onclick = () => onRoomClick(r.id);
    });

    // Priority text
    if (priorityRoom && priorityRoom.request) {
      setSubhint(`🚨 Priority: Room ${priorityRoom.id} needs ${labelItem(priorityRoom.request.type)} (${Math.ceil(priorityRoom.request.timeLeft)}s)`);
    } else {
      setSubhint("Tip: Pick item → click room to serve. Cleaning needs detergent in a hand.");
    }
  }

  function roomById(id) { return rooms.find((x) => x.id === id); }

  // ---------- Queue ----------
  let guestCounter = 1;

  function spawnGuest(manual = false) {
    if (!cfg) return;
    if (queue.length >= MAX_QUEUE) {
      if (manual) setHint("Queue is full. Check in guests first.");
      return;
    }

    const avatars = ["🧑🏽", "👩🏽", "🧑🏾", "👩🏾", "🧔🏽", "👱🏽‍♀️", "🧕🏽"];
    const snackOrders = ["coconut", "soda", "fries", "sandwich"];
    const allOrders = [...snackOrders, "detergent"];

    const order = cfg.ordersEnabled ? randFrom(allOrders) : null;

    const g = {
      id: `g${guestCounter}`,
      name: `Guest ${guestCounter}`,
      avatar: randFrom(avatars),

      patienceTotal: cfg.basePatienceSec,
      patience: cfg.basePatienceSec,

      // optional queue-order (Level 2+)
      order,
      orderDone: !cfg.ordersEnabled,

      // store once per stay: decides if they request room service at all
      _serviceRoll: null,
    };

    guestCounter++;
    queue.push(g);
    renderQueue();
    updateHud();
  }

  function renderQueue() {
    const wrap = $("queue");
    if (!wrap) return;
    wrap.innerHTML = "";

    queue.forEach((g) => {
      const card = document.createElement("div");
      card.className = "guestCard";
      if (g.id === selectedGuestId) card.classList.add("selected");

      const pct = g.patienceTotal > 0 ? (g.patience / g.patienceTotal) : 0;

      const left = document.createElement("div");
      left.className = "guestLeft";

      const av = document.createElement("div");
      av.className = "avatar";
      av.textContent = g.avatar;

      const meta = document.createElement("div");
      meta.className = "guestMeta";

      const nm = document.createElement("div");
      nm.className = "guestName";
      nm.textContent = g.name;

      const mood = document.createElement("div");
      mood.className = "mood";
      mood.textContent = `${moodLabel(pct)} • ${Math.ceil(g.patience)}s`;

      meta.appendChild(nm);
      meta.appendChild(mood);
      left.appendChild(av);
      left.appendChild(meta);

      const badge = document.createElement("div");
      badge.className = "orderBadge";
      if (cfg.ordersEnabled) {
        badge.textContent = g.orderDone ? "✅ Ready" : labelItem(g.order);
      } else {
        badge.textContent = "Tap to select";
      }

      card.appendChild(left);
      card.appendChild(badge);

      card.addEventListener("click", () => {
        selectedGuestId = (selectedGuestId === g.id) ? null : g.id;
        setHint(selectedGuestId ? `Selected ${g.name}. Now click an EMPTY room.` : "Selection cleared.");
        renderQueue();
      });

      wrap.appendChild(card);
    });

    updateHud();
  }

  // ---------- Hands / Picking ----------
  function firstFreeHand() {
    if (!HANDS.L) return "L";
    if (!HANDS.R) return "R";
    return null;
  }

  function pickIntoHand(type) {
    if (!cfg) return;

    const slot = firstFreeHand();
    if (!slot) {
      setHint("Both hands are full. Drop something first.");
      return;
    }
    HANDS[slot] = { type };
    updateHandsUI();
    setHint(`Picked ${labelItem(type)} into ${slot === "L" ? "Left" : "Right"} hand.`);
  }

  function dropHand(slot) {
    if (!cfg) return;
    if (!HANDS[slot]) return;

    const droppedType = HANDS[slot].type;
    HANDS[slot] = null;

    if (cfg.wasteLimit === 0) {
      waste++;
      setHint(`❌ Dropped ${labelItem(droppedType)}. Waste=${waste} (must stay 0).`);
      checkWinLose(false);
    } else {
      setHint(`Dropped ${labelItem(droppedType)}.`);
    }

    updateHandsUI();
    updateHud();
  }

  function haveItem(type) {
    if (HANDS.L?.type === type) return "L";
    if (HANDS.R?.type === type) return "R";
    return null;
  }

  function consumeFromHand(slot) {
    if (slot === "L") HANDS.L = null;
    if (slot === "R") HANDS.R = null;
    updateHandsUI();
  }

  // ---------- Serving: pick item then CLICK ROOM ----------
  function tryServeRoomByClick(room) {
    if (!cfg || !room || room.state !== "occupied" || !room.guest) return false;

    // If there is an active request, serve it
    if (room.request) {
      const need = room.request.type;
      const slot = haveItem(need);
      if (!slot) {
        setHint(`Room ${room.id} needs ${labelItem(need)}. Pick it, then click the room.`);
        return true; // handled (we gave feedback)
      }

      // success: serve request
      consumeFromHand(slot);
      room.request = null;
      room.requestsDone += 1;
      room.nextRequestIn = cfg.roomServiceEnabled ? randFrom([4, 5, 6, 7]) : 999;

      addCoins(2);
      setHint(`✅ Served Room ${room.id}: ${labelItem(need)} (+2 coins)`);
      renderRooms();
      updateHud();
      return true;
    }

    // If no request, just select the room
    setHint(`Room ${room.id} selected. Waiting for requests or stay end.`);
    return false;
  }

  // ---------- Check-in: manual ----------
  function onRoomClick(roomId) {
    selectedRoomId = roomId;

    const room = roomById(roomId);
    if (!room) return;

    // If occupied: clicking room is for serving (manual)
    if (room.state === "occupied") {
      tryServeRoomByClick(room);
      renderRooms();
      return;
    }

    // Dirty: clicking selects it (clean via button)
    if (room.state === "dirty") {
      setHint(`Room ${room.id} is dirty. Pick detergent then click Clean.`);
      renderRooms();
      return;
    }

    // Empty -> check-in if guest selected
    if (room.state === "empty") {
      if (!selectedGuestId) {
        setHint("Select a guest, then click an EMPTY room.");
        renderRooms();
        return;
      }

      const gi = queue.findIndex((g) => g.id === selectedGuestId);
      if (gi === -1) {
        selectedGuestId = null;
        renderQueue();
        setHint("That guest is not in the queue anymore.");
        renderRooms();
        return;
      }

      const guest = queue[gi];

      // Level 2 queue-order rule (still supported)
      if (cfg.ordersEnabled && !guest.orderDone) {
        setHint(`(Level 2) Deliver ${labelItem(guest.order)} first, then check-in.`);
        renderRooms();
        return;
      }

      // check-in
      queue.splice(gi, 1);
      selectedGuestId = null;

      room.state = "occupied";
      room.guest = guest;

      room.stayTotal = randFrom([10, 12, 14]);
      room.stayLeft = room.stayTotal;

      // room service scheduling
      room.request = null;
      room.requestsDone = 0;
      room.nextRequestIn = cfg.roomServiceEnabled ? randFrom([3, 4, 5, 6]) : 999;
      if (room.guest) room.guest._serviceRoll = null;

      // small reward for check-in
      addCoins(1);
      setHint(`✅ Checked in ${guest.name} to Room ${room.id}. (+1 coin)`);

      renderQueue();
      renderRooms();
      updateHud();
      checkWinLose(false);
    }
  }

  // ---------- Level 2 queue-order delivery (optional) ----------
  // You still have a Deliver button, but your “serving is manual” applies to ROOMS.
  // For queue-orders, we’ll keep Deliver button (simple + clear).
  function deliverToSelectedQueueGuest() {
    if (!cfg || !cfg.ordersEnabled) {
      setHint("Queue orders are in Level 2+.");
      return;
    }
    if (!selectedGuestId) {
      setHint("Select a guest in the queue first.");
      return;
    }
    const guest = queue.find((g) => g.id === selectedGuestId);
    if (!guest) {
      setHint("Guest not found.");
      selectedGuestId = null;
      renderQueue();
      return;
    }
    if (guest.orderDone) {
      setHint("This guest is already ready. Check-in now.");
      return;
    }

    const need = guest.order;
    const slot = haveItem(need);
    if (!slot) {
      setHint(`Need ${labelItem(need)}. Pick it into a hand, then press Deliver.`);
      return;
    }

    consumeFromHand(slot);
    guest.orderDone = true;
    addCoins(1);
    setHint(`✅ Delivered ${labelItem(need)} to ${guest.name}. (+1 coin) Now check-in.`);
    renderQueue();
    updateHud();
  }

  // ---------- Cleaning: manual + detergent required ----------
  function hasDetergentInHand() {
    return HANDS.L?.type === "detergent" || HANDS.R?.type === "detergent";
  }
  function consumeDetergent() {
    if (HANDS.L?.type === "detergent") HANDS.L = null;
    else if (HANDS.R?.type === "detergent") HANDS.R = null;
    updateHandsUI();
  }

  function cleanSelectedRoom() {
    const room = roomById(selectedRoomId);
    if (!room) {
      setHint("Select a dirty room first.");
      return;
    }
    if (room.state !== "dirty") {
      setHint("Clean works only on a DIRTY room.");
      return;
    }
    if (!hasDetergentInHand()) {
      setHint("Pick detergent into a hand first (🧴).");
      return;
    }
    consumeDetergent();
    room.state = "empty";
    setHint(`✅ Cleaned Room ${room.id}. Ready for next guest.`);
    renderRooms();
  }

  // ---------- Checkout: AUTOMATIC ----------
  function autoCheckout(room) {
    // guest completes stay -> served++ -> room dirty
    room.state = "dirty";
    room.guest = null;
    room.request = null;
    room.stayLeft = 0;
    room.stayTotal = 0;
    room.nextRequestIn = 0;

    served++;
    addCoins(1); // reward for completion
    setHint(`✅ Guest completed stay (auto checkout). Room ${room.id} is now dirty.`);
  }

  // ---------- Room service scheduler (Option A: miss = leave) ----------
  function maybeCreateRoomRequest(room) {
    if (!cfg.roomServiceEnabled) return;
    if (room.state !== "occupied" || !room.guest) return;
    if (room.request) return;

    if (room.requestsDone >= maxRequestsPerStay(level)) return;

    // decide once per stay if guest will request at all
    if (room.guest._serviceRoll == null) room.guest._serviceRoll = Math.random();
    if (room.guest._serviceRoll > cfg.roomServiceChance) return;

    const snacks = ["coconut", "soda", "fries", "sandwich"];
    const type = randFrom(snacks);

    const total = requestTimerSeconds(level);

    room.request = { type, total, timeLeft: total };
    setHint(`🔔 Room ${room.id} requests ${labelItem(type)}! Pick it and click the room.`);
  }

  function handleRoomRequestTick(room) {
    if (!room.request) return;

    room.request.timeLeft -= 1;

    if (room.request.timeLeft <= 0) {
      // Option A: guest leaves immediately due to missed request
      angryLeft++;

      room.state = "dirty";
      room.guest = null;
      room.request = null;
      room.stayLeft = 0;
      room.stayTotal = 0;
      room.nextRequestIn = 0;

      setHint("😡 Guest left due to missed room service! Room is now dirty.");
      updateHud();
      renderRooms();
      checkWinLose(false);
    }
  }

  // ---------- Win/Lose ----------
  function stopTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (spawnTimer) clearInterval(spawnTimer);
    tickTimer = null;
    spawnTimer = null;
  }

  function checkWinLose(forceTimeEnd) {
    if (!cfg) return;

    if (angryLeft > cfg.angryLimit) {
      stopTimers();
      setHint(`❌ Failed: too many angry guests (${angryLeft}). Press Reset.`);
      return;
    }

    if (cfg.wasteLimit === 0 && waste > 0) {
      stopTimers();
      setHint("❌ Failed: you wasted an item. Press Reset.");
      return;
    }

    if (served >= cfg.serveGoal) {
      stopTimers();
      addCoins(10);
      setHint(`🏆 Level ${level} complete! Served ${served}/${cfg.serveGoal}. +10 coins.`);
      return;
    }

    if (forceTimeEnd) {
      stopTimers();
      setHint(`⏰ Time up! Served ${served}/${cfg.serveGoal}. Press Reset.`);
    }
  }

  // ---------- Game loop ----------
  function startLevel(lvl) {
    stopTimers();

    level = lvl;
    setLevel(level);
    cfg = levelConfig(level);

    served = 0;
    angryLeft = 0;
    waste = 0;

    queue = [];
    selectedGuestId = null;

    HANDS.L = null;
    HANDS.R = null;
    updateHandsUI();

    initRooms();

    setHint("Select a guest → click EMPTY room to check-in. Pick item → click room to serve.");
    setSubhint("Tip: Miss a room request and the guest leaves immediately (Option A).");

    updateHud();
    renderQueue();
    renderRooms();

    // initial guests
    spawnGuest(false);
    spawnGuest(false);

    // tick each second
    tickTimer = setInterval(() => {
      // queue patience
      for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].patience -= 1;
        if (queue[i].patience <= 0) {
          queue.splice(i, 1);
          angryLeft++;
          setHint("😡 A guest left angry in the queue!");
        }
      }

      // rooms: stay + requests
      rooms.forEach((r) => {
        if (r.state !== "occupied") return;

        // stay countdown
        r.stayLeft -= 1;

        // request scheduling
        if (!r.request && cfg.roomServiceEnabled) {
          r.nextRequestIn -= 1;
          if (r.nextRequestIn <= 0) {
            maybeCreateRoomRequest(r);
            // if not created (chance), try later
            if (!r.request) r.nextRequestIn = randFrom([4, 5, 6]);
          }
        }

        // active request tick
        handleRoomRequestTick(r);

        // auto checkout at stay end (only if still occupied)
        if (r.state === "occupied" && r.stayLeft <= 0) {
          autoCheckout(r);
        }
      });

      renderQueue();
      renderRooms();
      updateHud();

      checkWinLose(false);
    }, 1000);

    // spawn timer
    spawnTimer = setInterval(() => spawnGuest(false), cfg.spawnEveryMs);
  }

  // ---------- Wiring ----------
  function wireButtons() {
    $("btnSpawn")?.addEventListener("click", () => spawnGuest(true));
    $("btnReset")?.addEventListener("click", () => startLevel(getLevel()));

    // Deliver button remains for Level 2 queue-orders (pre-checkin)
    $("btnDeliver")?.addEventListener("click", deliverToSelectedQueueGuest);

    // Checkout button exists but checkout is automatic now
    $("btnCheckout")?.addEventListener("click", () => {
      setHint("Checkout is automatic when stay ends.");
    });

    // Clean
    $("btnClean")?.addEventListener("click", cleanSelectedRoom);

    // Detergent pick
    $("btnDetergent")?.addEventListener("click", () => pickIntoHand("detergent"));

    // Drop
    $("dropL")?.addEventListener("click", () => dropHand("L"));
    $("dropR")?.addEventListener("click", () => dropHand("R"));

    // Snack picks
    $("snacks")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".itemBtn");
      if (!btn) return;
      const type = btn.dataset.item;
      if (!type) return;
      pickIntoHand(type);
    });
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("panel-hotel")) return;

    syncCoinsUI();
    wireButtons();
    startLevel(getLevel());
  });
})();
