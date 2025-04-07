/* 
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
  */
import { notifyLoading, notifySreenReader } from "../utils/accessibility.js";
import { keyboardselect } from "../utils/keydown-helpers.js";
import { successSound } from "../utils/sounds.js";
import { geocodingAPI, headerofNominatim } from "../utils/to-km-or-meter.js";
import { getSearchHistory, addToSearchHistory, createHistoryListItem } from "./search-history.js";
import { getBookmarks, addBookmark, removeBookmark, navigateToBookmark, createBookmarkListItem } from "./bookmarks.js";

var placeIds = [];

let searchLoadingInterval; // To store the interval globally for cancellation

// Initialize search input event listeners
export function initializeSearchInput() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    // Add bookmarks button
    const bookmarksBtn = document.createElement('button');
    bookmarksBtn.id = 'bookmarks-btn';
    bookmarksBtn.className = 'action-btn';
    bookmarksBtn.innerHTML = '<i class="fas fa-bookmark"></i> Bookmarks';
    bookmarksBtn.setAttribute('aria-label', 'Show bookmarks');
    searchInput.parentElement.parentNode.insertBefore(bookmarksBtn, searchInput.parentElement.nextSibling);

    // Add event listeners
    bookmarksBtn.addEventListener('click', () => {
      const container = initializeResultsContainer(searchInput);
      showBookmarks(container);
    });

    searchInput.addEventListener('focus', () => {
      const query = searchInput.value.trim();
      if (query.length <= 2) {
        showSearchHistory(initializeResultsContainer(searchInput), searchInput);
      }
    });

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (query.length <= 2) {
        showSearchHistory(initializeResultsContainer(searchInput), searchInput);
      }
    });
  }
}

export function performSearch(inputField, excludedPlaceIds = []) {
  removeResults(); // Clear the previous search results
  //function to search places and show the suggestions
  return new Promise((resolve, reject) => {
    const query = inputField.value.trim();
    const loadingMessage = `<li style="justify-content: center;"><i class="fas fa-circle-notch fa-spin"></i></li>`;

    // Initialize the search results container
    let resultsContainer = initializeResultsContainer(inputField);

    // If query is empty or too short, show search history
    if (query.length <= 2) {
      showSearchHistory(resultsContainer, inputField, resolve);
      return;
    }

    // Display loading indicator
    resultsContainer.innerHTML = loadingMessage;
    searchLoadingInterval && clearInterval(searchLoadingInterval);
    searchLoadingInterval = setInterval(() => {
      notifyLoading();
    }, 2000);

    fetchSearchResults(query, excludedPlaceIds)
      .then((data) => {
        clearInterval(searchLoadingInterval);
        renderSearchResults(data, resultsContainer, inputField, resolve);
        if (data.length > 0) {
          addToSearchHistory(query); // Add to history if results were found
        }
      })
      .catch((error) => {
        clearInterval(searchLoadingInterval);
        console.error("Error fetching search results:", error);
        reject(error);
      });
  });
}

// Show search history in the results container
function showSearchHistory(container, inputField, resolve) {
  const history = getSearchHistory();
  container.innerHTML = "";

  if (history.length === 0) {
    addNoResultsMessage(container);
    return;
  }

  // Add a header for search history
  const headerItem = document.createElement("li");
  headerItem.innerHTML = `<span style="color: #666; font-weight: bold;">Recent Searches</span>`;
  headerItem.style.backgroundColor = "transparent";
  headerItem.style.cursor = "default";
  container.appendChild(headerItem);

  history.forEach(query => {
    const historyItem = createHistoryListItem(query, (selectedQuery) => {
      inputField.value = selectedQuery;
      if (resolve) {
        performSearch(inputField, []).then(resolve);
      } else {
        performSearch(inputField, []);
      }
    });
    container.appendChild(historyItem);
  });
}

// Show bookmarks in the results container
function showBookmarks(container) {
  const bookmarks = getBookmarks();
  container.innerHTML = "";

  if (bookmarks.length === 0) {
    addNoResultsMessage(container, "No bookmarks saved");
    return;
  }

  // Add header
  const headerItem = document.createElement("li");
  headerItem.innerHTML = `<span style="color: #666; font-weight: bold;">Saved Places</span>`;
  headerItem.style.backgroundColor = "transparent";
  headerItem.style.cursor = "default";
  container.appendChild(headerItem);

  // Add bookmarks
  bookmarks.forEach(bookmark => {
    const bookmarkItem = createBookmarkListItem(
      bookmark,
      async () => {
        // Show loading indicator
        container.innerHTML = `<li style="justify-content: center;"><i class="fas fa-circle-notch fa-spin"></i></li>`;
        
        // Navigate to the bookmark (this will also show place details)
        await navigateToBookmark(bookmark.lat, bookmark.lng);
        
        // Close the results container
        removeResults();
      },
      () => {
        removeBookmark(bookmark.lat, bookmark.lng);
        showBookmarks(container); // Refresh the list
      }
    );
    container.appendChild(bookmarkItem);
  });
}

// Clears the search results and associated event listeners
function clearSearchResults(searchResults) {
  if (searchResults) {
    searchResults.parentElement?.removeEventListener("keydown", keyboardselect);
    searchResults.remove();
  }
}

// Initializes the search results container
function initializeResultsContainer(inputField) {
  // First, remove any existing search results containers
  const existingContainers = document.querySelectorAll('#search-results');
  existingContainers.forEach(container => {
    container.parentElement?.removeEventListener("keydown", keyboardselect);
    container.remove();
  });

  // Create new container
  const container = document.createElement("ul");
  container.id = "search-results";
  container.tabIndex = 7;
  container.setAttribute("aria-label", "Select your result");
  inputField.parentElement.parentNode.insertBefore(
    container,
    inputField.parentNode.nextSibling
  );
  
  container.parentElement.addEventListener("keydown", keyboardselect);
  return container;
}

// Fetches search results from the API
function fetchSearchResults(query, excludedPlaceIds) {
  const url = `${geocodingAPI}/search.php?q=${encodeURIComponent(
    query
  )}&format=jsonv2&exclude_place_ids=${encodeURIComponent(excludedPlaceIds)}`;

  return fetch(url,headerofNominatim).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });
}

// Renders search results in the results container
function renderSearchResults(data, container, inputField, resolve) {
  successSound.play();
  notifySreenReader("Select from result");
  container.innerHTML = "";

  if (data.length === 0) {
    addNoResultsMessage(container);
    return;
  }

  let currentPlaceIds = data.map((result, index) => {
    const listItem = createResultListItem(result, () => resolve(result));
    container.appendChild(listItem);
    return result.place_id;
  });
  placeIds = placeIds.concat(currentPlaceIds);

  addMoreResultsOption(container, inputField, placeIds, resolve);
}

// Adds a "No Results Found" message
function addNoResultsMessage(container, message = "No results found") {
  const noResultsItem = document.createElement("li");
  noResultsItem.textContent = message;
  container.appendChild(noResultsItem);
}

// Adds a "More Results" option
function addMoreResultsOption(container, inputField, placeIds, resolve) {
  const moreResultsItem = document.createElement("li");
  moreResultsItem.textContent = "More results";
  moreResultsItem.tabIndex = 1;
  moreResultsItem.addEventListener("click", () => {
  removeResults();
    performSearch(inputField, placeIds).then(resolve);
    inputField.focus();
    container.scrollTop = 0;
  });
  container.appendChild(moreResultsItem);
}

// Creates a search result list item
function createResultListItem(result, onClick) {
  const listItem = document.createElement("li");
  
  // Create bookmark button
  const bookmarkBtn = document.createElement("button");
  bookmarkBtn.className = "bookmark-btn";
  bookmarkBtn.innerHTML = '<i class="far fa-star"></i>';
  bookmarkBtn.setAttribute("aria-label", `Bookmark ${result.display_name}`);
  
  // Add bookmark functionality
  bookmarkBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent triggering the list item click
    const success = addBookmark(result.display_name, parseFloat(result.lat), parseFloat(result.lon));
    if (success) {
      bookmarkBtn.innerHTML = '<i class="fas fa-star"></i>';
      bookmarkBtn.classList.add("active");
    }
  });

  // Check if already bookmarked
  const bookmarks = getBookmarks();
  if (bookmarks.some(b => b.lat === parseFloat(result.lat) && b.lng === parseFloat(result.lon))) {
    bookmarkBtn.innerHTML = '<i class="fas fa-star"></i>';
    bookmarkBtn.classList.add("active");
  }

  listItem.innerHTML = `
    <div class="result-content">
      <span style="color: grey; display: flex;">${result.type}&nbsp</span>
      ${result.display_name}
    </div>`;
  
  listItem.insertBefore(bookmarkBtn, listItem.firstChild);
  listItem.setAttribute("aria-label", result.display_name);
  listItem.tabIndex = 1;
  listItem.addEventListener("click", onClick);
  return listItem;
}

export function removeResults(){
  clearInterval(searchLoadingInterval);
  if(document.getElementById("search-results")){
    document.getElementById("search-results")?.parentElement?.removeEventListener('keydown', keyboardselect)
    document.getElementById("search-results")?.remove();
  }
}
