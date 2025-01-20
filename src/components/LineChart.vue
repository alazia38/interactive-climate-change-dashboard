<template>
  <div class="vis-component" ref="chart">
    <!-- Title + Subtitle Container -->
    <div class="title-subtitle-container">
      <h2 class="linechart-title">Tracking Temperature Changes over Time</h2>
      <h3 class="linechart-subtitle">
        Temperature change (°C) with respect to a baseline climatology (1951-1980).
        <span class="data-source">
          Data Source: <strong>Food and Agriculture Organization of the United Nations (FAO).</strong>
          Extracted from: <a href="http://www.fao.org/faostat/en/#data/ET"
            target="_blank">http://www.fao.org/faostat/en/#data/ET</a>.
        </span>
      </h3>
    </div>

    <!-- SVG container -->
    <div class="svg-container">
      <svg id="main-svg" :width="svgWidth" :height="svgHeight">
        <g class="chart-group" :transform="`translate(${svgPadding.left}, ${svgPadding.top})`">
          <!-- Horizontal Grid -->
          <g class="grid-lines-y">
            <line v-for="(value, i) in yTicks" :key="i" x1="0" :x2="innerChartWidth" :y1="yScale(value)"
              :y2="yScale(value)" />
          </g>

          <!-- X Axis -->
          <g class="axis axis-x" :transform="`translate(0, ${innerChartHeight})`">
            <line :x1="0" :x2="innerChartWidth" y1="0" y2="0" />
            <g v-for="(year, i) in xTicks" :key="i">
              <line :x1="xScale(year)" :x2="xScale(year)" y1="0" y2="6" />
              <text class="axis-x-tick-labels" :x="xScale(year)" y="20" text-anchor="end"
                :transform="`rotate(-45, ${xScale(year)}, 20)`">
                {{ year }}
              </text>
            </g>
            <text class="axis-title" text-anchor="middle" :x="innerChartWidth / 2" :y="50">
              Year
            </text>
          </g>

          <!-- Y Axis -->
          <g class="axis axis-y">
            <g v-for="(value, i) in yTicks" :key="i">
              <line x1="-6" x2="0" :y1="yScale(value)" :y2="yScale(value)" />
              <text class="axis-y-tick-labels" :x="-10" :y="yScale(value) + 4" text-anchor="end">
                {{ value.toFixed(2) }}
              </text>
            </g>
            <text class="axis-title" text-anchor="middle" transform="rotate(-90)" :x="-(innerChartHeight / 2)" :y="-45">
              Temperature Changes Relative to The Baseline (°C)
            </text>
          </g>

          <!-- Lines -->
          <g class="lines-group">
            <path v-for="(line, index) in coloredLines" :key="index" class="line" :stroke="line.color"
              :d="linePath(line.data)" />
          </g>

          <!-- Vertical hover line -->
          <line v-if="hoveredYear !== null" class="hover-line" :x1="xScale(hoveredYear)" :x2="xScale(hoveredYear)"
            y1="0" :y2="innerChartHeight" />

          <rect class="overlay" :width="innerChartWidth" :height="innerChartHeight" fill="transparent"
            @mousemove="onMouseMove" @mouseleave="onMouseLeave" />
        </g>
      </svg>

      <!-- Country legend container -->
      <div class="legend-container">
        <div v-for="(line, index) in coloredLines" :key="index" class="legend-item">
          <span class="legend-color-box" :style="{ backgroundColor: line.color }"></span>
          <span class="legend-label">{{ line.label }}</span>
        </div>
      </div>

      <!-- Tooltip for hovering over years -->
      <div class="tooltip" ref="tooltip">
        <!-- Populate the content of the tooltip -->
        <div class="tooltip-year">
          <strong>Year: {{ hoveredYear }}</strong>
        </div>
        <div v-for="(lineInfo, idx) in tooltipData" :key="idx" class="tooltip-line">
          <strong :style="{ color: lineInfo.color }">
            {{ lineInfo.label }}:
          </strong>
          {{ lineInfo.value !== null ? lineInfo.value.toFixed(2) + ' °C' : 'No Data' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as d3 from 'd3';
import { useStore } from '@/stores/store.js';

// Access the Pinia store
const store = useStore();

// Reactive data properties
const svgWidth = ref(800);
const svgHeight = ref(500);
const svgPadding = {
  top: 20,
  right: 110,
  bottom: 100,
  left: 80
};
const chart = ref(null);
const tooltip = ref(null);
const hoveredYear = ref(null);
const tooltipData = ref([]);

// Adjust the drawing area of the chart
const innerChartWidth = computed(() => svgWidth.value - svgPadding.left - svgPadding.right);
const innerChartHeight = computed(() => svgHeight.value - svgPadding.top - svgPadding.bottom);

// Define ISO3 codes for European Union
const euISO3 = [
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU',
  'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT',
  'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
];

// Extract and sort the years from temperatureChange by identifying four digit columns
const allYears = computed(() => {
  if (!store.temperatureChange.length) return [];
  const row = store.temperatureChange[0];
  return Object.keys(row)
    .filter((col) => /^\d{4}$/.test(col))
    .map(Number)
    .sort((a, b) => a - b);
});

// Create scales
const xScale = computed(() => {
  const years = allYears.value;
  if (!years.length) {
    return () => 0;
  }
  return d3.scaleLinear()
    .domain(d3.extent(years))
    .range([0, innerChartWidth.value]);
});

const yScale = computed(() => {
  const allVals = lines.value.flatMap((line) =>
    line.data.map((pt) => pt.value)
  );
  const validVals = allVals.filter((v) => v !== null && !isNaN(v));
  const minVal = validVals.length ? Math.min(...validVals, -3) : -3;
  const maxVal = validVals.length ? Math.max(...validVals, 4) : 4;
  return d3.scaleLinear()
    .domain([minVal, maxVal])
    .range([innerChartHeight.value, 0])
    .nice();
});

// Define x-axis ticks using a spacing of two years
const xTicks = computed(() => {
  const years = allYears.value;
  if (!years.length) return [];
  const [start, end] = d3.extent(years);
  const tickYears = [];
  for (let y = start; y <= end; y += 2) {
    tickYears.push(y);
  }
  return tickYears;
});

// Y Ticks
const yTicks = computed(() => {
  return yScale.value.ticks(5);
});

// Compute the data for the country lines
const lines = computed(() => {
  // By default, the lines for Austria and the EU are always shown
  const austrianData = getCountryTemperatureSeries('AUT');
  const euAverageData = getEUAverageSeries();

  // Retrieve data from store.selectedCountries to show extra country lines upon user selection on the choropleth map
  const extraLines = store.selectedCountries
    .map((countryName) => {
      const iso3 = store.findISO3ByCountryName(countryName);
      if (!iso3 || iso3 === 'AUT') return null;
      return {
        label: countryName,
        data: getCountryTemperatureSeries(iso3)
      };
    })
    .filter((line) => line !== null);

  return [
    { label: 'Austria', data: austrianData },
    { label: 'EU Average', data: euAverageData },
    ...extraLines
  ];
});

// Assign a color to each line
const coloredLines = computed(() => {
  return lines.value.map((line) => {
    let iso3 = store.findISO3ByCountryName(line.label) || line.label;
    if (line.label === 'EU Average') {
      iso3 = 'EU-AVERAGE';
    }
    return {
      ...line,
      color: store.getOrAssignColor(iso3)
    };
  });
});

// Compute the temperature data for a given country using its ISO3 code
function getCountryTemperatureSeries(iso3) {
  const row = store.temperatureChange.find((d) => d.ISO3 === iso3);
  if (!row) return [];
  return allYears.value.map((year) => ({
    year,
    value: isNaN(+row[year]) ? null : +row[year]
  }));
}

// Compute the average temperature data for the EU
function getEUAverageSeries() {
  const euRows = store.temperatureChange.filter((d) => euISO3.includes(d.ISO3));
  if (!euRows.length) return [];

  return allYears.value.map((year) => {
    const yearValues = euRows.map((r) => +r[year]).filter((v) => !isNaN(v));
    if (!yearValues.length) return { year, value: null };
    return { year, value: d3.mean(yearValues) };
  });
}

// Construct a line generator for drawing lines
function linePath(dataArray) {
  const lineGenerator = d3.line()
    .x((d) => xScale.value(d.year))
    .y((d) => (d.value !== null ? yScale.value(d.value) : NaN));
  return lineGenerator(dataArray.filter((d) => d.value !== null));
}

// Handle tooltip logic
function onMouseMove(mouseEvent) {
  if (!chart.value) return;

  // Compute the mouse's position relative to the chart
  const chartRect = mouseEvent.target.getBoundingClientRect();
  const mouseXOffset = mouseEvent.clientX - chartRect.left;

  // Use an inverted scale to find the closest year to the mouse's position
  const xScaleDomain = xScale.value.domain();
  const xScaleRange = xScale.value.range();
  const invertedScale = d3.scaleLinear().domain(xScaleRange).range(xScaleDomain);

  let hoveredYearValue = invertedScale(mouseXOffset);

  hoveredYearValue = Math.round(hoveredYearValue);
  hoveredYearValue = Math.max(xScaleDomain[0], Math.min(xScaleDomain[1], hoveredYearValue));

  // Update reactive property
  hoveredYear.value = hoveredYearValue;

  // Aggregate data at a specific year for all lines
  const aggregatedTooltipData = coloredLines.value.map((line) => {
    const dataPointForYear = line.data.find((pt) => pt.year === hoveredYear.value);
    return {
      label: line.label,
      color: line.color,
      value: dataPointForYear ? dataPointForYear.value : null
    };
  });

  tooltipData.value = aggregatedTooltipData;

  // Place tooltip close to the pointer
  const tooltipElement = tooltip.value;
  if (!tooltipElement) return;

  tooltipElement.style.opacity = 1;
  tooltipElement.style.display = 'block';
  tooltipElement.style.left = mouseEvent.clientX - 260 + 'px';
  tooltipElement.style.top = mouseEvent.clientY - 80 + 'px';
}

function onMouseLeave() {
  hoveredYear.value = null;
  tooltipData.value = [];
  const tooltipElement = tooltip.value;
  if (tooltipElement) {
    tooltipElement.style.opacity = 0;
    tooltipElement.style.display = 'none';
  }
}

// onMounted hook for any D3 setup needed
onMounted(() => {
  if (chart.value) {
    svgWidth.value = chart.value.clientWidth;
  }
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

.linechart-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 26px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.linechart-subtitle {
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
  font-family: 'Montserrat', sans-serif;
}

.axis {
  font-family: 'Montserrat', sans-serif;
}

.axis-x line {
  stroke: #808080;
  stroke-width: 1px;
}

.axis-x .axis-x-tick-labels {
  font-size: 10px;
  fill: #333;
}

.axis-x .axis-title {
  font-size: 14px;
  fill: #333;
}

.axis-y line {
  stroke: #ccc;
}

.axis-y .axis-y-tick-labels {
  font-size: 10px;
  fill: #333;
}

.axis-y .axis-title {
  font-size: 14px;
  fill: #333;
}

.grid-lines-y line {
  stroke: #ccc;
  stroke-dasharray: 2, 2;
}

.line {
  fill: none;
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.hover-line {
  stroke: #000;
  stroke-dasharray: 3, 3;
  pointer-events: none;
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
  font-size: 14px;
  border-radius: 4px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  transition: opacity 0.1s;
  z-index: 999;
}

.tooltip-year {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
}

.tooltip-line strong {
  font-size: 14px;
  font-weight: bold;
}
</style>
