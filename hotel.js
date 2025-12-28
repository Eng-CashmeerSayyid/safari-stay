/* ==========================
   HOTEL SIM (Step 1 + 2)
   One guest walks:
   Entrance -> Reception -> Room -> Reception -> Exit
   ========================== */

const tabPuzzle = document.getElementById("tabPuzzle");
const tabHotel = document.getElementById("tabHotel");
const viewPuzzle = document.getElementById("viewPuzzle");
const viewHotel = document.getElementById("viewHotel");

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
tabPuzzle?.addEventListener("click", showPuzzle);
tabHotel?.addEventListener("click", showHotel);

// HUD
const servedEl = document.getElementById("served");
const hotelCashEl = document.getElementById("hotelCash");
const spawnGuestBtn = document.getElementById("spawnGuestBtn");

// Map + guest
const mapEl = document.getElementById("hotelMap");
const guestEl = document.getElementById("guest");
const stReception = document.getElementById("stReception");
const stRoom = document.getElementById("stRoom");
const stExit = document.getElementById("stExit");

let served = 0;
let hotelCash = 0;

let guest = {
  x: 10, y: 10,
  speed: 2.0,
  state: "IDLE",
  target: null
};

function setGuestPos(){
  guestEl.style.left = guest.x + "px";
  guestEl.style.top  = guest.y + "px";
}

function centerOf(el){
  const mapRect = mapEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // center relative to map
  return {
    x: (r.left - mapRect.left) + r.width/2 - 22,
    y: (r.top - mapRect.top) + r.height/2 - 22
  };
}

function setTarget(point){
  guest.target = point;
}

function moveToward(){
  if(!guest.target) return;

  const dx = guest.target.x - guest.x;
  const dy = guest.target.y - guest.y;
  const dist = Math.hypot(dx, dy);

  if(dist < 2){
    guest.x = guest.target.x;
    guest.y = guest.target.y;
    guest.target = null;
    onArrive();
    return;
  }

  guest.x += (dx / dist) * guest.speed;
  guest.y += (dy / dist) * guest.speed;
}

function onArrive(){
  // state machine (basic route)
  if(guest.state === "TO_RECEPTION"){
    guest.state = "TO_ROOM";
    setTarget(centerOf(stRoom));
  } else if(guest.state === "TO_ROOM"){
    guest.state = "TO_PAY";
    setTarget(centerOf(stReception));
  } else if(guest.state === "TO_PAY"){
    // pay
    served += 1;
    hotelCash += 10;         // hotel money
    // also add to your global coins
    const coins = Number(localStorage.getItem("coins")) || 0;
    localStorage.setItem("coins", String(coins + 5)); // reward 5 coins per guest served

    servedEl.textContent = served;
    hotelCashEl.textContent = hotelCash;

    guest.state = "TO_EXIT";
    setTarget(centerOf(stExit));
  } else if(guest.state === "TO_EXIT"){
    guest.state = "IDLE";
  }
}

function spawnGuest(){
  // Start guest at top-left (entrance)
  guest.x = 10; guest.y = 10;
  guest.state = "TO_RECEPTION";
  // important: center calculations require DOM ready
  setTimeout(() => setTarget(centerOf(stReception)), 50);
}

spawnGuestBtn?.addEventListener("click", spawnGuest);

function loop(){
  moveToward();
  setGuestPos();
  requestAnimationFrame(loop);
}
setGuestPos();
loop();
