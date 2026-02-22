// ===============================
// mombasa.js (FULL) — Safari Stay: Mombasa Hotel
// 4 rooms + queue + patience + manual checkout + manual cleaning (detergent required)
// Level 1: No orders, don't lose too many angry guests
// Level 2: Orders enabled (snacks/detergent), must deliver before check-in, zero waste
// Coins shared with puzzle via localStorage "safaristay_coins"
// ===============================

(() => {
  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);

  // ---------- Persistent shared data ----------
  const COINS_KEY = "safaristay_coins";
  const LEVEL_KEY = "safaristay_mombasa_level";

  function getCoins() {
    const v = parseInt(localStorage.getItem(COINS_KEY) || "0", 10);
    return Number.isFinite(v) ? v : 0;
  }
  function setCoins(v) {
    localStorage.setItem(COINS_KEY, String(Math.max(0, Math.floor(v))));
    syncCoinsUI();
  }
  function addCoins(delta) {
    setCoins(getCoins() + delta);
  }
  function syncCoinsUI() {
    const el = $("coins");
    if (el) el.textContent = String(getCoins());
  }

  function getLevel() {
    const v = parseInt(localStorage.getItem(LEVEL_KEY) || "1", 10);
    if (!Number.isFinite(v)) return 1;
    return Math.min(10, Math.max(1, v));
  }
  function setLevel(v) {
    const lvl = Math.min(10, Math.max(1, Math.floor(v)));
    localStorage.setItem(LEVEL_KEY, String(lvl));
  }

  // ---------- Game config ----------
  const ROOM_COUNT = 4;
  const MAX_QUEUE = 6;

  function levelConfig(level) {
    if (level === 1) {
      return {
        name: "Mombasa Level 1 — No Angry Guests",
        timeLimitSec: 90,
        serveGoal: 10,
        angryLimit: 2,
        basePatienceSec: 18,
        spawnEveryMs: 2600,
        ordersEnabled: false,
        wasteLimit: 999, // not used
        comingSoon: false,
      };
    }
    if (level === 2) {
      return {
        name: "Mombasa Level 2 — Two Hands (No Waste)",
        timeLimitSec: 100,
        serveGoal: 12,
        angryLimit: 2,
        basePatienceSec: 20,
        spawnEveryMs: 2400,
        ordersEnabled: true,
        wasteLimit: 0,
        comingSoon: false,
      };
    }
    return {
      name: `Mombasa Level ${level} — Coming Soon`,
      timeLimitSec: 60,
      serveGoal: 5,
      angryLimit: 1,
      basePatienceSec: 16,
      spawnEveryMs: 2800,
      ordersEnabled: false,
      wasteLimit: 999,
      comingSoon: true,
    };
  }

  // ---------- State ----------
  let cfg = null;
  let level = 1;

  let served = 0;
  let angryLeft = 0;
  let waste = 0;

  let timeLeft = 0;
  let tickTimer = null;
  let spawnTimer = null;

  let queue = [];
  let rooms = [];

  let selectedGuestId = null;
  let selectedRoomId = null;

  // Hands
  const HANDS = { L: null, R: null }; // {type}
  // type: "coconut"|"soda"|"fries"|"sandwich"|"detergent"

  // ---------- UI helpers ----------
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

  function moodLabel(pct) {
    if (pct > 0.66) return "😊 Patient";
    if (pct > 0.33) return "😤 Impatient";
    return "😡 Angry";
  }

  function orderLabel(order) {
    if (!order) return "—";
    if (order === "coconut") return "🥥 Coconut";
    if (order === "soda") return "🥤 Soda";
    if (order === "fries") return "🍟 Fries";
    if (order === "sandwich") return "🥪 Sandwich";
    if (order === "detergent") return "🧴 Detergent";
    return order;
  }

  function handsText(type) {
    if (!type) return "Empty";
    return orderLabel(type);
  }

  function updateHandsUI() {
    const li = $("leftItem");
    const ri = $("rightItem");
    if (li) li.textContent = handsText(HANDS.L?.type);
    if (ri) ri.textContent = handsText(HANDS.R?.type);
  }

  // ---------- Rooms ----------
  function initRooms() {
    rooms = [];
    for (let i = 0; i < ROOM_COUNT; i++) {
      rooms.push({
        id: i + 1,
        state: "empty", // empty | occupied | dirty
        guestId: null,
        stayLeft: 0,
        stayTotal: 0,
      });
    }
    selectedRoomId = null;
  }

  function renderRooms() {
    const wrap = $("rooms");
    if (!wrap) return;

    // Your HTML currently contains 4 <button class="room" data-room="0..3">...
    // We'll not rebuild them; we will update their inner text and selected state.
    // But in case someone changed HTML, we support both styles.

    const roomEls = wrap.querySelectorAll(".room");
    if (roomEls.length === ROOM_COUNT) {
      roomEls.forEach((btn) => {
        const idx = parseInt(btn.dataset.room || "0", 10);
        const r = rooms[idx];
        if (!r) return;

        btn.classList.toggle("selected", r.id === selectedRoomId);

        const body = btn.querySelector(`#roomBody${idx}`);
        const foot = btn.querySelector(`#roomFoot${idx}`);

        if (body) {
          body.textContent =
            r.state === "empty" ? "Empty" :
            r.state === "occupied" ? "Occupied" :
            "Dirty";
        }
        if (foot) {
          if (r.state === "occupied") {
            foot.textContent = `⏳ ${Math.ceil(r.stayLeft)}s left`;
          } else if (r.state === "dirty") {
            foot.textContent = "🧴 Needs detergent + Clean";
          } else {
            foot.textContent = "—";
          }
        }

        // click handler
        btn.onclick = () => onRoomClick(r.id);
      });
      return;
    }

    // fallback: rebuild (if user changed HTML)
    wrap.innerHTML = "";
    rooms.forEach((r) => {
      const btn = document.createElement("button");
      btn.className = "room";
      btn.dataset.room = String(r.id);
      btn.classList.toggle("selected", r.id === selectedRoomId);

      btn.innerHTML = `
        <div class="roomTop">Room ${r.id}</div>
        <div class="roomBody">${r.state === "empty" ? "Empty" : r.state}</div>
        <div class="roomFoot">${
          r.state === "occupied" ? `⏳ ${Math.ceil(r.stayLeft)}s left` :
          r.state === "dirty" ? "🧴 Needs detergent + Clean" : "—"
        }</div>
      `;
      btn.addEventListener("click", () => onRoomClick(r.id));
      wrap.appendChild(btn);
    });
  }

  function onRoomClick(roomId) {
    selectedRoomId = roomId;
    renderRooms();

    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    // Check-in rule: only empty room + selected guest
    if (room.state === "empty") {
      if (!selectedGuestId) {
        setHint("Select a guest, then click an EMPTY room.");
        return;
      }

      const gi = queue.findIndex((g) => g.id === selectedGuestId);
      if (gi === -1) {
        selectedGuestId = null;
        renderQueue();
        setHint("That guest is not in the queue anymore.");
        return;
      }

      const guest = queue[gi];

      // Level 2: must deliver order before check-in
      if (cfg.ordersEnabled && !guest.orderDone) {
        setHint(`Deliver ${orderLabel(guest.order)} before check-in.`);
        return;
      }

      // Move guest to room
      queue.splice(gi, 1);
      selectedGuestId = null;

      room.state = "occupied";
      room.guestId = guest.id;
      room.stayTotal = randFrom([10, 12, 14]);
      room.stayLeft = room.stayTotal;

      served++;
      addCoins(2);

      setHint(`✅ Checked in ${guest.name} to Room ${roomId}. (+2 coins)`);
      updateHud();
      renderQueue();
      renderRooms();
      checkWinLose();
      return;
    }

    // If occupied/dirty, we just select it (actions buttons do work)
    if (room.state === "occupied") {
      setHint(`Room ${roomId} is occupied. Wait or Checkout manually.`);
    }
    if (room.state === "dirty") {
      setHint(`Room ${roomId} is dirty. Pick detergent then Clean.`);
    }
  }

  // ---------- Queue ----------
  let guestCounter = 1;

  function randFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function spawnGuest(manual = false) {
    if (!cfg || cfg.comingSoon) return;
    if (queue.length >= MAX_QUEUE) {
      if (manual) setHint("Queue is full. Serve/check-in guests first.");
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
      order,
      orderDone: !cfg.ordersEnabled, // auto-done when orders disabled
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
        badge.textContent = g.orderDone ? "✅ Ready" : orderLabel(g.order);
      } else {
        badge.textContent = "Tap to select";
      }

      card.appendChild(left);
      card.appendChild(badge);

      card.addEventListener("click", () => {
        selectedGuestId = (selectedGuestId === g.id) ? null : g.id;
        setHint(selectedGuestId ? `Selected ${g.name}.` : "Selection cleared.");
        renderQueue();
      });

      wrap.appendChild(card);
    });

    updateHud();
  }

  // ---------- Hands + Stations ----------
  function firstFreeHand() {
    if (!HANDS.L) return "L";
    if (!HANDS.R) return "R";
    return null;
  }

  function pickIntoHand(type) {
    if (!cfg || !cfg.ordersEnabled) {
      setHint("Hands are used in Level 2.");
      return;
    }

    const slot = firstFreeHand();
    if (!slot) {
      setHint("Both hands are full. Drop or deliver first.");
      return;
    }

    HANDS[slot] = { type };
    updateHandsUI();
    setHint(`Picked ${orderLabel(type)} into ${slot === "L" ? "Left" : "Right"} hand.`);
  }

  function dropHand(slot) {
    if (!cfg || !cfg.ordersEnabled) return;
    if (!HANDS[slot]) return;

    HANDS[slot] = null;
    waste++;

    updateHandsUI();
    updateHud();
    setHint(`❌ Dropped item. Waste = ${waste} (Level 2 must stay 0).`);
    checkWinLose();
  }

  function deliverToSelectedGuest() {
    if (!cfg || !cfg.ordersEnabled) {
      setHint("Delivery is for Level 2 orders.");
      return;
    }
    if (!selectedGuestId) {
      setHint("Select a guest in the queue first.");
      return;
    }

    const guest = queue.find((g) => g.id === selectedGuestId);
    if (!guest) {
      selectedGuestId = null;
      renderQueue();
      setHint("Guest not found.");
      return;
    }

    const haveL = HANDS.L?.type;
    const haveR = HANDS.R?.type;

    // must match order
    let used = null;
    if (haveL === guest.order) used = "L";
    else if (haveR === guest.order) used = "R";

    if (!used) {
      setHint(`Wrong item. Need ${orderLabel(guest.order)}.`);
      return;
    }

    guest.orderDone = true;
    HANDS[used] = null;
    addCoins(1);

    updateHandsUI();
    renderQueue();
    updateHud();
    setHint(`✅ Delivered ${orderLabel(guest.order)}. (+1 coin) Now check-in.`);
  }

  // ---------- Checkout + Clean ----------
  function checkoutSelectedRoom() {
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!room) {
      setHint("Select a room first.");
      return;
    }
    if (room.state !== "occupied") {
      setHint("Checkout works only on an occupied room.");
      return;
    }

    room.state = "dirty";
    room.guestId = null;
    room.stayLeft = 0;
    room.stayTotal = 0;

    setHint(`🧾 Checked out Room ${room.id}. Now it is DIRTY.`);
    renderRooms();
  }

  function hasDetergentInHand() {
    return HANDS.L?.type === "detergent" || HANDS.R?.type === "detergent";
  }

  function consumeDetergent() {
    if (HANDS.L?.type === "detergent") HANDS.L = null;
    else if (HANDS.R?.type === "detergent") HANDS.R = null;
    updateHandsUI();
  }

  function cleanSelectedRoom() {
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!room) {
      setHint("Select a room first.");
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

    // consume detergent and clean
    consumeDetergent();
    room.state = "empty";
    setHint(`✅ Cleaned Room ${room.id}. Ready for next guest.`);
    renderRooms();
  }

  // ---------- Timers / Loop ----------
  function stopTimers() {
    if (tickTimer) clearInterval(tickTimer);
    if (spawnTimer) clearInterval(spawnTimer);
    tickTimer = null;
    spawnTimer = null;
  }

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

    timeLeft = cfg.timeLimitSec;

    setHint(cfg.ordersEnabled
      ? "Level 2: Deliver the order (hands) THEN click guest → empty room."
      : "Click a guest, then click an EMPTY room."
    );
    setSubhint("Tip: Snacks are delivered by the bellboy. Cleaning needs detergent in a hand.");

    updateHud();
    renderQueue();
    renderRooms();

    // Coming soon: no timers
    if (cfg.comingSoon) {
      setHint(`${cfg.name} — coming soon. Play Level 1 or 2 for now.`);
      return;
    }

    // initial guests
    spawnGuest(false);
    spawnGuest(false);

    // tick each second
    tickTimer = setInterval(() => {
      timeLeft--;

      // queue patience
      for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].patience -= 1;
        if (queue[i].patience <= 0) {
          queue.splice(i, 1);
          angryLeft++;
          setHint("😡 A guest left angry!");
        }
      }

      // rooms stay countdown
      rooms.forEach((r) => {
        if (r.state === "occupied") {
          r.stayLeft -= 1;
          if (r.stayLeft <= 0) {
            // stay ended -> make room dirty (manual checkout still possible earlier)
            r.state = "dirty";
            r.guestId = null;
            r.stayLeft = 0;
            r.stayTotal = 0;
          }
        }
      });

      renderQueue();
      renderRooms();
      updateHud();

      // time end
      if (timeLeft <= 0) {
        checkWinLose(true);
      } else {
        checkWinLose(false);
      }
    }, 1000);

    // auto spawn
    spawnTimer = setInterval(() => spawnGuest(false), cfg.spawnEveryMs);
  }

  function checkWinLose(forceTimeEnd = false) {
    if (!cfg || cfg.comingSoon) return;

    // lose
    if (angryLeft > cfg.angryLimit) {
      stopTimers();
      setHint(`❌ Failed: too many angry guests (${angryLeft}). Press Reset.`);
      return;
    }
    if (cfg.ordersEnabled && waste > cfg.wasteLimit) {
      stopTimers();
      setHint(`❌ Failed: you wasted an item. (Waste ${waste}) Press Reset.`);
      return;
    }

    // win
    if (served >= cfg.serveGoal) {
      stopTimers();
      addCoins(10);
      setHint(`🏆 Level ${level} complete! +10 coins. (Next levels coming soon)`);
      return;
    }

    if (forceTimeEnd) {
      stopTimers();
      setHint(`⏰ Time up! Served ${served}/${cfg.serveGoal}. Press Reset.`);
    }
  }

  // ---------- Wiring / Events ----------
  function wireButtons() {
    const btnSpawn = $("btnSpawn");
    if (btnSpawn) btnSpawn.addEventListener("click", () => spawnGuest(true));

    const btnReset = $("btnReset");
    if (btnReset) btnReset.addEventListener("click", () => startLevel(getLevel()));

    const btnDeliver = $("btnDeliver");
    if (btnDeliver) btnDeliver.addEventListener("click", deliverToSelectedGuest);

    const btnCheckout = $("btnCheckout");
    if (btnCheckout) btnCheckout.addEventListener("click", checkoutSelectedRoom);

    const btnClean = $("btnClean");
    if (btnClean) btnClean.addEventListener("click", cleanSelectedRoom);

    const btnDetergent = $("btnDetergent");
    if (btnDetergent) btnDetergent.addEventListener("click", () => pickIntoHand("detergent"));

    // Drop buttons
    const dropL = $("dropL");
    if (dropL) dropL.addEventListener("click", () => dropHand("L"));

    const dropR = $("dropR");
    if (dropR) dropR.addEventListener("click", () => dropHand("R"));

    // Snack buttons (they all share class itemBtn and have data-item)
    const snackWrap = $("snacks");
    if (snackWrap) {
      snackWrap.addEventListener("click", (e) => {
        const btn = e.target.closest(".itemBtn");
        if (!btn) return;
        const type = btn.dataset.item;
        if (!type) return;
        pickIntoHand(type);
      });
    }
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Run only on Mombasa page with your new layout
    if (!$("panel-hotel")) return;

    syncCoinsUI();
    wireButtons();

    // Start saved level (default 1)
    const saved = getLevel();
    startLevel(saved);
  });
})();
