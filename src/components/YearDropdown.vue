<template>
  <div class="year-dropdown">
    <!-- Dropdown Button -->
    <button class="year-dropdown-button" @click="toggleDropdown">
      {{ 'Selected Year: ' }}&nbsp;{{ selectedYear }}
      <span :class="['arrow', { 'arrow-up': showDropdown }]"></span>
    </button>

    <!-- Dropdown Content -->
    <div v-if="showDropdown" class="year-dropdown-content">
      <div class="year-row">
        <span
          v-for="year in firstYearRow"
          :key="year"
          @click="selectYear(year)"
          class="year-option"
        >
          {{ year }}
        </span>
      </div>
      <div class="year-row">
        <span
          v-for="year in secondYearRow"
          :key="year"
          @click="selectYear(year)"
          class="year-option"
        >
          {{ year }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStore } from '@/stores/store.js'; // Adjust store path as needed

// Access the Pinia store
const store = useStore();

// Computed property for selectedYear, linked to Pinia state
const selectedYear = computed({
  get: () => store.selectedYear,
  set: (val) => store.changeSelectedYear(val),
});

// Reactive data properties
const showDropdown = ref(false);

const firstYearRow = [2015, 2016, 2017, 2018];
const secondYearRow = [2019, 2020, 2021, 2022];

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function selectYear(year) {
  selectedYear.value = year;
  showDropdown.value = false;
}
</script>

<style scoped>
.year-dropdown {
  position: relative;
  display: inline-block;
}

.year-dropdown-button {
  font-family: 'Montserrat', sans-serif;
  font-size: 15px;
  color: #ffffff; 
  background-color: #02624f;
  padding: 0.75rem 1.25rem;
  border: 1px solid #003c30;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

.arrow {
  margin-left: 8px;
  display: inline-block;
  width: 0;
  height: 0;
  vertical-align: middle;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #ffffff;
}

.arrow-up {
  transform: rotate(180deg);
}

.year-dropdown-content {
  position: absolute;
  background-color: #fafafa;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 160px;
  padding: 10px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  z-index: 999;
}

.year-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 8px;
}

.year-option {
  color: #333;
  padding: 5px 8px;
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.year-option:hover {
  color: #003c30; 
  background-color: #f0f0f0; 
}
</style>
