function getCoins() {
  return Number(localStorage.getItem("coins")) || 0;
}

function setCoins(n) {
  localStorage.setItem("coins", String(n));
}

function renderCoins() {
  const el = document.getElementById("coins");
  if (el) el.textContent = getCoins();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCoins();

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("Reset coins + Mombasa progress?")) return;
      localStorage.removeItem("coins");
      localStorage.removeItem("mombasaRooms");
      localStorage.removeItem("mombasaCleaner");
      localStorage.removeItem("mombasaBellboy");
      localStorage.removeItem("mombasaQueue");
      localStorage.removeItem("mombasaGuestsServed");
      renderCoins();
      alert("Reset done ✅");
    });
  }
});

