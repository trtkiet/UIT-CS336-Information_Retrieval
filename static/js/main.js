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

    // Search Handler
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

    // Re-render on sort change
    elements.sortBySelect.addEventListener('change', () => {
        // Logic for client-side sorting could be added here if needed
        // For now, it just re-renders the existing list to update the visual highlighting
        displayResults(currentResults);
    });
});
