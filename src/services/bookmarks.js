/* 
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

import { map } from '../components/map.js';
import { notifySreenReader } from '../utils/accessibility.js';
import { successSound } from '../utils/sounds.js';
import { geocodingAPI, headerofNominatim } from "../utils/to-km-or-meter.js";
import { showPlaceDetails } from './fetch-place.js';

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
export async function navigateToBookmark(lat, lng) {
    const zoom = map.getZoom(); // Get current zoom level
    map.setView([lat, lng], zoom);
    updateUrl(lat, lng, zoom); // Update browser URL
    
    // Perform reverse geocoding to get place details
    try {
        const response = await fetch(
            `${geocodingAPI}/reverse?lat=${lat}&lon=${lng}&zoom=18&format=jsonv2`,
            headerofNominatim
        );
        
        if (response.ok) {
            const data = await response.json();
            // Show place details
            showPlaceDetails(data);
        }
        
        successSound.play();
        notifySreenReader('Navigated to bookmarked location');
    } catch (error) {
        console.error("Error fetching location details:", error);
        notifySreenReader('Navigated to bookmarked location, but could not load details');
    }
}

// Generate shareable URL
function generateShareUrl(lat, lng, zoom) {
    const url = new URL(window.location.href);
    url.searchParams.set('lat', lat.toFixed(5));
    url.searchParams.set('lng', lng.toFixed(5));
    url.searchParams.set('zoom', zoom);
    return url.toString();
}

// Update browser URL without reloading
function updateUrl(lat, lng, zoom) {
    const shareUrl = generateShareUrl(lat, lng, zoom);
    window.history.pushState({ path: shareUrl }, '', shareUrl);
}

// Copy URL to clipboard
async function copyUrlToClipboard(lat, lng, zoom, buttonElement) {
    const shareUrl = generateShareUrl(lat, lng, zoom);
    try {
        await navigator.clipboard.writeText(shareUrl);
        notifySreenReader('Link copied to clipboard');
        // Optional: Provide visual feedback on the button
        const originalIcon = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            buttonElement.innerHTML = originalIcon;
        }, 1500);
    } catch (err) {
        console.error('Failed to copy URL: ', err);
        notifySreenReader('Failed to copy link');
    }
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
            <button class="share-btn" aria-label="Copy link for ${bookmark.name}">
                <i class="fas fa-share-alt"></i>
            </button>
            <button class="delete-btn" aria-label="Remove bookmark for ${bookmark.name}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Add event listeners
    listItem.querySelector('.navigate-btn').addEventListener('click', onNavigate);
    listItem.querySelector('.delete-btn').addEventListener('click', onDelete);
    listItem.querySelector('.share-btn').addEventListener('click', (e) => {
        const zoom = map.getZoom();
        copyUrlToClipboard(bookmark.lat, bookmark.lng, zoom, e.currentTarget);
    });

    return listItem;
} 