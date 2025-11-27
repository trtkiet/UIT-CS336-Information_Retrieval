import { elements } from './elements.js';
import { initFilters, getObjectQueries } from './filters.js';
import { searchAPI } from './api.js';
import { displayResults } from './results.js';
import { initVideoModal } from './video-player.js';

let currentResults = [];

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI Logic
    initFilters();
    initVideoModal();

    // 1. Search Handler
    elements.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(elements.searchForm);
        
        const queryData = {
            description: formData.get('description'),
            objects: getObjectQueries(),
            audio: formData.get('audio')
        };

        const results = await searchAPI(queryData);
        currentResults = results;
        displayResults(currentResults);
    });

    // 2. Scroll to Top Logic
    const scrollTopBtn = document.getElementById('scroll-top-btn');

    // Function to perform immediate scroll
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'instant' // Immediate jump as requested
        });
    };

    // Button Click Event
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToTop();
            // Blur button so space key doesn't re-trigger click immediately
            scrollTopBtn.blur();
        });
    }
});

