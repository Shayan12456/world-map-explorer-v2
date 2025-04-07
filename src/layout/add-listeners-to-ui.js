/*
 * Copyright (c) 2023-25 Zendalona
 * This software is licensed under the GPL-3.0 License.
 * See the LICENSE file in the root directory for more information.
 */

import { tileLayerGeographical, tileLayerPolitical } from '../components/tile-layer.js';
import { cancelShowPlaceDetails, geoLayer } from '../services/fetch-place.js';
import { onSubmitonMainSearchBar } from '../components/Search/search.js';
import { detailsCloseButton } from '../utils/dom-elements.js';
import { fetchCurrentLocation } from '../services/current-location.js';
import { closeSearchResultsOnClickOutside } from '../utils/general-events.js';
import { closeSound } from '../utils/sounds.js';
import { map } from '../components/map.js';
import { initializeSearchInput } from '../services/do-search.js';



let layersBtn = document.getElementById('layers-btn'); //gets the layers button element
let layersDropdown = document.getElementById('layers-dropdown'); //gets the layers dropdown element

let geographicalLayerBtn = document.getElementById("geographical-layer"); //gets the geographical layer button element
let politicalLayerBtn = document.getElementById("political-layer"); //gets the political layer button element

let locationArrow = document
  .getElementById('controls-box')
  .querySelector('.fa-location-arrow');
let plusIcon = document
  .getElementById('controls-box')
  .querySelector('.fa-plus');
let minusIcon = document
  .getElementById('controls-box')
  .querySelector('.fa-minus');



export function addListenerstoUI(){
  // Initialize search input event listeners
  initializeSearchInput();
  
layersBtn.addEventListener('click', function () {
  layersDropdown.style.display =
    layersDropdown.style.display === 'block' ? 'none' : 'block';
});

locationArrow.addEventListener('click', fetchCurrentLocation);

plusIcon.addEventListener('click', function () {
  map.zoomIn();
});

minusIcon.addEventListener('click', function () {
  map.zoomOut();
});

document.getElementById('search-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    onSubmitonMainSearchBar();
  }
});
document.getElementById('searchbutton').addEventListener('click', function (e) {
  onSubmitonMainSearchBar();
});
document.addEventListener('click', closeSearchResultsOnClickOutside);


detailsCloseButton.addEventListener('click', function () {
  closeSound.play()
  document.getElementById("searchdetails").style.display = "none";
  if (geoLayer != null) {
    geoLayer.remove();
  }
  marker.clearGeoJson();
  cancelShowPlaceDetails()
})




  geographicalLayerBtn.addEventListener("click", function () {
    // Add your logic to switch to the geographical layer
    layersDropdown.style.display = "none"; // Hide dropdown
    tileLayerPolitical.remove();
    tileLayerGeographical.addTo(map);
    notifySreenReader("Switched to geograhical map");
  });
  // Event listener for political layer
  politicalLayerBtn.addEventListener("click", function () {
    // Add your logic to switch to the political layer
    layersDropdown.style.display = "none"; // Hide dropdown
    tileLayerGeographical.remove();
    tileLayerPolitical.addTo(map);
    notifySreenReader("Switched to political map");
  });
}