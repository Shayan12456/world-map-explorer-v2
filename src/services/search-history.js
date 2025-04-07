/* 
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

const HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 5;

// Get search history from localStorage
export function getSearchHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

// Add a search query to history
export function addToSearchHistory(query) {
    if (!query || query.trim().length <= 2) return;
    
    const history = getSearchHistory();
    const trimmedQuery = query.trim();
    
    // Remove the query if it already exists (to avoid duplicates)
    const filteredHistory = history.filter(item => item.toLowerCase() !== trimmedQuery.toLowerCase());
    
    // Add new query to the beginning
    filteredHistory.unshift(trimmedQuery);
    
    // Keep only the most recent MAX_HISTORY_ITEMS
    while (filteredHistory.length > MAX_HISTORY_ITEMS) {
        filteredHistory.pop();
    }
    
    // Save to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filteredHistory));
}

// Clear search history
export function clearSearchHistory() {
    localStorage.removeItem(HISTORY_KEY);
}

// Create a history list item element
export function createHistoryListItem(query, onClick) {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
        <span style="color: grey; display: flex;"><i class="fas fa-history"></i>&nbsp;</span>
        ${query}`;
    listItem.setAttribute('aria-label', `Recent search: ${query}`);
    listItem.tabIndex = 1;
    listItem.addEventListener('click', () => onClick(query));
    return listItem;
} 