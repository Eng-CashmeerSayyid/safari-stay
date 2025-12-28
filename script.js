/* ================================
   SAFARI STAY – PUZZLE ENGINE
   Every move (swap) = +1 coin
   ================================ */

const WIDTH = 8;
const TOTAL = WIDTH * WIDTH;
const ITEMS = ["🍓", "🥥", "🌴", "🐚", "⭐", "🍍"];
const START_MOVES = 30;

// State
let board = [];
let selectedIndex = null;
let isBusy = false;

let moves = START_MOVES;
let coins = Number(localStorage.getItem("coins")) || 0;

// Elements
const grid = document.getElementById("grid");
const movesEl = document.getElementById("moves");
const coinsEl = document.getElementById("coins");

// Buttons
const newGameBtn = document.getElementById("newGameBtn");
const resetCoinsBtn = document.getElementById("resetCoinsBtn");

function randomItem() {
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function updateUI() {
  movesEl.textContent = moves;
  coinsEl.textContent = coins;
  localStorage.setItem("coins", String(coins));
}

function render() {
  for (let i = 0; i < TOTAL; i++) {
    grid.children[i].textContent = board[i];
  }
}

function clearHighlights() {
  document.querySelectorAll(".cell").forEach(c => c.classList.remove("selected"));
}

function highlight(index) {
  clearHighlights();
  grid.children[index].classList.add("selected");
}

function isAdjacent(a, b) {
  const rowA = Math.floor(a / WIDTH);
  const rowB = Math.floor(b / WIDTH);

  return (
    (a === b - 1 && rowA === rowB) ||
    (a === b + 1 && rowA === rowB) ||
    a === b - WIDTH ||
    a === b + WIDTH
  );
}

function handleClick(index) {
  if (isBusy || moves <= 0) return;

  if (selectedIndex === null) {
    selectedIndex = index;
    highlight(index);
    return;
  }

  // second click
  if (!isAdjacent(selectedIndex, index)) {
    selectedIndex = index;
    highlight(index);
    return;
  }

  // do swap
  swap(selectedIndex, index);
  selectedIndex = null;
  clearHighlights();
}

function swap(a, b) {
  isBusy = true;

  [board[a], board[b]] = [board[b], board[a]];
  render();

  // ✅ coin per move
  moves--;
  coins++;
  updateUI();

  setTimeout(() => {
    const matched = removeMatches();

    if (!matched) {
      // swap back (no match)
      [board[a], board[b]] = [board[b], board[a]];
      render();
    }

    isBusy = false;
  }, 250);
}

// Remove matches of 3+ (basic, stable)
function removeMatches() {
  let found = false;

  // rows
  for (let i = 0; i < TOTAL; i++) {
    if (i % WIDTH > WIDTH - 3) continue;

    const a = i, b = i + 1, c = i + 2;
    const v = board[a];
    if (v && board[b] === v && board[c] === v) {
      board[a] = ""; board[b] = ""; board[c] = "";
      found = true;
    }
  }

  // cols
  for (let i = 0; i < TOTAL - WIDTH * 2; i++) {
    const a = i, b = i + WIDTH, c = i + WIDTH * 2;
    const v = board[a];
    if (v && board[b] === v && board[c] === v) {
      board[a] = ""; board[b] = ""; board[c] = "";
      found = true;
    }
  }

  if (found) {
    setTimeout(dropItems, 180);
  }
  return found;
}

function dropItems() {
  // Fill blanks with new items (simple + reliable)
  for (let i = 0; i < TOTAL; i++) {
    if (board[i] === "") board[i] = randomItem();
  }

  render();

  // chain reactions
  setTimeout(() => {
    removeMatches();
  }, 180);
}

function buildBoard() {
  grid.innerHTML = "";
  board = [];
  selectedIndex = null;
  isBusy = false;
  moves = START_MOVES;

  for (let i = 0; i < TOTAL; i++) {
    board.push(randomItem());

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.addEventListener("click", () => handleClick(i));
    grid.appendChild(cell);
  }

  render();
  updateUI();

  // clear any starting matches
  removeMatches();
}

/* Buttons */
newGameBtn.addEventListener("click", () => {
  buildBoard();
});

resetCoinsBtn.addEventListener("click", () => {
  coins = 0;
  localStorage.setItem("coins", "0");
  updateUI();
  alert("Coins reset to 0 ✅");
});

/* Start */
buildBoard();


