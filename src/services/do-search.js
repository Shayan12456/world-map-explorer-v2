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

var placeIds = [];

let searchLoadingInterval; // To store the interval globally for cancellation

// Initialize search input event listeners
export function initializeSearchInput() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
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
function addNoResultsMessage(container) {
  const noResultsItem = document.createElement("li");
  noResultsItem.textContent = "No results found";
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
  listItem.innerHTML = `
    <span style="color: grey; display: flex;">${result.type}&nbsp</span>
    ${result.display_name}`;
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
