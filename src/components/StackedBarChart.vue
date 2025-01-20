<template>
  <div class="vis-component" ref="chart">
    <!-- Title + Subtitle Container -->
    <div class="title-subtitle-container">
      <h2 class="stackedbarchart-title">Fossil Fuel Subsidies Comparison</h2>
      <h3 class="stackedbarchart-subtitle">
        A comparison of fossil fuel subsidies (coal, electricity, gas, and petroleum).
        <p class="data-source">
          Data Source: Parry, Ian; Black, Simon; Vernon, Nate.
          <em>Still Not Getting Energy Prices Right: A Global and Country Update of Fossil Fuel Subsidies</em>.
          <strong>International Monetary Fund, September 2021.</strong>
        </p>
      </h3>
    </div>

    <!-- Container for toggle buttons (subsidy type) -->
    <div class="controls-container">
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

          <!-- Stacked Bars -->
          <g class="bars-group">
            <g v-for="(subsidyBars) in stackedBars" :key="subsidyBars.key" class="subsidyBars"
              :fill="colorScale(subsidyBars.key)">
              <rect v-for="(bar, barIndex) in subsidyBars" :key="barIndex"
                :x="getXPositionForCountry(bar.data.countryName)" :y="getYPositionForValue(bar[1])"
                :width="reactiveBarWidth" :height="getReactiveBarHeight(bar[0], bar[1])"
                @mousemove="onMouseMove($event, bar)" @mouseleave="onMouseLeave" />
            </g>
          </g>

          <!-- X Axis -->
          <g class="axis axis-x" ref="xAxis" :transform="`translate(0, ${innerChartHeight})`" />

          <!-- Y Axis -->
          <g class="axis axis-y" ref="yAxis" />
          <text class="axis-title" transform="rotate(-90)" :x="-(innerChartHeight / 2)"
            :y="-(svgPadding.left - 40)" text-anchor="middle">
            USD at constant 2021 prices
          </text>
        </g>
      </svg>

      <!-- Energy types legend container -->
      <div class="legend-container">
        <div v-for="(energyTypeColor, energyTypeName) in energyTypeColors" :key="energyTypeName" class="legend-item">
          <span class="legend-color-box" :style="{ backgroundColor: energyTypeColor }"></span>
          <span class="legend-label">{{ energyTypeName }}</span>
        </div>
      </div>

      <!-- Tooltip for hovering over stacked bars -->
      <div class="tooltip" ref="tooltip">
        <!-- Populate the content of the tooltip -->
        <div class="tooltip-year">
          <strong>Year: {{ store.selectedYear }}</strong>
        </div>
        <div class="tooltip-country">
          Country: {{ hoveredCountry }}
        </div>
        <div v-for="(energyTypeValue, idx) in tooltipData" :key="idx" class="tooltip-line">
          <strong :style="{ color: energyTypeValue.color }">
            {{ energyTypeValue.energyType }}:
          </strong>
          {{ formatNumber(energyTypeValue.value) }}
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
const svgWidth = ref(700);
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
const tooltipData = ref([]);
const selectedSubsidyType = ref('EXPLICIT');
const xScale = ref(null);
const yScale = ref(null);
const xAxis = ref(null);
const yAxis = ref(null);

// Adjust the drawing area of the chart
const innerChartWidth = computed(() => svgWidth.value - svgPadding.left - svgPadding.right);
const innerChartHeight = computed(() => svgHeight.value - svgPadding.top - svgPadding.bottom);

// Define Austria and the EU as "default countries", so they are always shown on the chart for comparison purposes
const defaultCountryList = ['Austria', 'European Union'];

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

const colorScale = d3.scaleOrdinal()
  .domain(energyTypes)
  .range(Object.values(energyTypeColors));

// Toggle subsidy Type
function setSubsidyType(type) {
  selectedSubsidyType.value = type;
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

// Compute the expenses by energy type for a given country, a selected year and a subsidy type
function computeSingleCountry(csvData, countryName, selectedYear, subsidyType) {
  const iso3 = store.findISO3ByCountryName(countryName);
  if (!iso3) {
    console.warn(`No ISO3 code found for country: "${countryName}". Returning default values with all subsidies set to 0.`);
    return {
      countryName: countryName,
      Coal: 0,
      Electricity: 0,
      Gas: 0,
      Petroleum: 0,
    };
  }

  const subsidySumsByCategory = {
    countryName: countryName,
    Coal: 0,
    Electricity: 0,
    Gas: 0,
    Petroleum: 0
  };

  const energyTypeMapping = CTSCodeToEnergyTypeMapping[subsidyType] || CTSCodeToEnergyTypeMapping.EXPLICIT;

  csvData.forEach(row => {
    if (row.ISO3 === iso3) {
      const energyType = energyTypeMapping[row['CTS Code']];
      const subsidyValueString = row[selectedYear];
      if (
        energyType && row.Unit === 'USD at constant 2021 prices' &&
        subsidyValueString !== undefined &&
        subsidyValueString !== '' &&
        !isNaN(+subsidyValueString)
      ) {
        subsidySumsByCategory[energyType] += +subsidyValueString;
      }
    }
  });
  return subsidySumsByCategory;
}

// Compute the expenses by energy type for the whole EU, given a selected year and a subsidy type
function computeEUAverage(csvData, selectedYear, subsidyType) {
  const subsidySumsByCategory = {
    countryName: 'European Union',
    Coal: 0,
    Electricity: 0,
    Gas: 0,
    Petroleum: 0
  };

  const energyTypeMapping = CTSCodeToEnergyTypeMapping[subsidyType] || CTSCodeToEnergyTypeMapping.EXPLICIT;

  const countByEnergyType = {
    Coal: 0,
    Electricity: 0,
    Gas: 0,
    Petroleum: 0
  };

  csvData.forEach(row => {
    if (!row.ISO3 || !euISO3.includes(row.ISO3)) return;
    const energyType = energyTypeMapping[row['CTS Code']];
    const subsidyValueString = row[selectedYear];
    if (
      energyType && row.Unit === 'USD at constant 2021 prices' &&
      subsidyValueString !== undefined &&
      subsidyValueString !== '' &&
      !isNaN(+subsidyValueString)
    ) {
      subsidySumsByCategory[energyType] += +subsidyValueString;
      countByEnergyType[energyType]++;
    }
  });

  // Calculate EU-average 
  energyTypes.forEach(energyType => {
    if (countByEnergyType[energyType] > 0) {
      subsidySumsByCategory[energyType] /= countByEnergyType[energyType];
    }
  });

  return subsidySumsByCategory;
}

// Compute the stacked data based on the selected countries, the selected year and subsidy type
function buildStackedData(csvData, selectedYear, subsidyType) {
  if (!csvData || !csvData.length) return [];

  // Ensure that Austria and the EU are always included, followed by a maximum of 5 selected countries
  const userCountries = store.selectedCountries.filter(countryName => !defaultCountryList.includes(countryName));
  const finalList = [...defaultCountryList, ...userCountries];

  // Map the country list to aggregated subsidy data
  return finalList.map(countryName => {
    if (countryName === 'European Union') {
      return computeEUAverage(csvData, selectedYear, subsidyType);
    }
    return computeSingleCountry(csvData, countryName, selectedYear, subsidyType);
  });
}

const stackedData = computed(() => {
  if (!store.fossilFuelSubsidies || !store.fossilFuelSubsidies.length) return [];
  return buildStackedData(
    store.fossilFuelSubsidies,
    store.selectedYear,
    selectedSubsidyType.value
  );
});

// Generate the stacked bars for the stacked bar chart
const stackedBars = computed(() => {
  if (!stackedData.value.length) return [];
  const stackGenerator = d3.stack()
    .keys(energyTypes)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);
  return stackGenerator(stackedData.value);
});

// Axes 

// Format nu,bers to more readable strings with units 
function formatNumber(number) {
  if (!number || isNaN(number)) return '0';

  if (Math.abs(number) >= 1e9) {
    return (number / 1e9).toFixed(1) + 'B';
  } else if (Math.abs(number) >= 1e6) {
    return (number / 1e6).toFixed(1) + 'M';
  } else if (Math.abs(number) >= 1e3) {
    return (number / 1e3).toFixed(1) + 'K';
  }
  return number.toFixed(2);
}

// Draw the axes on the chart 
function drawAxes() {
  if (!xScale.value || !yScale.value) return;

  // X axis
  const xAxisSelection = d3.select(xAxis.value);
  xAxisSelection.call(
    d3.axisBottom(xScale.value)
      .tickSize(0)
      .tickPadding(8)
  );

  // Y axis
  const yAxisSelection = d3.select(yAxis.value);
  yAxisSelection.call(
    d3.axisLeft(yScale.value)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat(d => formatNumber(d))
  );
}

// Define 5 y-axis ticks for the horizontal grid
const gridLineTicks = computed(() => {
  if (!yScale.value) return [];
  return yScale.value.ticks(5);
});

// Update the scales upon country/year/subsidy type selection  
watch([stackedData, innerChartWidth, innerChartHeight], () => {
  if (!stackedData.value.length || innerChartWidth.value <= 0 || innerChartHeight.value <= 0) {
    return;
  }

  // Update x scale
  xScale.value = d3.scaleBand()
    .domain(stackedData.value.map(d => d.countryName))
    .range([0, innerChartWidth.value])
    .padding(0.3);

  // Compute the highest value on the y axis by suming all subsidies
  const subsidyValueMax = d3.max(stackedData.value, row =>
    energyTypes.reduce((totalSubsidy, energyType) => totalSubsidy + (row[energyType] || 0), 0)
  ) || 0;

  // Update y scale
  yScale.value = d3.scaleLinear()
    .domain([0, subsidyValueMax])
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

// Compute the x and y positions for countries, as well as the bar dimensions of each bar
function getXPositionForCountry(countryName) {
  if (!xScale.value) return 0;
  return xScale.value(countryName) ?? 0;
}

function getYPositionForValue(value) {
  return safeYScaleFunction.value(value);
}

function getBarWidth() {
  if (!xScale.value) return 0;
  const barWidth = xScale.value.bandwidth();
  return barWidth > 0 ? barWidth : 0;
}

function getBarHeight(yStart, yEnd) {
  const topYPosition = getYPositionForValue(yEnd);
  const bottomYPosition = getYPositionForValue(yStart);
  const barHeight = bottomYPosition - topYPosition;
  return barHeight < 0 ? 0 : barHeight;
}

const reactiveBarWidth = computed(() => getBarWidth());

function getReactiveBarHeight(yStart, yEnd) {
  return getBarHeight(yStart, yEnd);
}

// Handle tooltip logic
function onMouseMove(mouseEvent, hoveredBar) {
  if (!tooltip.value) return;

  hoveredCountry.value = hoveredBar.data.countryName;
  tooltipData.value = [...energyTypes]
    .reverse()
    .map((energyType) => ({
      energyType: energyType,
      value: hoveredBar.data[energyType] || 0,
      color: energyTypeColors[energyType],
    }));

  // Position tooltip
  const { clientX, clientY } = mouseEvent;
  tooltip.value.style.opacity = 1;
  tooltip.value.style.display = 'block';
  tooltip.value.style.left = (clientX - 250) + 'px';
  tooltip.value.style.top = (clientY - 400) + 'px';
}

function onMouseLeave() {
  if (!tooltip.value) return;
  tooltip.value.style.opacity = 0;
  tooltip.value.style.display = 'none';
  hoveredCountry.value = '';
  tooltipData.value = [];
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

.stackedbarchart-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.stackedbarchart-subtitle {
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
  padding: 0.75rem 1.25rem;
  font-size: 15px;
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
  font-size: 14px;
}

.grid-lines-y line {
  stroke: #ccc;
  stroke-dasharray: 2, 2;
}

.legend-container {
  display: flex;
  flex-wrap: wrap;
  margin-top: 1rem;
  font-family: 'Montserrat', sans-serif;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-right: 1.5rem;
  margin-bottom: 0.5rem;
}

.legend-color-box {
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border: 1px solid #333;
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
