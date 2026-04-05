// main.js
// This file is intentionally simple because the project is mostly HTML + CSS + Flask.
// Still, this gives room for small animations and interactions later.

// ------------------------------
// Fade-in animation for cards
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add("show");
        }, index * 120);
    });
});

// ------------------------------
// Smooth scroll for internal links
// ------------------------------
document.querySelectorAll("a[href^='#']").forEach(anchor => {
    anchor.addEventListener("click", function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
            target.scrollIntoView({ behavior: "smooth" });
        }
    });
});

// ------------------------------
// Cute console message (optional)
// ------------------------------
console.log("%cWelcome to Plantify 🌿✨", "color:#22c55e; font-size: 16px;");
