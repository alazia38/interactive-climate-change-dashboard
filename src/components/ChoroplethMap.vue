<template>
  <div class="vis-component" ref="chart">
    <!-- Title + Subtitle Container -->
    <div class="title-subtitle-container">
      <h2 class="choropleth-title">Global Temperature Change Overview</h2>
      <h3 class="choropleth-subtitle">
        Temperature change (°C) with respect to a baseline climatology (1951-1980).
        <span class="data-source">
          Data Source: <strong>Food and Agriculture Organization of the United Nations (FAO).</strong>
          Extracted from: <a href="http://www.fao.org/faostat/en/#data/ET"
            target="_blank">http://www.fao.org/faostat/en/#data/ET</a>.
        </span>
      </h3>
    </div>

    <!-- Container for toggle buttons and selected countries -->
    <div class="controls-container">
      <!-- Toggle Buttons -->
      <div class="toggle-buttons">
        <button :class="{ active: selectedView === 'WORLD' }" @click="setView('WORLD')">
          World
        </button>
        <button :class="{ active: selectedView === 'EU' }" @click="setView('EU')">
          European Union
        </button>
      </div>

      <!-- Selected Countries -->
      <div class="selected-countries">
        <template v-if="store.selectedCountries.length === 0">
          <span class="country-chip no-country">No countries selected</span>
        </template>
        <template v-else>
          <span v-for="country in store.selectedCountries" :key="country" class="country-chip">
            {{ country }}
            <span class="chip-close" @click.stop="removeChip(country)">x</span>
          </span>
        </template>
      </div>
    </div>

    <!-- SVG Map Container-->
    <div class="svg-container">
      <svg id="main-svg" :width="svgWidth" :height="svgHeight">
        <g class="map-group" :transform="`translate(${svgPadding.left}, ${svgPadding.top})`">
          <!-- World Countries -->
          <g class="world-countries-group">
            <path v-for="feature in mapWorldCountries.features" :key="feature.properties.iso_a3_eh" class="country"
              :class="{ selected: isCountrySelected(store.findCountryNameByISO3(feature.properties.iso_a3_eh)) }"
              :d="path(feature.geometry)" :fill="color(feature)" @click.stop="handleCountryClick(feature, $event)"
              @mouseover="showTooltip($event, feature)" @mousemove="moveTooltip($event)" @mouseleave="hideTooltip" />
          </g>
        </g>
      </svg>

      <!-- Gradient Legend container -->
      <div class="legend-container">
        <div class="legend-labels">
          <span>High</span>
          <div class="legend-gradient"></div>
          <span>Low</span>
        </div>
      </div>
    </div>

    <!-- Tooltip for hovering over countries -->
    <div class="tooltip" ref="tooltip"></div>

    <!-- Popup for when the user tries to select more than 5 countries -->
    <div class="popup-overlay" v-if="showPopup" @click.self="closePopup">
      <div class="popup-modal">
        <button class="popup-close" @click="closePopup">×</button>
        <h3>Maximum Countries Selected</h3>
        <p>
          You can only select up to 5 countries at once.
        </p>
      </div>
    </div>

    <!-- Popup for when the user tries to select Austria -->
    <div class="popup-overlay" v-if="showAustriaPopup" @click.self="closeAustriaPopup">
      <div class="popup-modal">
        <button class="popup-close" @click="closeAustriaPopup">×</button>
        <h3>Austria is Already Shown</h3>
        <p>
          The data for Austria is included by default in the line and bar chart for reference.
          Please select a different country to compare data.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as d3 from 'd3';
import { useStore } from '@/stores/store.js';
import mapWorldCountries from '@/assets/world-countries-geo.json'; // Import the map data

// Access the Pinia store
const store = useStore();

// Reactive data properties
const svgWidth = ref(800);
const svgHeight = ref(400);
const svgPadding = {
  top: -30,
  left: -80,
};
const chart = ref(null);
const selectedView = ref('WORLD');
const tooltip = ref(null);
const showPopup = ref(false);
const showAustriaPopup = ref(false);

// Projection and path generation
const projection = d3.geoNaturalEarth1();
const path = d3.geoPath(projection);

// Computed properties for data and scales
const temperatureChange = computed(() => store.filteredTemperatureChange);
const temperatureChangeMin = computed(() => Math.min(d3.min(temperatureChange.value, d => d.value) ?? 0, -3.0));
const temperatureChangeMax = computed(() => Math.max(d3.max(temperatureChange.value, d => d.value) ?? 0, 4.0));

// Define ISO3 codes for European Union
const euISO3 = [
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU',
  'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT',
  'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
];

// BrBG diverging color scale (color-blind friendly)
const colorScale = computed(() =>
  d3.scaleDiverging(d3.interpolateBrBG)
    .domain([temperatureChangeMax.value, (temperatureChangeMax.value + temperatureChangeMin.value) / 2, temperatureChangeMin.value])
);

// Toggle View
function setView(view) {
  selectedView.value = view;
}

function isCountrySelected(countryName) {
  return store.selectedCountries.includes(countryName);
}

// Determine the color of each world country based on different cases
function color(feature) {
  const isoCode = feature.properties.iso_a3_eh;

  // Case 1: If EU view active, change the color of the non-EU countries to gray
  if (selectedView.value === 'EU' && !euISO3.includes(isoCode)) {
    return '#e0e0e0';
  }

  // Case 2: Determine the color of the country based on the color scale
  const temperatureData = temperatureChange.value.find(d => d.ISO3 === isoCode);
  if (temperatureData && temperatureData.value != null) {
    return colorScale.value(temperatureData.value);
  } else {
    return '#a9a9a9';
  }
}

// Handle click on country
function handleCountryClick(feature, event) {
  const isoCode = feature.properties.iso_a3_eh;
  const countryName = store.findCountryNameByISO3(isoCode);

  if (countryName === 'Austria') {
    showAustriaPopup.value = true;
    return;
  }

  if (!isCountrySelected(countryName)) {
    if (store.selectedCountries.length < 5) {
      store.addSelectedCountry(countryName);
      event.target.classList.add('selected');
      console.log(`Country added: ${countryName}`);
      console.log(`Selected countries: ${store.selectedCountries.join(', ')}`);
      // Bug fixed: Uniform country contour upon clicking
      d3.select(event.target).raise();
    } else {
      showPopup.value = true;
    }
  } else {
    removeChip(countryName);
    event.target.classList.remove('selected');
  }
}

// Handle country removal
function removeChip(countryName) {
  store.removeSelectedCountry(countryName);
}

// Handle tooltip logic
function showTooltip(event, feature) {
  // Populate the content of the tooltip 
  const isoCode = feature.properties.iso_a3_eh;
  const countryName = store.findCountryNameByISO3(isoCode);
  const temperatureData = temperatureChange.value.find(d => d.ISO3 === isoCode);
  const temperatureValue =
    temperatureData?.value !== undefined
      ? `${temperatureData.value.toFixed(3)} °C`
      : 'No data';

  tooltip.value.innerHTML = `
    <strong>${countryName}</strong><br>
    ${temperatureValue}
  `;
  tooltip.value.style.opacity = 1;
  tooltip.value.style.display = 'block';

  moveTooltip(event);
}

// Adjust tooltip position on mouse movement
function moveTooltip(event) {
  const svgRect = document.getElementById('main-svg').getBoundingClientRect();
  // Get the cursor's coordinates relative to the viewport
  const offsetX = event.clientX - svgRect.left;
  const offsetY = event.clientY - svgRect.top;

  // Position the tooltip 15px to the right and 15px below the cursor
  tooltip.value.style.left = offsetX + 15 + 'px';
  tooltip.value.style.top = offsetY + 15 + 'px';
}

function hideTooltip(event) {
  tooltip.value.style.opacity = 0;
  tooltip.value.style.display = 'none';
}

// Close popup
function closePopup() {
  showPopup.value = false;
}

function closeAustriaPopup() {
  showAustriaPopup.value = false;
}

// onMounted hook for any D3 setup needed
onMounted(() => {
  // D3 setup or choropleth drawing logic would go here
  if (chart.value) {
    svgWidth.value = chart.value.clientWidth;
    svgHeight.value = chart.value.clientHeight;
  }

  projection.scale((svgWidth.value - (svgPadding.left * 2)) / (2 * Math.PI))
    .translate([svgWidth.value / 2 - 100, svgHeight.value / 2 - 40]);

  // Zoom logic
  const zoom = d3.zoom()
    .scaleExtent([1, 6])
    .translateExtent([[0, 0], [svgWidth.value, svgHeight.value]])
    .extent([[0, 0], [svgWidth.value, svgHeight.value]])
    .on('zoom', (event) => {
      d3.select('.map-group').attr('transform', event.transform);
    });

  d3.select('#main-svg').call(zoom).call(zoom.transform, d3.zoomIdentity);
});
</script>

<style scoped>
.vis-component {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background: #fafafa;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 2rem 1rem;
  box-sizing: border-box;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title-subtitle-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 1rem auto;
  text-align: left;
}

.choropleth-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.choropleth-subtitle {
  font-family: 'Montserrat', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: #555;
  margin-bottom: 1rem;
  line-height: 1.3;
}

.data-source {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.9em;
  color: #555;
  line-height: 1.4;
}

.data-source a {
  color: #02624f;
  text-decoration: none;
}

.data-source a:hover {
  text-decoration: underline;
}

.controls-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 1rem auto;
  gap: 2rem;
}

.toggle-buttons {
  display: flex;
  gap: 0;
}

.toggle-buttons button {
  padding: 0.75rem 1.25rem;
  font-size: 15px;
  border: 1px solid #ccc;
  border-right: none;
  background-color: #fff;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  font-family: 'Montserrat', sans-serif;
  border-radius: 4px 0 0 4px;
}

.toggle-buttons button:last-child {
  border-radius: 0 4px 4px 0;
  border-right: 1px solid #ccc;
}

.toggle-buttons button.active {
  background-color: #02624f;
  color: #fff;
  border-color: #003c30;
}

.toggle-buttons button:not(.active):hover {
  background-color: #f0f0f0;
}

.selected-countries {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 16px;
  font-family: 'Montserrat', sans-serif;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-start;
}

.country-chip {
  background-color: #02624f;
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 1rem;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.chip-close {
  margin-left: 8px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  color: #fff;
}

.no-country {
  background-color: #bbb;
}

.svg-container {
  position: relative;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

#main-svg {
  display: block;
  width: 100%;
  height: auto;
  background: #fff;
  border: 1px solid #ccc;
}

.country {
  stroke: #ffffff;
  stroke-width: 0.5;
  cursor: pointer;
  vector-effect: non-scaling-stroke;
  fill-opacity: 1;
  transition: fill 0.2s ease;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.country:hover {
  fill-opacity: 0.8;
}

.country.selected {
  stroke: #000;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.legend-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
  height: 300px;
  background: rgba(255, 255, 255, 0.85);
  padding: 0.5rem;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font-family: 'Montserrat', sans-serif;
}

.legend-gradient {
  flex: 1;
  width: 100%;
  background: linear-gradient(to bottom,
      #543005,
      #bf812d,
      #f7f7f5,
      #80cdc1,
      #003c30);
  border: 1px solid #ccc;
  border-radius: 3px;
  margin-bottom: 0.5rem;
}

.legend-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  text-align: center;
  font-size: 14px;
}

.legend-labels span {
  margin: 0;
}

.tooltip {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  display: none;
  background: #fff;
  border: 1px solid #ddd;
  padding: 8px 12px;
  font-size: 14px;
  font-family: 'Montserrat', sans-serif;
  border-radius: 4px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.15);
  transition: opacity 0.1s;
  z-index: 999;
}

.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-modal {
  position: relative;
  width: 370px;
  background-color: #fff;
  border-radius: 6px;
  padding: 2rem 1.5rem;
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  border: 2px solid #02624f;
}

.popup-modal h3 {
  color: #02624f;
  margin-bottom: 0.75rem;
  font-size: 18px;
  font-weight: 600;
}

.popup-modal p {
  color: #333;
  line-height: 1.4;
}

.popup-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #02624f;
  color: #fff;
  border: none;
  border-radius: 3px;
  font-weight: bold;
  cursor: pointer;
  width: 30px;
  height: 30px;
  font-size: 16px;
}

.popup-close:hover {
  background: #003c30;
}
</style>
