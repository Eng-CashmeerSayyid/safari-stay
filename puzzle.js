// ===============================
// puzzle.js (Match-3 5x5)
// Coins shared via ssAddCoins()
// ===============================

(function(){
  const SIZE = 5;
  const ITEMS = ["🍓","🥥","🌴","🐚","⭐","🍍","🐠"]; // feel free to change

  let board = []; // numbers 0..ITEMS-1
  let selected = null;
  let moves = 20;
  let puzzleCoins = 0;

  function el(id){ return document.getElementById(id); }

  function randItem(){
    return Math.floor(Math.random() * ITEMS.length);
  }

  function idx(r,c){ return r*SIZE + c; }

  function neighbors(a,b){
    const ra = Math.floor(a/SIZE), ca = a%SIZE;
    const rb = Math.floor(b/SIZE), cb = b%SIZE;
    return (Math.abs(ra-rb)+Math.abs(ca-cb)) === 1;
  }

  function render(){
    const boardEl = el("board");
    if (!boardEl) return;

    boardEl.innerHTML = "";
    for (let i=0;i<SIZE*SIZE;i++){
      const t = document.createElement("div");
      t.className = "tile";
      t.dataset.i = String(i);
      t.textContent = ITEMS[board[i]];
      if (selected === i) t.classList.add("selected");
      t.addEventListener("click", onTileClick);
      boardEl.appendChild(t);
    }

    const m = el("pMoves"); if (m) m.textContent = String(moves);
    const pc = el("pCoins"); if (pc) pc.textContent = String(puzzleCoins);
  }

  function makeBoardNoInstantMatches(){
    board = new Array(SIZE*SIZE).fill(0).map(()=>randItem());
    // re-roll if there are existing matches at start
    let guard = 0;
    while (findMatches().length > 0 && guard < 200){
      for (const m of findMatches()){
        for (const i of m.cells){
          board[i] = randItem();
        }
      }
      guard++;
    }
  }

  function findMatches(){
    const matches = [];

    // rows
    for (let r=0;r<SIZE;r++){
      let runStart = idx(r,0);
      let runVal = board[runStart];
      let runLen = 1;

      for (let c=1;c<SIZE;c++){
        const i = idx(r,c);
        if (board[i] === runVal){
          runLen++;
        } else {
          if (runLen >= 3){
            const cells = [];
            for (let k=0;k<runLen;k++) cells.push(idx(r, c-1-k));
            matches.push({cells});
          }
          runStart = i;
          runVal = board[i];
          runLen = 1;
        }
      }
      if (runLen >= 3){
        const cells = [];
        for (let k=0;k<runLen;k++) cells.push(idx(r, SIZE-1-k));
        matches.push({cells});
      }
    }

    // cols
    for (let c=0;c<SIZE;c++){
      let runStart = idx(0,c);
      let runVal = board[runStart];
      let runLen = 1;

      for (let r=1;r<SIZE;r++){
        const i = idx(r,c);
        if (board[i] === runVal){
          runLen++;
        } else {
          if (runLen >= 3){
            const cells = [];
            for (let k=0;k<runLen;k++) cells.push(idx(r-1-k, c));
            matches.push({cells});
          }
          runStart = i;
          runVal = board[i];
          runLen = 1;
        }
      }
      if (runLen >= 3){
        const cells = [];
        for (let k=0;k<runLen;k++) cells.push(idx(SIZE-1-k, c));
        matches.push({cells});
      }
    }

    // merge overlaps
    const set = new Set();
    const merged = [];
    for (const m of matches){
      const unique = [];
      for (const c of m.cells){
        if (!set.has(c)){
          unique.push(c);
          set.add(c);
        }
      }
      if (unique.length) merged.push({cells: unique});
    }
    return merged;
  }

  function swap(a,b){
    const tmp = board[a];
    board[a] = board[b];
    board[b] = tmp;
  }

  function animateCrush(cells){
    const boardEl = el("board");
    if (!boardEl) return;
    for (const i of cells){
      const tile = boardEl.querySelector(`.tile[data-i="${i}"]`);
      if (tile) tile.classList.add("crush");
    }
  }

  function collapseAndRefill(cells){
    const empty = new Set(cells);

    // set to -1
    for (const i of empty) board[i] = -1;

    // drop down per column
    for (let c=0;c<SIZE;c++){
      const col = [];
      for (let r=SIZE-1;r>=0;r--){
        const i = idx(r,c);
        if (board[i] !== -1) col.push(board[i]);
      }
      while (col.length < SIZE) col.push(randItem());
      // write back bottom->top
      for (let r=SIZE-1, k=0;r>=0;r--,k++){
        board[idx(r,c)] = col[k];
      }
    }
  }

  function shakeBoard(){
    const boardEl = el("board");
    if (!boardEl) return;
    boardEl.classList.remove("shake");
    void boardEl.offsetWidth;
    boardEl.classList.add("shake");
  }

  function resolveMatchesCascade(){
    let any = false;
    let loopGuard = 0;

    while (loopGuard < 10){
      const matches = findMatches();
      if (matches.length === 0) break;
      any = true;

      // flatten cells
      const cells = [...new Set(matches.flatMap(m=>m.cells))];

      // coins: +1 per 3 tiles cleared (min 1)
      const gained = Math.max(1, Math.floor(cells.length / 3));
      puzzleCoins += gained;
      ssAddCoins(gained);

      // crush animation
      animateCrush(cells);

      // wait a bit then collapse
      // (sync feel: simple timeout)
      // eslint-disable-next-line no-loop-func
      setTimeout(() => {
        collapseAndRefill(cells);
        render();
      }, 140);

      // do immediate collapse for logic; UI updates after timeout
      collapseAndRefill(cells);
      loopGuard++;
    }

    return any;
  }

  function onTileClick(e){
    if (moves <= 0) return;

    const i = Number(e.currentTarget.dataset.i);
    if (selected === null){
      selected = i;
      render();
      return;
    }

    if (selected === i){
      selected = null;
      render();
      return;
    }

    if (!neighbors(selected, i)){
      // not adjacent
      selected = i;
      render();
      return;
    }

    // attempt swap
    swap(selected, i);

    const hasMatch = findMatches().length > 0;
    if (!hasMatch){
      // invalid move, swap back + shake
      swap(selected, i);
      shakeBoard();
      selected = null;
      render();
      return;
    }

    // valid move: -1 move, +1 coin baseline
    moves--;
    puzzleCoins += 1;
    ssAddCoins(1);

    selected = null;
    render();

    // resolve cascades
    resolveMatchesCascade();
  }

  function resetPuzzle(){
    moves = 20;
    puzzleCoins = 0;
    selected = null;
    makeBoardNoInstantMatches();
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const boardEl = el("board");
    if (!boardEl) return; // not on this page
    resetPuzzle();

    const btn = el("pReset");
    if (btn) btn.addEventListener("click", resetPuzzle);
  });
})();
