import { elements } from './elements.js';

export async function searchAPI(queryData) {
    elements.resultsContainer.innerHTML = '<p>Searching...</p>';
    
    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queryData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Search failed:', error);
        elements.resultsContainer.innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
        return [];
    }
}
