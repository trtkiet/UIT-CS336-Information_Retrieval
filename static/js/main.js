import { elements } from "./elements.js";
import { initFilters, getObjectQueries } from "./filters.js";
import { searchAPI, loginAPI } from "./api.js";
import { displayResults } from "./results.js";
import { initVideoModal } from "./video-player.js";

let currentResults = [];

document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI Logic
  initFilters();
  initVideoModal();

  // --- XỬ LÝ LOGIN ---
  if (elements.loginBtn) {
    elements.loginBtn.addEventListener("click", async () => {
      elements.loginBtn.textContent = "Logging in...";
      try {
        const data = await loginAPI();
        // Lưu vào Local Storage
        localStorage.setItem("sessionId", data.sessionId);
        localStorage.setItem("evaluationId", data.evaluationId);

        alert(
          `Login Successful!\nSession: ${data.sessionId}\nEval ID: ${data.evaluationId}`,
        );
      } catch (error) {
        alert(`Login Failed: ${error.message}`);
        elements.loginBtn.textContent = "Login failed";
        elements.loginBtn.style.background = "#dc3545";
      }
      elements.loginBtn.textContent = "Login";
    });
  }

  // 1. Search Handler
  elements.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(elements.searchForm);

    const queryData = {
      description: formData.get("description"),
      objects: getObjectQueries(),
      audio: formData.get("audio"),
    };

    const results = await searchAPI(queryData);
    currentResults = results;
    displayResults(currentResults);
  });

  // 2. Scroll to Top Logic
  const scrollTopBtn = document.getElementById("scroll-top-btn");

  // Function to perform immediate scroll
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "instant", // Immediate jump as requested
    });
  };

  // Button Click Event
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToTop();
      // Blur button so space key doesn't re-trigger click immediately
      scrollTopBtn.blur();
    });
  }
});
