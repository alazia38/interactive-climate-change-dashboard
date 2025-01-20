<template>
  <div id="app">
    <div class="title">
      Exploring Climate Impacts and Energy Economics
    </div>

    <div class="info-section">
      <div class="info-section-container">
        <h3 class="info-section-title">How to Use:
          <ul class="info-section-list">
            <li>
              <span class="icon">📅</span>
              <span>Select a year from the dropdown.</span>
            </li>
            <li>
              <span class="icon">🌍</span>
              <span>Toggle between World view and European Union view.</span>
            </li>
            <li>
              <span class="icon">🖱️</span>
              <span>Zoom in and select a country on the choropleth map.</span>
            </li>
          </ul>
        </h3>
      </div>
    </div>

    <!-- Handle loading data -->
    <div v-if="isLoading" class="loading-container">
      <p class="loading-message">Loading data, please wait...</p>
    </div>
    <div v-else>
      <div class="year-dropdown-container">
        <YearDropdown />
      </div>

      <div class="row justify-content-center">
        <div class="col-md-10">
          <ChoroplethMap />
        </div>
      </div>

      <div class="row justify-content-center mt-5">
        <div class="col-md-10">
          <LineChart />
        </div>
      </div>

      <div class="row justify-content-center mt-5">
        <div class="col-md-6">
          <StackedBarChart />
        </div>
        <div class="col-md-5">
          <Scatterplot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useStore } from '@/stores/store.js';

// Initialize store
const store = useStore();
const isLoading = computed(() => store.loading);

// Import components
import YearDropdown from '@/components/YearDropdown.vue';
import ChoroplethMap from '@/components/ChoroplethMap.vue';
import LineChart from '@/components/LineChart.vue';
import StackedBarChart from '@/components/StackedBarChart.vue';
import Scatterplot from '@/components/Scatterplot.vue';

// Load data when component is mounted
onMounted(() => {
  store.loadData();
});
</script>

<style scoped>
.title {
  font-family: 'Montserrat', sans-serif;
  font-size: 40px;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 30px;
  margin-top: 30px;
}

.info-section {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.info-section-container {
  max-width: 600px;
  background-color: #fafafa;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-section-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 24px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.info-section-list {
  padding: 0;
  margin-top: 15px;
}

.info-section-list li {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 16px;
  color: #555;
  padding-left: 10px;
  padding-right: 10px;
  border-left: 3px solid transparent;
}

.info-section-list li .icon {
  font-size: 20px;
  margin-right: 10px;
  color: #003c30;
}

.info-section-list li span {
  font-family: 'Montserrat', sans-serif;
  font-size: 16px;
  font-weight: 400;
}

.year-dropdown-container {
  text-align: center;
  margin-bottom: 30px;
}

.loading-container {
  display: flex;
  justify-content: center;
  margin-top: 60px;
}

.loading-message {
  font-family: 'Montserrat', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  background-color: #02624f;
  padding: 20px;
  border: 1px solid #003c30;
  border-radius: 10px;
}
</style>
