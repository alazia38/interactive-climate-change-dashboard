<template>
  <div class="vis-component" ref="chart">
    <!-- Title + Subtitle Container -->
    <div class="title-subtitle-container">
      <h2 class="scatterplot-title">Subsidies vs Temperature Change</h2>
      <h3 class="scatterplot-subtitle">
        Exploring the relationship between fossil fuel subsidies and temperature changes across the European Union.
        <p class="data-source">
          Data Sources:
          <strong>International Monetary Fund, September 2021.</strong><br />
          <strong>Food and Agriculture Organization of the United Nations (FAO).</strong>
        </p>
      </h3>
    </div>

    <!-- Container for toggle buttons -->
    <div class="controls-container">
      <!-- Subsidy type buttons -->
      <div class="toggle-buttons">
        <button :class="{ active: selectedSubsidyType === 'EXPLICIT' }" @click="setSubsidyType('EXPLICIT')">
          Explicit
        </button>
        <button :class="{ active: selectedSubsidyType === 'IMPLICIT' }" @click="setSubsidyType('IMPLICIT')">
          Implicit
        </button>
        <button :class="{ active: selectedSubsidyType === 'TOTAL' }" @click="setSubsidyType('TOTAL')">
          Total
        </button>
      </div>

      <!-- Energy type buttons -->
      <div class="toggle-buttons">
        <button v-for="energyType in energyTypes" :key="energyType"
          :class="{ active: selectedEnergyType === energyType }" @click="toggleEnergyType(energyType)">
          {{ energyType }}
        </button>
      </div>
    </div>

    <!-- SVG container -->
    <div class="svg-container">
      <svg id="main-svg" :width="svgWidth" :height="svgHeight">
        <g class="chart-group" :transform="`translate(${svgPadding.left}, ${svgPadding.top})`">
          <!-- Horizontal Grid -->
          <g class="grid-lines-y">
            <line v-for="(value, i) in gridLineTicks" :key="i" x1="0" :x2="innerChartWidth"
              :y1="safeYScaleFunction(value)" :y2="safeYScaleFunction(value)" />
          </g>

          <!-- Points -->
          <g class="scatter-group">
            <circle v-for="(point, index) in scatterData" :key="index" :cx="getXPositionForSubsidy(point.x)"
              :cy="getYPositionForTemperature(point.y)" r="5" :fill="getPointColor(point.iso3)"
              @mousemove="onMouseMove($event, point)" @mouseleave="onMouseLeave" />
          </g>

          <!-- X Axis -->
          <g class="axis axis-x" ref="xAxis" :transform="`translate(0, ${innerChartHeight})`"></g>
          <text class="axis-title" :x="innerChartWidth / 2" :y="innerChartHeight + 40" text-anchor="middle">
            USD at constant 2021 prices
          </text>

          <!-- Y Axis -->
          <g class="axis axis-y" ref="yAxis"></g>
          <text class="axis-title" transform="rotate(-90)" :x="-(innerChartHeight / 2)" :y="-(svgPadding.left - 50)"
            text-anchor="middle">
            Temperature Changes Relative to The Baseline (°C)
          </text>
        </g>
      </svg>

      <!-- Tooltip for hovering over country points -->
      <div class="tooltip" ref="tooltip">
        <!-- Populate the content of the tooltip -->
        <div class="tooltip-year">
          <strong>Year: {{ store.selectedYear }}</strong>
        </div>
        <div class="tooltip-country">
          Country: {{ hoveredCountry }}
        </div>
        <div class="tooltip-line">
          <strong>Investment: </strong>{{ hoveredValueUSD }}
        </div>
        <div class="tooltip-line">
          <strong>Temperature Change: </strong>{{ hoveredValueTemp }} °C
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import * as d3 from 'd3';
import { useStore } from '@/stores/store.js';

// Access the Pinia store
const store = useStore();

// Reactive data properties
const svgWidth = ref(600);
const svgHeight = ref(400);
const svgPadding = {
  top: 20,
  right: 20,
  bottom: 50,
  left: 90
};
const chart = ref(null);
const tooltip = ref(null);
const hoveredCountry = ref('');
const hoveredValueUSD = ref('');
const hoveredValueTemp = ref('');
const selectedSubsidyType = ref('EXPLICIT');
const selectedEnergyType = ref('Gas');
const xScale = ref(null);
const yScale = ref(null);
const xAxis = ref(null);
const yAxis = ref(null);

// Adjust the drawing area of the chart
const innerChartWidth = computed(() => svgWidth.value - svgPadding.left - svgPadding.right);
const innerChartHeight = computed(() => svgHeight.value - svgPadding.top - svgPadding.bottom);

// Define ISO3 codes for European Union
const euISO3 = [
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU',
  'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT',
  'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
];

// Define the relevant energy types for the task
const energyTypes = ['Coal', 'Electricity', 'Gas', 'Petroleum'];

// Color-blind fiendly color palette for the energy types
const energyTypeColors = {
  Coal: '#bdB8ad',
  Electricity: '#ebe7e0',
  Gas: '#c6d4e1',
  Petroleum: '#44749d',
};

// Toggle subsidy and energy type
function setSubsidyType(type) {
  selectedSubsidyType.value = type;
}

function toggleEnergyType(eType) {
  selectedEnergyType.value = eType;
}

// Define an object to map CTS codes from the .csv file to their respective energy types
const CTSCodeToEnergyTypeMapping = {
  EXPLICIT: {
    ECGFTEC: 'Coal',
    ECGFTET: 'Electricity',
    ECGFTEN: 'Gas',
    ECGFTEP: 'Petroleum',
  },
  IMPLICIT: {
    ECGFTIC: 'Coal',
    ECGFTIT: 'Electricity',
    ECGFTIN: 'Gas',
    ECGFTIP: 'Petroleum',
  },
  TOTAL: {
    ECGFTN: 'Gas',
    ECGFTC: 'Coal',
    ECGFTT: 'Electricity',
    ECGFTP: 'Petroleum',
  },
};

// Check if ISO3 is default or a selectedCountry
function isSpecialOrUserSelectedCountry(iso3) {
  if (!iso3) return false;
  if (iso3 === 'AUT' || iso3 === 'EU-AVERAGE') return true;
  const countryName = store.findCountryNameByISO3(iso3);
  return store.selectedCountries.includes(countryName);
}

// Compute the color for each scatterplot point based on ISO3 code to ensure consistency with the country colors in the line chart
function getPointColor(iso3) {
  if (isSpecialOrUserSelectedCountry(iso3)) {
    return store.getOrAssignColor(iso3);
  }
  return energyTypeColors[selectedEnergyType.value];
}

// Compute the expenses for a given country, a selected year, a subsidy type and an energy type
function computeSingleCountryValue(csvData, iso3, selectedYear, subsidyType, energyType) {
  let totalSubsidyValue = 0;
  csvData.forEach(row => {
    if (row.ISO3 === iso3) {
      const energyTypeMapping = CTSCodeToEnergyTypeMapping[subsidyType][row['CTS Code']];
      const subsidyValueString = row[selectedYear];
      if (
        energyTypeMapping === energyType && row.Unit === 'USD at constant 2021 prices' &&
        subsidyValueString !== undefined &&
        subsidyValueString !== '' &&
        !isNaN(+subsidyValueString)
      ) {
        totalSubsidyValue += +subsidyValueString;
      }
    }
  });
  return totalSubsidyValue;
}

// Compute the expenses for the whole EU, given a selected year, a subsidy type and an energy type
function computeEUAverage(csvData, selectedYear, subsidyType, energyType) {
  let totalSubsidyValue = 0;
  let countryCount = 0;

  csvData.forEach(row => {
    if (row.ISO3 && euISO3.includes(row.ISO3)) {
      const energyTypeMapping = CTSCodeToEnergyTypeMapping[subsidyType][row['CTS Code']];
      const subsidyValueString = row[selectedYear];
      if (
        energyTypeMapping === energyType && row.Unit === 'USD at constant 2021 prices' &&
        subsidyValueString !== undefined &&
        subsidyValueString !== '' &&
        !isNaN(+subsidyValueString)
      ) {
        totalSubsidyValue += +subsidyValueString;
        countryCount++;
      }
    }
  });

  if (countryCount > 0) {
    return totalSubsidyValue / countryCount;
  }
  return 0;
}

// Compute the temperature change for a given country
function getTemperatureValue(temperatureData, iso3, selectedYear) {
  const row = temperatureData.find((d) => d.ISO3 === iso3);
  if (!row || isNaN(+row[selectedYear])) {
    return null;
  }
  return +row[selectedYear];
}

// Compute the temperature change for athe EU
function computeEUTemperatureAverage(temperatureData, selectedYear) {
  const rows = temperatureData.filter((r) => euISO3.includes(r.ISO3));
  const temperatureValues = rows.map((r) => +r[selectedYear]).filter(v => !isNaN(v));
  if (!temperatureValues.length) return null;
  return d3.mean(temperatureValues);
}

// Compute the scatterplot data based on the selected countries, the selected year, the subsidy type and the energy type
function buildScatterplotData() {
  if (!store.fossilFuelSubsidies?.length || !store.temperatureChange?.length) {
    return [];
  }

  const csvData = store.fossilFuelSubsidies;
  const temperatureData = store.temperatureChange;
  const selectedYear = store.selectedYear;
  const subsidyType = selectedSubsidyType.value;
  const energyType = selectedEnergyType.value;

  // Collect the country points
  const euCountryPoints = euISO3.map((iso3) => {
    const countryName = store.findCountryNameByISO3(iso3) || iso3;
    const subsidyValue = computeSingleCountryValue(csvData, iso3, selectedYear, subsidyType, energyType);
    const temperatureValue = getTemperatureValue(temperatureData, iso3, selectedYear);
    return { iso3, countryName: countryName, x: subsidyValue, y: temperatureValue };
  }).filter(dataPoint => dataPoint.y !== null);

  // Compute the data point for the EU
  const euAverageSubsidy = computeEUAverage(csvData, selectedYear, subsidyType, energyType);
  const euAverageTemperature = computeEUTemperatureAverage(temperatureData, selectedYear);
  const euAveragePoint = {
    iso3: 'EU-AVERAGE',
    countryName: 'European Union (Average)',
    x: euAverageSubsidy,
    y: euAverageTemperature !== null ? euAverageTemperature : 0,
  };

  // Compute the data points for non-EU selectedCountries
  const nonEUCountryPoints = store.selectedCountries
    .map((countryName) => {
      const iso3 = store.findISO3ByCountryName(countryName);
      if (!iso3) return null;
      if (euISO3.includes(iso3)) {
        return null;
      }
      const subsidyValue = computeSingleCountryValue(csvData, iso3, selectedYear, subsidyType, energyType);
      const temperatureValue = getTemperatureValue(temperatureData, iso3, selectedYear);
      return { iso3, countryName: countryName, x: subsidyValue, y: temperatureValue };
    })
    .filter((dataPoint) => dataPoint && dataPoint.y !== null);

  // Combine all data points 
  return [...euCountryPoints, euAveragePoint, ...nonEUCountryPoints];
}

const scatterData = computed(() => buildScatterplotData());

// Format numbers to more readable strings with units 
function formatNumber(num) {
  if (!num || isNaN(num)) return '0';

  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toFixed(2);
}

// Draw the axes on the chart 
function drawAxes() {
  if (!xScale.value || !yScale.value) return;

  // X Axis
  const xAxisSelection = d3.select(xAxis.value);
  xAxisSelection.call(
    d3.axisBottom(xScale.value)
      .tickSize(0)
      .tickPadding(8)
      .ticks(6)
      .tickFormat((d) => formatNumber(d))
  );

  // Y Axis
  const yAxisSelection = d3.select(yAxis.value);
  yAxisSelection.call(
    d3.axisLeft(yScale.value)
      .tickSize(0)
      .tickPadding(8)
      .ticks(5)
      .tickFormat(d3.format('.2f'))
  );
}

const gridLineTicks = computed(() => {
  if (!yScale.value) return [];
  return yScale.value.ticks(5);
});

// Update the scales upon country/year/subsidy type/energy type selection
watch([scatterData, innerChartWidth, innerChartHeight], () => {
  if (!scatterData.value.length || innerChartWidth.value <= 0 || innerChartHeight.value <= 0) {
    return;
  }

 // Update x scale
  const subsidyValueMax = d3.max(scatterData.value, d => d.x) || 0;
  xScale.value = d3.scaleLinear()
    .domain([0, subsidyValueMax])
    .range([0, innerChartWidth.value])
    .nice();

  // Update y scale
  const temperatureValues = scatterData.value.map(d => d.y);
  const temperatureValueMin = d3.min(temperatureValues) || 0;
  const temperatureValueMax = d3.max(temperatureValues) || 0;
  yScale.value = d3.scaleLinear()
    .domain([temperatureValueMin, temperatureValueMax])
    .range([innerChartHeight.value, 0])
    .nice();

  // Redraw using the new scales
  drawAxes();
});

// onMounted hook for any D3 setup needed
onMounted(() => {
  xScale.value = null;
  yScale.value = null;
});

// Define a safe wrapper for the Y scale
const safeYScaleFunction = computed(() => {
  if (!yScale.value) return () => 0;
  return yScale.value;
});

// Compute the x and y positions for the country subsidy and temperature values
function getXPositionForSubsidy(subsidyValue) {
  if (!xScale.value) return 0;
  return xScale.value(subsidyValue);
}

function getYPositionForTemperature(temperatureValue) {
  if (!yScale.value) return 0;
  return yScale.value(temperatureValue);
}

// Handle tooltip logic
function onMouseMove(event, point) {
  if (!tooltip.value) return;

  hoveredCountry.value = point.countryName;
  hoveredValueUSD.value = formatNumber(point.x);
  hoveredValueTemp.value = point.y !== null ? point.y.toFixed(2) : '0.00';

  // Position tooltip
  const { clientX, clientY } = event;
  tooltip.value.style.opacity = 1;
  tooltip.value.style.display = 'block';
  tooltip.value.style.left = (clientX - 950) + 'px';
  tooltip.value.style.top = (clientY - 400) + 'px';
}

function onMouseLeave() {
  if (!tooltip.value) return;
  tooltip.value.style.opacity = 0;
  tooltip.value.style.display = 'none';
  hoveredCountry.value = '';
  hoveredValueUSD.value = '';
  hoveredValueTemp.value = '';
}
</script>

<style scoped>
.vis-component {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  margin-left: 2rem;
  background: #fafafa;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 2rem 1rem;
  box-sizing: border-box;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title-subtitle-container {
  margin-bottom: 1rem;
  text-align: left;
}

.scatterplot-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.scatterplot-subtitle {
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
  font-size: 0.8em;
  color: #555;
}

.data-source em {
  font-style: italic;
}

.controls-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.toggle-buttons button {
  padding: 0.5rem 0.75rem;
  font-size: 14px;
  border: 1px solid #ccc;
  background-color: #fff;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  font-family: 'Montserrat', sans-serif;
}

.toggle-buttons button.active {
  background-color: #02624f;
  color: #fff;
  border-color: #003c30;
}

.toggle-buttons button:not(.active):hover {
  background-color: #f0f0f0;
}

.svg-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  margin: 0 auto;
}

#main-svg {
  display: block;
  background: #fff;
  border: 1px solid #ccc;
  font-family: 'Montserrat', sans-serif;
}

.axis .domain {
  stroke: #ccc;
  stroke-width: 1px;
}

.axis .tick line {
  stroke: #ccc;
}

.axis text {
  fill: #333;
  font-family: 'Montserrat', sans-serif;
  font-size: 12px;
}

.axis-title {
  fill: #333;
  font-size: 13px;
}

.grid-lines-y line {
  stroke: #ccc;
  stroke-dasharray: 2, 2;
}

.tooltip {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  display: none;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ccc;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 4px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  transition: opacity 0.1s;
  z-index: 999;
}

.tooltip-year {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}

.tooltip-country {
  font-size: 13px;
  margin-bottom: 6px;
}

.tooltip-line {
  margin-bottom: 2px;
}

.tooltip-line strong {
  font-size: 13px;
  font-weight: bold;
  margin-right: 4px;
}
</style>
