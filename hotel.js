(() => {
  window.addEventListener("error", (e) => {
    const box = document.getElementById("errBox");
    const txt = document.getElementById("errText");
    if (!box || !txt) return;
    box.style.display = "block";
    txt.textContent =
      (e.message || "Unknown error") + "\n" +
      (e.filename || "") + ":" + (e.lineno || "") + ":" + (e.colno || "");
  });

  const coinsEl = document.getElementById("coins");
  const cleanersEl = document.getElementById("cleaners");
  const queueEl = document.getElementById("queue");
  const bellboyEl = document.getElementById("bellboy");
  const hotelEl = document.getElementById("hotel");
  const selectedEl = document.getElementById("selected");
  const toastEl = document.getElementById("toast");

  if (!coinsEl || !cleanersEl || !queueEl || !bellboyEl || !hotelEl || !selectedEl || !toastEl) return;

  const CLEAN_TIME_MS = 3000;
  const ORDER_MIN_DELAY_MS = 3500;
  const ORDER_MAX_DELAY_MS = 9500;
  const MAX_ACTIVE_ORDERS  = 2;
  const ORDER_TOTAL_MS  = 12000;
  const ANGRY_LEAVE_MS  = 9000;
  const DELIVERY_TRAVEL_MS = 1200;
  const POST_DELIVERY_STAY_MS = 4500;
  const MOOD_STEP_MS = 650;

  const MENU = {
    juice:  { label:"🥤 Juice",  price:5 },
    chips:  { label:"🍟 Chips",  price:6 },
    coffee: { label:"☕ Coffee", price:7 }
  };

  const SAVE_KEY = "mombasa_rooms_fix_v2_hotel";

  let coins = 0, cleaners = 1, queue = 0, selected = null;
  let bellboy = { busy:false, roomId:null, item:null };
  let cleaningInProgress = 0;
  let guestSeq = 1;

  let rooms = [1,2,3,4].map(id => ({
    id, status:"clean", guestId:null, order:null, mood:"", moodUntil:0, timers:{}
  }));

  function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function toast(msg){
    toastEl.style.display = "block";
    toastEl.textContent = msg;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.style.display = "none", 2200);
  }

  function save(){
    const safeRooms = rooms.map(r => ({
      id:r.id, status:r.status, guestId:r.guestId,
      order:(r.order && r.order.status==="delivered") ? r.order : null
    }));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ coins, cleaners, queue, guestSeq, rooms:safeRooms }));
  }

  function load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return;
      const d = JSON.parse(raw);
      coins = Number(d.coins) || 0;
      cleaners = Number(d.cleaners) || 1;
      queue = Number(d.queue) || 0;
      guestSeq = Number(d.guestSeq) || 1;

      rooms = (d.rooms || []).map(r => ({
        id:r.id, status:r.status || "clean", guestId:r.guestId || null,
        order:null, mood:"", moodUntil:0, timers:{}
      }));
      rooms = [1,2,3,4].map(id => rooms.find(x=>x.id===id) || ({
        id, status:"clean", guestId:null, order:null, mood:"", moodUntil:0, timers:{}
      }));
    }catch(_){}
  }

  function resetSave(){
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  function badge(status){
    if(status==="clean") return ["CLEAN","bClean"];
    if(status==="dirty") return ["DIRTY","bDirty"];
    if(status==="occupied") return ["OCCUPIED","bOcc"];
    if(status==="cleaning") return ["CLEANING","bCleaning"];
    return [String(status).toUpperCase(),""];
  }

  function activeOrderCount(){
    return rooms.filter(r => r.order && (r.order.status==="waiting" || r.order.status==="delivering")).length;
  }

  function clearRoomTimers(r){
    clearTimeout(r.timers.orderAppear);
    clearTimeout(r.timers.angryLeave);
    clearTimeout(r.timers.checkout);
  }

  function assignGuests(){
    if(queue <= 0) return;
    const free = rooms.find(r => r.status==="clean" && r.guestId===null);
    if(!free) return;

    queue--;
    free.status="occupied";
    free.guestId=guestSeq++;
    free.order=null;
    free.mood="";
    free.moodUntil=0;

    clearRoomTimers(free);

    const delay = rand(ORDER_MIN_DELAY_MS, ORDER_MAX_DELAY_MS);
    free.timers.orderAppear = setTimeout(() => createOrder(free.id), delay);

    render();
  }

  function spawnGuest(){
    queue++;
    render();
    assignGuests();
  }

  function createOrder(roomId){
    const r = rooms.find(x=>x.id===roomId);
    if(!r || r.status!=="occupied" || r.order) return;

    if(activeOrderCount() >= MAX_ACTIVE_ORDERS){
      clearTimeout(r.timers.orderAppear);
      r.timers.orderAppear = setTimeout(() => createOrder(roomId), rand(1500, 3500));
      return;
    }

    const keys = Object.keys(MENU);
    const itemKey = keys[Math.floor(Math.random()*keys.length)];
    const now = Date.now();

    r.order = { itemKey, status:"waiting", createdAt: now, deadlineAt: now + ORDER_TOTAL_MS };

    clearTimeout(r.timers.angryLeave);
    r.timers.angryLeave = setTimeout(() => angryLeave(roomId), ORDER_TOTAL_MS + ANGRY_LEAVE_MS);

    toast(`Room ${roomId} ordered ${MENU[itemKey].label}`);
    render();
  }

  function angryLeave(roomId){
    const r = rooms.find(x=>x.id===roomId);
    if(!r || r.status!=="occupied") return;
    if(!r.order || r.order.status!=="waiting") return;

    toast(`Guest in Room ${roomId} left angry 😠💨`);
    r.status="dirty"; r.guestId=null; r.order=null; r.mood=""; r.moodUntil=0;
    render();
    assignGuests();
  }

  function selectFood(key){
    selected = key;
    selectedEl.textContent = MENU[key].label;
    toast(`Selected ${MENU[key].label}. Click the room.`);
  }

  function setMood(roomId, steps){
    let i=0;
    const run = () => {
      const rr = rooms.find(x=>x.id===roomId);
      if(!rr || rr.status!=="occupied") return;
      rr.mood = steps[i];
      rr.moodUntil = Date.now() + MOOD_STEP_MS + 80;
      render();
      i++;
      if(i < steps.length) setTimeout(run, MOOD_STEP_MS);
    };
    run();
  }

  function attemptDelivery(roomId){
    const r = rooms.find(x=>x.id===roomId);
    if(!r) return;

    if(!selected){ toast("Pick a snack first 🍟🥤☕"); return; }
    if(bellboy.busy){ toast("Bellboy is busy."); return; }
    if(r.status!=="occupied"){ toast("No guest here."); return; }
    if(!r.order || r.order.status!=="waiting"){ toast("No waiting order."); return; }

    if(r.order.itemKey !== selected){
      toast(`Wrong item. Ordered ${MENU[r.order.itemKey].label}`);
      return;
    }

    clearTimeout(r.timers.angryLeave);
    r.order.status="delivering";

    bellboy.busy=true;
    bellboy.roomId=roomId;
    bellboy.item=selected;

    selected=null;
    selectedEl.textContent="None";

    render();
    toast("Bellboy delivering… 🤵");

    setTimeout(() => {
      const room = rooms.find(x=>x.id===roomId);
      if(!room || room.status!=="occupied" || !room.order){
        bellboy.busy=false; bellboy.roomId=null; bellboy.item=null;
        render(); return;
      }

      room.order.status="delivered";
      coins += MENU[bellboy.item].price;

      setMood(roomId, ["😋","😍"]);

      bellboy.busy=false; bellboy.roomId=null; bellboy.item=null;

      render();
      toast("Delivered ✅");

      clearTimeout(room.timers.checkout);
      room.timers.checkout = setTimeout(() => checkout(roomId), POST_DELIVERY_STAY_MS);
    }, DELIVERY_TRAVEL_MS);
  }

  function checkout(roomId){
    const r = rooms.find(x=>x.id===roomId);
    if(!r || r.status!=="occupied") return;
    if(!r.order || r.order.status!=="delivered") return;

    coins += 10;
    r.status="dirty"; r.guestId=null; r.order=null; r.mood=""; r.moodUntil=0;
    render();
    assignGuests();
  }

  function canClean(){ return cleaningInProgress < cleaners; }

  function startCleaning(roomId){
    const r = rooms.find(x=>x.id===roomId);
    if(!r) return;
    if(r.status!=="dirty"){ toast("Not dirty."); return; }
    if(!canClean()){ toast("All cleaners busy. Upgrade."); return; }

    cleaningInProgress++;
    r.status="cleaning";
    render();

    setTimeout(() => {
      r.status="clean";
      cleaningInProgress = Math.max(0, cleaningInProgress-1);
      render();
      toast(`Room ${roomId} clean ✅`);
      assignGuests();
    }, CLEAN_TIME_MS);
  }

  function hireCleaner(){
    const cost = 80 * cleaners;
    if(coins < cost){ toast(`Need ${cost} coins.`); return; }
    coins -= cost;
    cleaners++;
    render();
    toast(`Cleaner hired! Now ${cleaners}.`);
  }

  function orderVisual(order){
    if(order.status==="delivering") return { p:100, c:"#65d6ff", face:"🏃", pulse:false };
    if(order.status==="delivered")  return { p:100, c:"#7dffb2", face:"✅", pulse:false };

    const now = Date.now();
    const total = Math.max(1, order.deadlineAt - order.createdAt);
    const remain = order.deadlineAt - now;
    const pct = Math.max(0, Math.min(100, (remain / total) * 100));

    let c="#7dffb2", face="🙂", pulse=false;
    if(pct <= 66){ c="#ffd36e"; face="😐"; }
    if(pct <= 33 || remain <= 0){ c="#ff7b7b"; face="😠"; pulse=true; }

    return { p:pct, c, face, pulse };
  }

  function render(){
    coinsEl.textContent = coins;
    cleanersEl.textContent = cleaners;
    queueEl.textContent = queue;
    bellboyEl.textContent = bellboy.busy ? `Delivering (Room ${bellboy.roomId})` : "Ready";

    hotelEl.innerHTML = "";

    rooms.forEach(r => {
      const [lbl, cls] = badge(r.status);

      const card = document.createElement("div");
      card.className = "room";
      card.addEventListener("click", () => attemptDelivery(r.id));

      const head = document.createElement("div");
      head.className = "roomHead";
      head.innerHTML = `<div><b>Room ${r.id}</b></div><div class="badge ${cls}">${lbl}</div>`;
      card.appendChild(head);

      const guestLine = document.createElement("div");
      guestLine.className = "guestLine";
      guestLine.textContent =
        r.status==="occupied" ? `Guest #${r.guestId} 🧳` :
        r.status==="dirty" ? `Needs cleaning 🧹` :
        r.status==="cleaning" ? `Cleaning in progress…` :
        `Empty room`;
      card.appendChild(guestLine);

      const orderRow = document.createElement("div");
      orderRow.className = "orderRow";

      const tag = document.createElement("div");
      tag.className = "orderTag";

      const timerWrap = document.createElement("div");
      timerWrap.className = "timerWrap";

      if(r.status==="occupied" && r.order){
        const v = orderVisual(r.order);
        const itemLabel = MENU[r.order.itemKey].label;
        const moodNow = (r.moodUntil && Date.now() < r.moodUntil && r.mood) ? ` ${r.mood}` : "";

        tag.textContent =
          r.order.status==="waiting" ? `Order: ${itemLabel}` :
          r.order.status==="delivering" ? `Delivering: ${itemLabel}` :
          `Delivered ✅${moodNow}`;

        const ring = document.createElement("div");
        ring.className = "timerRing" + (v.pulse ? " pulse" : "");
        ring.style.setProperty("--p", v.p.toFixed(1));
        ring.style.setProperty("--c", v.c);

        const face = document.createElement("div");
        face.className = "timerFace";
        face.textContent = v.face;

        timerWrap.appendChild(ring);
        timerWrap.appendChild(face);
      } else if(r.status==="occupied"){
        tag.textContent = "Waiting to order…";
        timerWrap.style.visibility = "hidden";
      } else {
        tag.textContent = "—";
        timerWrap.style.visibility = "hidden";
      }

      orderRow.appendChild(tag);
      orderRow.appendChild(timerWrap);
      card.appendChild(orderRow);

      const btnRow = document.createElement("div");
      btnRow.className = "roomBtns";

      const cleanBtn = document.createElement("button");
      cleanBtn.className = "roomBtn";
      cleanBtn.textContent = (r.status==="dirty") ? "🧹 CLEAN" : (r.status==="cleaning" ? "Cleaning…" : "Clean");
      cleanBtn.disabled = !(r.status==="dirty" && canClean());
      cleanBtn.addEventListener("click", (e) => { e.stopPropagation(); startCleaning(r.id); });

      btnRow.appendChild(cleanBtn);
      card.appendChild(btnRow);

      hotelEl.appendChild(card);
    });

    save();
  }

  // Wire buttons
  document.getElementById("btnSpawn").addEventListener("click", spawnGuest);
  document.getElementById("btnHire").addEventListener("click", hireCleaner);
  document.getElementById("btnReset").addEventListener("click", resetSave);
  document.querySelectorAll("[data-food]").forEach(b => b.addEventListener("click", () => selectFood(b.dataset.food)));

  load();
  render();

  // Auto-start 2 guests so you SEE it works
  if (queue === 0 && rooms.every(r => r.guestId === null)) {
    queue = 2;
    assignGuests();
    assignGuests();
    toast("Welcome! 2 guests checked in ✅");
    render();
  }

  setInterval(assignGuests, 650);
  setInterval(() => {
    if (rooms.some(r => r.order && (r.order.status==="waiting" || r.order.status==="delivering"))) render();
  }, 250);

})();

