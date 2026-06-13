/* =========================
Safari Stay – puzzle.js
- 5x5 match-3 swap neighbors
- Earn coins per match
- Saves coins to ss_coins (shared with hotel)
========================= */

(() => {
  const boardEl = document.getElementById("board");
  if (!boardEl) return; // safety

  const movesEl = document.getElementById("movesLeft");
  const earnedEl = document.getElementById("puzzleEarned");
  const btnNew = document.getElementById("btnPuzzleNew");

  const N = 5;
  const TILES = ["🐚","🐟","🌴","🥥","🌊","☀️"]; // your Mombasa vibe
  let grid = [];
  let selected = null; // {r,c}
  let moves = 20;
  let earned = 0;

  function loadCoins(){
    const v = localStorage.getItem("ss_coins");
    return v==null ? 0 : (Number(v)||0);
  }
function addCoins(x){
  if (typeof ssAddCoins === "function") {
    ssAddCoins(x);
  } else {
    const c = loadCoins() + x;
    localStorage.setItem("ss_coins", String(c));
  }
}
  function randTile(){ return TILES[Math.floor(Math.random()*TILES.length)]; }
  function inb(r,c){ return r>=0 && r<N && c>=0 && c<N; }
  function neigh(a,b){ return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1; }

  function setHud(){
    movesEl.textContent = moves;
    earnedEl.textContent = earned;
  }

  function makeGrid(){
    grid = Array.from({length:N}, () => Array.from({length:N}, randTile));
    // soften immediate matches by re-rolling a bit
    for (let k=0;k<30;k++){
      const matches = findMatches();
      if (matches.size === 0) break;
      for (const key of matches){
        const [r,c] = key.split(",").map(Number);
        grid[r][c] = randTile();
      }
    }
  }

  function render(){
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

    for (let r=0;r<N;r++){
      for (let c=0;c<N;c++){
        const cell = document.createElement("div");
        cell.className = "tile";
        cell.textContent = grid[r][c];
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);

        if (selected && selected.r===r && selected.c===c){
          cell.classList.add("selected");
        }

        cell.addEventListener("click", () => onTile(r,c));
        boardEl.appendChild(cell);
      }
    }
  }

  function swap(a,b){
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }

  function findMatches(){
    const set = new Set();

    // rows
    for (let r=0;r<N;r++){
      let run = 1;
      for (let c=1;c<N;c++){
        if (grid[r][c] === grid[r][c-1]) run++;
        else{
          if (run >= 3){
            for (let k=0;k<run;k++) set.add(`${r},${c-1-k}`);
          }
          run = 1;
        }
      }
      if (run >= 3){
        for (let k=0;k<run;k++) set.add(`${r},${N-1-k}`);
      }
    }

    // cols
    for (let c=0;c<N;c++){
      let run = 1;
      for (let r=1;r<N;r++){
        if (grid[r][c] === grid[r-1][c]) run++;
        else{
          if (run >= 3){
            for (let k=0;k<run;k++) set.add(`${r-1-k},${c}`);
          }
          run = 1;
        }
      }
      if (run >= 3){
        for (let k=0;k<run;k++) set.add(`${N-1-k},${c}`);
      }
    }

    return set;
  }

  function crushAndRefill(matches){
    // remove
    for (const key of matches){
      const [r,c] = key.split(",").map(Number);
      grid[r][c] = null;
    }

    // gravity + refill
    for (let c=0;c<N;c++){
      const col = [];
      for (let r=N-1;r>=0;r--){
        if (grid[r][c] != null) col.push(grid[r][c]);
      }
      while (col.length < N) col.push(randTile());
      for (let r=N-1;r>=0;r--){
        grid[r][c] = col[N-1-r];
      }
    }
  }

  function resolveBoard(){
    let totalCrushed = 0;
    while (true){
      const matches = findMatches();
      if (matches.size === 0) break;
      totalCrushed += matches.size;
      crushAndRefill(matches);
    }
    if (totalCrushed > 0){
      // earn coins: 1 coin per 3 tiles, rounded down
      const gain = Math.floor(totalCrushed / 3);
      earned += gain;
      addCoins(gain);
    }
  }

  function onTile(r,c){
    if (moves <= 0) return;

    const pos = {r,c};

    if (!selected){
      selected = pos;
      render();
      return;
    }

    if (selected.r === r && selected.c === c){
      selected = null;
      render();
      return;
    }

    if (!neigh(selected, pos)){
      selected = pos;
      render();
      return;
    }

    // attempt swap
    swap(selected, pos);
    const matchesAfter = findMatches();
    if (matchesAfter.size === 0){
      // invalid move: swap back
      swap(selected, pos);
      selected = null;
      render();
      return;
    }

    // valid
    moves -= 1;
    selected = null;

    // resolve cascades
    resolveBoard();
    setHud();
    render();
  }

  function resetPuzzle(){
    moves = 20;
    earned = 0;
    selected = null;
    makeGrid();
    setHud();
    render();
  }

  btnNew?.addEventListener("click", resetPuzzle);

  resetPuzzle();
})();
