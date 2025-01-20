import { defineStore } from 'pinia';
import * as d3 from 'd3';

export const useStore = defineStore({
  id: 'main',
  state: () => ({
    selectedYear: 2015,
    selectedCountries: [],
    temperatureChange: [],
    loading: true,
    // Color-blind fiendly color palette (ColorBrewer) for the country lines
    countryColors: {
      'AUT': '#1b9e77',
      'EU-AVERAGE': '#d95f02'
    },
    colorPalette: [
      '#7570b3', '#e7298a',
      '#66a61e', '#e6ab02', '#a6761d'
    ],
    colorIndex: 0,
  }),
  actions: {
    async loadData() {
      this.loading = true;
      const temperatureData = await d3.csv('./22_Annual_Surface_Temperature_Change.csv');
      //console.log("Loaded Temperature CSV Data:", temperatureData);
      this.temperatureChange = temperatureData;
      const subsidiesData = await d3.csv('./21_Fossil_Fuel_Subsidies.csv');
      console.log("Loaded Subsidies CSV Data:", subsidiesData);
      this.fossilFuelSubsidies = subsidiesData;
      this.loading = false;
    },
    changeSelectedYear(year) {
      this.selectedYear = year;
    },
    addSelectedCountry(country) {
      this.selectedCountries.push(country);
    },
    removeSelectedCountry(country) {
      this.selectedCountries = this.selectedCountries.filter(c => c !== country);
    },
    findISO3ByCountryName(country) {
      const row = this.temperatureChange.find(
        (d) => d.Country === country);
      return row ? row.ISO3 : null;
    },
    findCountryNameByISO3(isoCode) {
      const row = this.temperatureChange.find(
        (d) => d.ISO3 === isoCode);
      return row ? row.Country : null;
    },
    getOrAssignColor(identifier) {

      if (this.countryColors[identifier]) {
        return this.countryColors[identifier];
      }
      const color = this.colorPalette[this.colorIndex % this.colorPalette.length];
      this.countryColors[identifier] = color;
      this.colorIndex++;
      return color;
    },
  },
  getters: {
    filteredTemperatureChange(state) {
      if (!state.temperatureChange) return [];
      const filteredData = state.temperatureChange
        .filter(d => state.selectedYear in d && !isNaN(+d[state.selectedYear]))
        .map(d => ({
          ISO3: d.ISO3,
          value: +d[state.selectedYear],
        }));
      return filteredData;
    },
    filteredFossilFuelSubsidies(state) {
      if (!state.fossilFuelSubsidies) return [];
      return state.fossilFuelSubsidies
        .filter(d => state.selectedYear in d && !isNaN(+d[state.selectedYear]))
        .map(d => ({
          ISO3: d.ISO3,
          value: +d[state.selectedYear],
        }));
    },
  },
});
