/*
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

import { tileLayerPolitical } from "./tile-layer.js";
import { toKMorMeter } from "../utils/to-km-or-meter.js";
import { notifySreenReader } from "../utils/accessibility.js";
import { addIndiaBoundaries } from "../services/fetch-india.js";



export var map = L.map("map", {
  keyboardPanDelta: 0,
}); //creates a map object and sets the view to the given coordinates and zoom level
tileLayerPolitical.addTo(map); //adds the tile layer to the map
window.map = map; //exports the map object
map.on(
  'zoomend',
  function () {
    notifySreenReader(`Zoom level ${map.getZoom()}`, true);
    calculateHeight();
    addIndiaBoundaries(); //adds the boundary lines of correct India to the map
  }.bind(this)
);

map.on('keydown', (event) => {
  if (event.originalEvent.code == "KeyL") {
    document.getElementById("locateme").click();
  }
});
map.on("locationfound", function (e) {
  // notifySreenReader("You are here", true);
  marker && marker.setLatLng(e.latlng);
});
map.on("locationerror", function (e) {
  notifySreenReader(
    e.code == 1 ? "Please grant loacation permission" : e.message,
    true
  ); // Handle the error appropriately (e.g., show an alert or a fallback message)
  alert(
    e.code == 1 ? "Please grant loacation permission" : e.message
  ); // Handle the error appropriately (e.g., show an alert or a fallback message)
});

var pane = map.createPane('customPane');
map.getPane('customPane').style.zIndex = 1000;



function calculateHeight() {
    let num =
        ((40075016 * Math.cos((map.getCenter().lat * Math.PI) / 180)) /
            Math.pow(2, map.getZoom() + 8)) *
        1050;
    notifySreenReader(document.getElementById("camera-height").innerText = "View Height :" + toKMorMeter(num))
}

L.control.scale().addTo(map); // this adds the visible scale to the map

// Initialize map view
map.setView([20, 0], 2);

// Check for URL parameters on load
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get('lat');
const lng = urlParams.get('lng');
const zoom = urlParams.get('zoom');
const fromName = urlParams.get('from'); // Check for the new name-based route param

// Only set view from lat/lng/zoom if route params are NOT present
if (lat && lng && zoom && !fromName) {
    const initialLat = parseFloat(lat);
    const initialLng = parseFloat(lng);
    const initialZoom = parseInt(zoom);
    if (!isNaN(initialLat) && !isNaN(initialLng) && !isNaN(initialZoom)) {
        map.setView([initialLat, initialLng], initialZoom);
    }
}


