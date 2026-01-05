// ===== HOTSPOT SELECTION + DEBUG =====
let selectedSpot = null;

const hint = document.getElementById("hint");
const debugToggle = document.getElementById("debugHotspots");
const scene = document.querySelector(".scene");

function clearSelected(){
  document.querySelectorAll(".hotspot").forEach(b => b.classList.remove("selected"));
  selectedSpot = null;
}

document.querySelectorAll(".hotspot").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    clearSelected();
    btn.classList.add("selected");
    selectedSpot = btn.dataset.spot;

    hint.textContent = `Selected: ${selectedSpot}`;
    console.log("Clicked:", selectedSpot);
  });
});

debugToggle?.addEventListener("change", () => {
  scene?.classList.toggle("debug", debugToggle.checked);
});

// Buttons (placeholders for now)
document.getElementById("btnSpawn")?.addEventListener("click", () => {
  hint.textContent = "Spawn guest (next step).";
});

document.getElementById("btnDeliver")?.addEventListener("click", () => {
  hint.textContent = selectedSpot ? `Deliver → ${selectedSpot}` : "Select a door first.";
});

document.getElementById("btnClean")?.addEventListener("click", () => {
  hint.textContent = selectedSpot ? `Clean → ${selectedSpot}` : "Select a door first.";
});

