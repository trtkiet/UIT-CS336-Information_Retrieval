export const elements = {
  searchForm: document.getElementById("search-form"),
  toggleFiltersBtn: document.getElementById("toggle-filters-btn"),
  advancedFilters: document.getElementById("advanced-filters"),

  // Object Filter Inputs
  addObjectBtn: document.getElementById("add-object-btn"),
  objectList: document.getElementById("object-list"),
  objectSelect: document.getElementById("object-select"),
  objectMin: document.getElementById("object-min"),
  objectMax: document.getElementById("object-max"),
  objectConfidence: document.getElementById("object-confidence"),

  loginBtn: document.getElementById("login-btn"),

  // Modal Submit
  modalSubmitBtn: document.getElementById("modal-submit-btn"),

  // Results & Controls
  resultsContainer: document.getElementById("results-container"),
  // sortBySelect: Removed from HTML, so removing reference here prevents errors if accessed
  sortBySelect: { value: "clip_score" }, // Mock object to keep result.js working without refactor

  // Modal
  modalOverlay: document.getElementById("video-modal"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  modalVideoPlayer: document.getElementById("modal-video-player"),
  modalVideoTitle: document.getElementById("modal-video-title"),
  modalContent: document.querySelector(".modal-content"),
};
