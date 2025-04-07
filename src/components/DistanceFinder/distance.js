/*
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

import { geoLayer, showPlaceDetails } from "../../services/fetch-place.js";
import { performSearch, removeResults } from "../../services/do-search.js";
import { geocodingAPI, headerofNominatim, toKMorMeter } from "../../utils/to-km-or-meter.js";
import { closeSound } from "../../utils/sounds.js";
import { FOSSGISValhallaEngine } from "./FOSSGISValhallaEngine.js";

import { detailsCloseButton, detalisElement, distanceBox, distanceIcon } from "../../utils/dom-elements.js";
import { successSound } from "../../utils/sounds.js";
import { adjustablePointer } from "../Marker/adjustable-pointer.js";
import Marker from "../Marker/marker.js";
import { notifySreenReader } from "../../utils/accessibility.js";
import { map } from '../map.js';

// Tracks the currently focused input element (starting or destination location)
let activeInputElement = null;
// Button to trigger distance calculation
const findDistanceButton = document.getElementById("find");
// Element for user input of the starting location
let startingLocationElement = document.getElementById("beginning");  
// Element for user input of the destination location
let destinationLocationElement = document.getElementById("destination");
// Element to display the distance result
const distanceResultElement = document.getElementById("distanceResult");
// Button to copy the route link
const copyRouteLinkButton = document.getElementById("copy-route-link-btn");

// Coordinates for the destination
let destinationCoordinates;
// Coordinates for the starting location
let startingCoordinates;
// Layer group to represent the road path on the map
let roadPathLayerGroup;

// --- URL Handling --- 

// Generate shareable route URL using place names
function generateRouteShareUrl(fromName, toName) {
    if (!fromName || !toName) return null;
  
    const url = new URL(window.location.href);
    url.searchParams.set('from', fromName); // no need to encode
    url.searchParams.set('to', toName);
  
    // Remove unnecessary params
    ['lat', 'lng', 'zoom', 'fromLat', 'fromLng', 'toLat', 'toLng'].forEach(param =>
      url.searchParams.delete(param)
    );
  
    return url.toString();
  }
  

// Update browser URL with route parameters using place names
function updateRouteUrl() {
    const fromName = startingLocationElement.value;
    const toName = destinationLocationElement.value;
    const shareUrl = generateRouteShareUrl(fromName, toName);
    if (shareUrl) {
        window.history.pushState({ path: shareUrl }, '', shareUrl);
    }
}

// Geocode location name to get coordinates and display name
async function geocodeLocationByName(locationName) {
    if (!locationName) return null;
    try {
        const url = `${geocodingAPI}/search.php?q=${encodeURIComponent(locationName)}&format=jsonv2&limit=1`;
        const response = await fetch(url, headerofNominatim);
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                const bestResult = data[0];
                return {
                    lat: parseFloat(bestResult.lat),
                    lon: parseFloat(bestResult.lon),
                    name: bestResult.display_name // Use the display name from Nominatim
                };
            }
        }
    } catch (error) {
        console.error(`Geocoding failed for ${locationName}:`, error);
    }
    notifySreenReader(`Could not find coordinates for ${locationName}`);
    return null; // Indicate failure
}

// Perform reverse geocoding for a coordinate
async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(
            `${geocodingAPI}/reverse?lat=${lat}&lon=${lon}&zoom=18&format=jsonv2`,
            headerofNominatim
        );
        if (response.ok) {
            const data = await response.json();
            return data.display_name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
        }
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
    }
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`; // Fallback name
}

// Check URL parameters on load and initiate route calculation if present
async function checkRouteUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromName = urlParams.get('from');
    const toName = urlParams.get('to');

    if (fromName && toName) {
        const decodedFromName = decodeURIComponent(fromName);
        const decodedToName = decodeURIComponent(toName);

        // Show the distance finder box
        distanceBox.style.display = "block";
        startingLocationElement.value = decodedFromName;
        destinationLocationElement.value = decodedToName;
        notifySreenReader(`Loading route from ${decodedFromName} to ${decodedToName}`);

        // Geocode both locations
        findDistanceButton.disabled = true;
        findDistanceButton.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Geocoding...`;
        const startResult = await geocodeLocationByName(decodedFromName);
        const endResult = await geocodeLocationByName(decodedToName);
        findDistanceButton.innerHTML = '<i class="fas fa-route"></i>'; // Reset icon even if error
        findDistanceButton.disabled = false;

        if (startResult && endResult) {
            startingCoordinates = { lat: startResult.lat, lon: startResult.lon };
            destinationCoordinates = { lat: endResult.lat, lon: endResult.lon };
            // Update input fields with potentially more precise names from geocoding
            startingLocationElement.value = startResult.name;
            destinationLocationElement.value = endResult.name;
            // Trigger distance calculation
            calculateDistance();
        } else {
            notifySreenReader("Could not find coordinates for one or both locations in the URL.");
            // Optionally clear the fields or show an error message
            // startingLocationElement.value = "Error loading location";
            // destinationLocationElement.value = "Error loading location";
        }
    }
}

// Copy route URL to clipboard using names
async function copyRouteUrlToClipboard() {
    const fromName = startingLocationElement.value;
    const toName = destinationLocationElement.value;
    const shareUrl = generateRouteShareUrl(fromName, toName);
    if (!shareUrl || !startingCoordinates || !destinationCoordinates) { // Also check if coords exist (route calculated)
        notifySreenReader('Cannot copy link, route not calculated yet or locations invalid.');
        return;
    }
    try {
        await navigator.clipboard.writeText(shareUrl);
        notifySreenReader('Route link copied to clipboard');
        // Visual feedback
        const originalText = copyRouteLinkButton.textContent; // Might not be needed if using innerHTML
        copyRouteLinkButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            // copyRouteLinkButton.textContent = originalText;
            copyRouteLinkButton.innerHTML = '<i class="fas fa-link"></i> Copy Route Link'; // Reset icon too
        }, 2000);
    } catch (err) {
        console.error('Failed to copy route URL: ', err);
        notifySreenReader('Failed to copy route link');
    }
}

// --- End URL Handling ---

/**
 * Sets up event listeners for a search action triggered by an input element and a button.
 * @param {HTMLElement} inputElement - The input element for entering a location.
 * @param {string} buttonId - The ID of the button associated with the search action.
 * @param {Function} searchHandler - The function to execute for the search action.
 */
const setupSearchEventListeners = (inputElement, buttonId, searchHandler) => {
  inputElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchHandler();
  });

  document.getElementById(buttonId)?.addEventListener("click", searchHandler);
};

/**
 * Initializes all event listeners related to the distance finder feature.
 */
export const initialize_DistanceFinder_EventListeners = () => {
  // Opens the distance box and cleans up previous actions
  distanceIcon.addEventListener("click", () => {
    distanceBox.style.display = "block";
    if(detalisElement.parentElement.style.display == 'block') detailsCloseButton.click(); // close search details box
    if (adjustablePointer) {
      // Ensure marker is defined or initialized if needed
      let marker = window.marker || new Marker(adjustablePointer.primaryMarker.getLatLng()).addTo(map);
      adjustablePointer.remove(); // Removes any active pointer on the map
    }
    successSound.play(); // Plays a sound to indicate action completion
  });

  // Sets up event listeners for searching starting and destination locations
  setupSearchEventListeners(startingLocationElement, "b-searchbutton", handleStartingLocationSearch);
  setupSearchEventListeners(destinationLocationElement, "d-searchbutton", handleDestinationSearch);

  // Tracks the currently focused input element for starting or destination location
  [startingLocationElement, destinationLocationElement].forEach((inputElement) => {
    inputElement.addEventListener("focus", () => {
      activeInputElement = document.activeElement;
    });
  });

  // Event listener for the main distance calculation button
  findDistanceButton.addEventListener("click", calculateDistance);
  
  // Event listener for the copy route link button
  copyRouteLinkButton?.addEventListener("click", copyRouteUrlToClipboard);

  // Close button for the distance finder box
  document.getElementById("closeBtn")?.addEventListener("click", closeDistanceFinder);

  // Choose from map button
  document.getElementById("fromMap")?.addEventListener("click", chooseLocationFromMap);

  // Check for route parameters in URL on initial load
  // We need to wait briefly for the map to potentially initialize from location params
  // otherwise this might run before map.js sets the view based on lat/lng/zoom
  setTimeout(checkRouteUrlParams, 500); 
};

// Function to close the distance finder box and clear results
export function closeDistanceFinder() {
  distanceBox.style.display = "none";
  distanceResultElement.style.display = "none";
  roadPathLayerGroup && roadPathLayerGroup.remove();
  startingLocationElement.value = "";
  destinationLocationElement.value = "";
  startingCoordinates = null;
  destinationCoordinates = null;
  copyRouteLinkButton.style.display = 'none'; // Hide copy button
  // Clear route URL parameters
  const url = new URL(window.location.href);
  url.searchParams.delete('from');
  url.searchParams.delete('to');
  // Also clear old coord-based ones just in case
  url.searchParams.delete('fromLat');
  url.searchParams.delete('fromLng');
  url.searchParams.delete('toLat');
  url.searchParams.delete('toLng');
  window.history.pushState({ path: url.toString() }, '', url.toString());
  closeSound.play();
}

// Function to allow user to choose a location from the map
function chooseLocationFromMap() {
    if (!activeInputElement) {
        notifySreenReader("Please focus on either the starting or destination input field first.");
        return;
    }
    notifySreenReader("Map focused. Click on the map to select the location.");
    map.getContainer().focus();
    map.once("click", (e) => {
        const coords = { lat: e.latlng.lat, lon: e.latlng.lng };
        activeInputElement.value = "Loading..."; 
        reverseGeocode(coords.lat, coords.lon).then(name => {
            activeInputElement.value = name;
            if (activeInputElement.id === "beginning") {
                startingCoordinates = coords;
            } else if (activeInputElement.id === "destination") {
                destinationCoordinates = coords;
            }
            successSound.play();
            notifySreenReader(`Selected ${name} for ${activeInputElement.id === 'beginning' ? 'starting point' : 'destination'}.`);
            activeInputElement.focus(); // Return focus
        });
    });
}

// Function to handle search and selection of the starting location
export function handleStartingLocationSearch() {
    performSearch(startingLocationElement, [])
        .then((result) => {
             if (!result) throw new Error("No result found"); // Handle case where performSearch resolves with no result
            startingCoordinates = {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
            };
            // Use display_name if available, otherwise use name
            startingLocationElement.value = result.display_name || result.name;
            removeResults();
        })
        .catch((error) => {
            console.error("Error fetching start location search results:", error);
            notifySreenReader("Could not find starting location.");
            removeResults();
        });
}

// Function to handle search and selection of the destination location
export function handleDestinationSearch() {
    performSearch(destinationLocationElement, [])
        .then((result) => {
            if (!result) throw new Error("No result found"); // Handle case where performSearch resolves with no result
            destinationCoordinates = {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
            };
            // Use display_name if available, otherwise use name
            destinationLocationElement.value = result.display_name || result.name;
            removeResults();
        })
        .catch((error) => {
            console.error("Error fetching destination search results:", error);
            notifySreenReader("Could not find destination location.");
            removeResults();
        });
}

// Function to calculate and display the distance between the starting and destination locations
export function calculateDistance() {
    if (!startingCoordinates || !destinationCoordinates) {
        notifySreenReader("Please select both starting and destination points, or ensure locations from URL were found.");
        return;
    }

    findDistanceButton.disabled = true;
    findDistanceButton.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Finding...`;
    distanceResultElement.style.display = "none";
    copyRouteLinkButton.style.display = 'none'; // Hide copy button initially

    const routePoints = [startingCoordinates, destinationCoordinates];
    const route = FOSSGISValhallaEngine("route", "auto", routePoints);

    route.getRoute(function (error, routeResult) { // Renamed inner 'route' to 'routeResult' 
        findDistanceButton.disabled = false;
        findDistanceButton.innerHTML = '<i class="fas fa-route"></i>'; // Reset icon

        if (!error && routeResult) {
            // Add the route line to the map
            if (geoLayer != null) {
                geoLayer.remove();
            }
            if (roadPathLayerGroup) {
                roadPathLayerGroup.remove();
            }
            // Assuming window.marker is available globally or passed appropriately
            window.marker?.clearGeoJson(); 
            roadPathLayerGroup = L.featureGroup();

            const path = L.polyline(routeResult.line, { color: "blue" }).addTo(roadPathLayerGroup);

            L.circleMarker(path.getLatLngs()[0], { //adding starting point to map
                fillColor: "red",
                stroke: false,
                fillOpacity: 1,
                radius: 5,
            }).addTo(roadPathLayerGroup);

            L.circleMarker(path.getLatLngs()[path.getLatLngs().length - 1], { //adding destination point to map
                fillColor: "green",
                stroke: false,
                fillOpacity: 1,
                radius: 5,
            }).addTo(roadPathLayerGroup);

            roadPathLayerGroup.addTo(map);
            map.fitBounds(roadPathLayerGroup.getBounds());

            const distanceText = toKMorMeter(routeResult.distance * 1000);
            const timeInMinutes = parseInt(routeResult.time / 60);
            const hours = Math.floor(timeInMinutes / 60);
            const minutes = timeInMinutes % 60;
            const timeText = `${hours > 0 ? hours + ' hr ' : ''}${minutes} min`;
            
            document.getElementById("dist").textContent = distanceText;
            document.getElementById("time").textContent = timeText;
            distanceResultElement.style.display = "block";
            copyRouteLinkButton.style.display = 'inline-block'; // Show copy button
            notifySreenReader(`Route found. Distance: ${distanceText}. Estimated time: ${timeText}`);
            updateRouteUrl(); // Update URL with names

        } else {
            console.error("Error calculating route:", error);
            // Provide more specific feedback if possible
            let errorMsg = "Error calculating route.";
            if (error && error.message) {
                errorMsg = `Error calculating route: ${error.message}`;
            } else if (typeof error === 'string') {
                errorMsg = `Error calculating route: ${error}`;
            }
            notifySreenReader(errorMsg);
            distanceResultElement.style.display = "none";
            copyRouteLinkButton.style.display = 'none'; // Hide copy button on error
        }
    }.bind(this)); 
}
