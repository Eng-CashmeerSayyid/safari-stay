// =======================================
// SAFARI STAY – MOMBASA HOTEL ENGINE
// Hotel Mania style system
// =======================================

(function(){

// ===============================
// BASIC HELPERS
// ===============================
const ROOM_COUNT = 4;

function el(id){ return document.getElementById(id); }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function setMsg(txt){
  const h = el("hint");
  if(h) h.textContent = txt;
}

// ===============================
// STATE
// ===============================
let rooms = [];
let queue = [];
let selectedGuest = null;

let served = 0;
let angry = 0;

let HANDS = { L:null, R:null };

let tickTimer = null;
let spawnTimer = null;

// ===============================
// GUEST
// ===============================
let guestId = 1;

function spawnGuest(){
  if(queue.length >= 6) return;

  queue.push({
    id:"g"+guestId++,
    patience:15,
    patienceTotal:15
  });

  renderQueue();
}

// ===============================
// ROOMS
// ===============================
function initRooms(){
  rooms = [];
  for(let i=0;i<ROOM_COUNT;i++){
    rooms.push({
      id:i,
      state:"empty", // empty | occupied | dirty | cleaning
      stay:0,
      request:null,
      requestTime:0,
      requestTotal:0
    });
  }
}

// ===============================
// RENDER QUEUE
// ===============================
function renderQueue(){
  const wrap = el("queue");
  if(!wrap) return;
  wrap.innerHTML="";

  queue.forEach(g=>{
    const d=document.createElement("div");
    d.className="guestCard";
    if(selectedGuest===g.id) d.classList.add("selected");
    d.textContent=`Guest ${g.id}`;
    d.onclick=()=>{
      selectedGuest = selectedGuest===g.id ? null : g.id;
      renderQueue();
    };
    wrap.appendChild(d);
  });

  el("queueCount").textContent=queue.length;
}

// ===============================
// RENDER ROOMS
// ===============================
function renderRooms(){
  const wrap=el("rooms");
  if(!wrap) return;

  wrap.querySelectorAll(".room").forEach(btn=>{
    const id=parseInt(btn.dataset.room);
    const r=rooms[id];

    const body=btn.querySelector(".roomBody");
    const foot=btn.querySelector(".roomFoot");

    if(r.state==="empty"){
      body.textContent="Empty";
      foot.textContent="—";
    }

    if(r.state==="occupied"){
      body.textContent="Guest inside";

      if(r.request){
        foot.textContent =
          `🔔 ${r.request} (${Math.ceil(r.requestTime)}s) • Stay ${Math.ceil(r.stay)}s`;
      }else{
        foot.textContent = `Stay ${Math.ceil(r.stay)}s`;
      }
    }

    if(r.state==="dirty"){
      body.textContent="Dirty";
      foot.textContent="Click to clean";
    }

    if(r.state==="cleaning"){
      body.textContent="Cleaning...";
      foot.textContent=`${Math.ceil(r.clean)}s`;
    }
  });
}

// ===============================
// ROOM CLICK
// ===============================
function onRoomClick(id){
  const r=rooms[id];

  // CLEANING
  if(r.state==="dirty"){

    if(HANDS.L==="detergent") HANDS.L=null;
    else if(HANDS.R==="detergent") HANDS.R=null;
    else{
      setMsg("Pick detergent first");
      return;
    }

    r.state="cleaning";
    r.clean=5;
    renderHands();
    return;
  }

  // CHECK IN
  if(r.state==="empty" && selectedGuest){
    const index=queue.findIndex(g=>g.id===selectedGuest);
    if(index===-1) return;

    queue.splice(index,1);
    selectedGuest=null;

    r.state="occupied";
    r.stay=rand(12,16);

    served++;
    renderQueue();
    return;
  }

  // DELIVER SERVICE
  if(r.state==="occupied" && r.request){

    if(HANDS.L===r.request) HANDS.L=null;
    else if(HANDS.R===r.request) HANDS.R=null;
    else{
      setMsg("Wrong item");
      return;
    }

    r.request=null;
    renderHands();
  }
}

// ===============================
// HANDS
// ===============================
function renderHands(){
  el("leftItem").textContent=HANDS.L || "Empty";
  el("rightItem").textContent=HANDS.R || "Empty";
}

function giveItem(item){
  if(!HANDS.L) HANDS.L=item;
  else if(!HANDS.R) HANDS.R=item;
  else setMsg("Hands full");
  renderHands();
}

// ===============================
// GAME LOOP
// ===============================
function tick(){

  // QUEUE patience
  for(let i=queue.length-1;i>=0;i--){
    queue[i].patience--;
    if(queue[i].patience<=0){
      queue.splice(i,1);
      angry++;
    }
  }

  // ROOMS
  rooms.forEach(r=>{

    // OCCUPIED
    if(r.state==="occupied"){

      r.stay--;

      // create request randomly
      if(!r.request && Math.random()<0.1){
        r.request = Math.random()<0.5 ? "soda":"sandwich";
        r.requestTime=10;
        r.requestTotal=10;
      }

      // request timer
      if(r.request){
        r.requestTime--;
        if(r.requestTime<=0){
          // guest leaves angry
          r.state="dirty";
          r.request=null;
          angry++;
        }
      }

      // stay finished → auto checkout
      if(r.stay<=0){
        r.state="dirty";
      }
    }

    // CLEANING
    if(r.state==="cleaning"){
      r.clean--;
      if(r.clean<=0){
        r.state="empty";
      }
    }

  });

  renderRooms();
}

// ===============================
// START
// ===============================
function start(){
  initRooms();
  renderRooms();
  renderQueue();
  renderHands();

  tickTimer=setInterval(tick,1000);
  spawnTimer=setInterval(spawnGuest,3000);

  spawnGuest();
  spawnGuest();
}

// ===============================
// EVENTS
// ===============================
document.addEventListener("DOMContentLoaded",()=>{

  document.querySelectorAll(".room").forEach(b=>{
    b.onclick=()=>onRoomClick(parseInt(b.dataset.room));
  });

  el("btnSpawn").onclick=spawnGuest;
  el("btnReset").onclick=location.reload;

  document.querySelectorAll("#snacks button").forEach(b=>{
    b.onclick=()=>giveItem(b.dataset.item);
  });

  el("btnDetergent").onclick=()=>giveItem("detergent");

  start();
});

})();
