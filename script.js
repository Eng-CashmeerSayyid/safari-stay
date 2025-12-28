// ================= TAB SWITCHER =================
(function(){
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

  tabPuzzle.onclick = showPuzzle;
  tabHotel.onclick = showHotel;
  showPuzzle();
})();

// ================= PUZZLE =================
const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const TILES = ["🍓","🥥","🌴","🐚","⭐","🍍"];

let board = [];
let selected = null;
let moves = 30;
let coins = Number(localStorage.getItem("coins")) || 0;

const grid = document.getElementById("grid");
const movesEl = document.getElementById("moves");
const coinsEl = document.getElementById("coins");
const comboEl = document.getElementById("combo");
const clearedEl = document.getElementById("cleared");

function randomTile(){ return TILES[Math.floor(Math.random()*TILES.length)]; }

function render(){
  grid.innerHTML = "";
  board.forEach((t,i)=>{
    const c = document.createElement("div");
    c.className = "cell";
    c.textContent = t;
    c.onclick = ()=>clickTile(i);
    grid.appendChild(c);
  });
}

function clickTile(i){
  if(selected===null){ selected=i; return; }
  swap(selected,i);
  selected=null;
}

function swap(a,b){
  [board[a],board[b]]=[board[b],board[a]];
  coins++;
  updateUI();
  render();
}

function updateUI(){
  movesEl.textContent = moves;
  coinsEl.textContent = coins;
  comboEl.textContent = "0";
  clearedEl.textContent = "0";
  localStorage.setItem("coins",coins);
}

function startPuzzle(){
  board=[];
  for(let i=0;i<TOTAL;i++) board.push(randomTile());
  updateUI();
  render();
}

startPuzzle();




