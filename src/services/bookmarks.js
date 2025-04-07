/* 
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

import { map } from '../components/map.js';
import { notifySreenReader } from '../utils/accessibility.js';
import { successSound } from '../utils/sounds.js';

const BOOKMARKS_KEY = 'map_bookmarks';

// Get bookmarks from localStorage
export function getBookmarks() {
    const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
    return bookmarks ? JSON.parse(bookmarks) : [];
}

// Add a bookmark
export function addBookmark(name, lat, lng) {
    const bookmarks = getBookmarks();
    // Check if bookmark already exists
    if (!bookmarks.some(b => b.lat === lat && b.lng === lng)) {
        bookmarks.unshift({ name, lat, lng });
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
        successSound.play();
        notifySreenReader('Location bookmarked');
        return true;
    }
    return false;
}

// Remove a bookmark
export function removeBookmark(lat, lng) {
    const bookmarks = getBookmarks();
    const filteredBookmarks = bookmarks.filter(b => b.lat !== lat || b.lng !== lng);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filteredBookmarks));
    successSound.play();
    notifySreenReader('Bookmark removed');
}

// Navigate to a bookmarked location
export function navigateToBookmark(lat, lng) {
    map.setView([lat, lng], 13);
    successSound.play();
    notifySreenReader('Navigated to bookmarked location');
}

// Create a bookmark list item element
export function createBookmarkListItem(bookmark, onNavigate, onDelete) {
    const listItem = document.createElement('li');
    listItem.className = 'bookmark-item';
    listItem.innerHTML = `
        <span class="bookmark-name" title="${bookmark.name}">
            <i class="fas fa-bookmark"></i>
            ${bookmark.name}
        </span>
        <div class="bookmark-actions">
            <button class="navigate-btn" aria-label="Navigate to ${bookmark.name}">
                <i class="fas fa-map-marker-alt"></i>
            </button>
            <button class="delete-btn" aria-label="Remove bookmark for ${bookmark.name}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Add event listeners
    listItem.querySelector('.navigate-btn').addEventListener('click', onNavigate);
    listItem.querySelector('.delete-btn').addEventListener('click', onDelete);

    return listItem;
} 