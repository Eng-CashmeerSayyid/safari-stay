/* ==========================================================
   SAFARI STAY – MOMBASA PUZZLE (SAFE)
   - 8x8 match-3
   - +1 coin per MOVE
   - +1 coin per tile cleared (bonus)
   - shared coins key: "coins"
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const gridEl = document.getElementById("grid");
  if (!gridEl) return;

  const coinsEl = document.getElementById("coins");
  const movesEl = document.getElementById("moves");
  const comboEl = document.getElementById("combo");
  const clearedEl = document.getElementById("cleared");

  const newGameBtn = document.getElementById("newGameBtn");
  const resetCoinsBtn = document.getElementById("resetCoinsBtn");

  const WIDTH = 8;
  const TOTAL = WIDTH * WIDTH;
  const ICONS = ["🍍","🥥","🐚","⭐","🍓","🌴"];

  let board = new Array(TOTAL).fill(null);
  let selected = null;
  let moves = 30;

  let combo = 0;
  let clearedTotal = 0;
  let busy = false;

  let coins = Number(localStorage.getItem("coins")) || 0;

  function saveCoins(){ localStorage.setItem("coins", String(coins)); }
  function renderTop(){ if (coinsEl) coinsEl.textContent = String(coins); if (movesEl) movesEl.textContent = String(moves); }
  function renderMini(){ if (comboEl) comboEl.textContent = String(combo); if (clearedEl) clearedEl.textContent = String(clearedTotal); }

  function randIcon(){ return ICONS[Math.floor(Math.random() * ICONS.length)]; }

  function renderGrid(){
    gridEl.innerHTML = "";
    for (let i = 0; i < TOTAL; i++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = board[i] ?? " ";
      if (selected === i) cell.classList.add("selected");
      cell.addEventListener("click", () => onCellClick(i));
      gridEl.appendChild(cell);
    }
  }

  function swap(a,b){ const t=board[a]; board[a]=board[b]; board[b]=t; }

  function neighbors(a,b){
    const ax=a%WIDTH, ay=Math.floor(a/WIDTH);
    const bx=b%WIDTH, by=Math.floor(b/WIDTH);
    return (Math.abs(ax-bx)+Math.abs(ay-by))===1;
  }

  function hasAnyMatch(){
    for (let r=0;r<WIDTH;r++){
      for (let c=0;c<WIDTH-2;c++){
        const i=r*WIDTH+c, v=board[i];
        if (v && v===board[i+1] && v===board[i+2]) return true;
      }
    }
    for (let c=0;c<WIDTH;c++){
      for (let r=0;r<WIDTH-2;r++){
        const i=r*WIDTH+c, v=board[i];
        if (v && v===board[i+WIDTH] && v===board[i+2*WIDTH]) return true;
      }
    }
    return false;
  }

  function crushMatches(silent=false){
    let crushed=0;

    // rows
    for (let r=0;r<WIDTH;r++){
      let start=r*WIDTH, runVal=board[start], runLen=1;
      for (let c=1;c<WIDTH;c++){
        const idx=r*WIDTH+c, v=board[idx];
        if (v && v===runVal) runLen++;
        else{
          if (runVal && runLen>=3){
            for (let k=0;k<runLen;k++){ board[start+k]=null; crushed++; }
          }
          start=idx; runVal=v; runLen=1;
        }
      }
      if (runVal && runLen>=3){
        for (let k=0;k<runLen;k++){ board[start+k]=null; crushed++; }
      }
    }

    // cols
    for (let c=0;c<WIDTH;c++){
      let start=c, runVal=board[start], runLen=1;
      for (let r=1;r<WIDTH;r++){
        const idx=r*WIDTH+c, v=board[idx];
        if (v && v===runVal) runLen++;
        else{
          if (runVal && runLen>=3){
            for (let k=0;k<runLen;k++){ board[start+k*WIDTH]=null; crushed++; }
          }
          start=idx; runVal=v; runLen=1;
        }
      }
      if (runVal && runLen>=3){
        for (let k=0;k<runLen;k++){ board[start+k*WIDTH]=null; crushed++; }
      }
    }

    if (crushed>0){
      combo += 1;
      clearedTotal += crushed;
      if (!silent){
        coins += crushed; // bonus
        saveCoins();
      }
    }
    return crushed;
  }

  function dropAndFill(){
    for (let c=0;c<WIDTH;c++){
      let write=(WIDTH-1)*WIDTH + c;
      for (let r=WIDTH-1;r>=0;r--){
        const read=r*WIDTH+c;
        if (board[read]!==null){
          board[write]=board[read];
          if (write!==read) board[read]=null;
          write -= WIDTH;
        }
      }
      for (let r=Math.floor(write/WIDTH); r>=0; r--){
        const idx=r*WIDTH+c;
        if (board[idx]===null) board[idx]=randIcon();
      }
    }
  }

  function resolveChain(){
    const crushed = crushMatches(false);
    if (crushed>0){
      dropAndFill();
      renderTop(); renderMini(); renderGrid();
      setTimeout(resolveChain, 120);
    } else {
      busy=false;
      renderTop(); renderMini(); renderGrid();
    }
  }

  function onCellClick(i){
    if (busy) return;
    if (moves<=0) return;

    if (selected===null){ selected=i; renderGrid(); return; }
    if (selected===i){ selected=null; renderGrid(); return; }
    if (!neighbors(selected,i)){ selected=i; renderGrid(); return; }

    busy=true;
    const a=selected, b=i;
    swap(a,b);

    if (!hasAnyMatch()){
      swap(a,b);
      selected=null;
      busy=false;
      renderTop(); renderMini(); renderGrid();
      return;
    }

    // valid move
    moves -= 1;
    coins += 1; // +1 per move
    saveCoins();
    selected=null;

    combo=0;
    renderTop(); renderMini(); renderGrid();
    setTimeout(resolveChain, 80);
  }

  function initBoard(){
    board = new Array(TOTAL).fill(null).map(() => randIcon());
    selected=null;
    moves=30;
    combo=0;
    clearedTotal=0;

    // clear starting matches
    while (crushMatches(true)>0) dropAndFill();

    renderTop(); renderMini(); renderGrid();
  }

  newGameBtn?.addEventListener("click", initBoard);
  resetCoinsBtn?.addEventListener("click", () => { coins=0; saveCoins(); renderTop(); });

  renderTop(); renderMini();
  initBoard();
});







