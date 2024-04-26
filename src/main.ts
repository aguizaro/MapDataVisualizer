import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng, LeafletMouseEvent, geoJSON } from "leaflet";
import "./leafletWorkaround";
import { GeoJsonObject, Feature } from "geojson";

// html elements -----------------------------------------------------------------------------------------------------
const countryNameDiv = document.querySelector("#countryName")!;
const casesDiv = document.querySelector("#cases")!;
const deathsDiv = document.querySelector("#deaths")!;
const deathsperConfirmedDiv = document.querySelector("#deathsPerConfirmed")!;

// leaflet map vars--------------------------------------------------------------------------------------------------------

const map = leaflet.map("map").setView([0, 0], 2);
const playerPos: leaflet.LatLng = new LatLng(0, 0);
const playerMarker = leaflet.marker(playerPos);

// custom data types -----------------------------------------------------------------------------------------------------

interface CountryData {
  confirmed: number;
  deaths: number;
  recovered: number;
}

type CountryStats = Record<string, CountryData>;

interface CovidData {
  count: number;
  date: string;
  result: CountryStats[];
}

// openstreet map -----------------------------------------------------------------------------------------------------

leaflet
  .tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png", {
    minZoom: 1,
    maxZoom: 8,
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
  .addTo(map);

// labels

// map buttons -----------------------------------------------------------------------------------------------------

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  updateMap()
    .then(() => {
      //
    })
    .catch((error) => {
      console.error(error);
    });
});

sensorButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  updateMap()
    .then(() => {
      //
    })
    .catch((error) => {
      console.error(error);
    });
});

// covid data -----------------------------------------------------------------------------------------------------
async function fetchCovidData(): Promise<CovidData> {
  const response = await fetch("latest.json");

  if (!response.ok) {
    throw new Error("Failed to fetch covid data");
  }
  const data = (await response.json()) as CovidData;
  return data;
}

// geolocation -----------------------------------------------------------------------------------------------------

function updatePosition(): Promise<string> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.watchPosition(
      (position) => {
        playerPos.lat = position.coords.latitude;
        playerPos.lng = position.coords.longitude;
        resolve("success");
      },
      (error) => {
        reject(error);
      }
    );
  });
}

// helper functions -----------------------------------------------------------------------------------------------------

async function updateMap() {
  try {
    await updatePosition();
    playerMarker.setLatLng(playerPos);
    playerMarker.addTo(map);
    map.setView(playerMarker.getLatLng(), 4);
  } catch (error) {
    console.error(error);
  }
}

function calculateColor(countryData: CountryData): string {
  //country data is not this
  if (countryData === undefined) {
    return "clear";
  }
  const deaths = countryData.deaths;
  const confirmed = countryData.confirmed;
  const deathsPerConfirmed = deaths / confirmed;

  if (deathsPerConfirmed < 0.01) {
    return "green";
  }
  if (deathsPerConfirmed < 0.02) {
    return "yellow";
  }
  if (deathsPerConfirmed < 0.03) {
    return "orange";
  }
  if (deathsPerConfirmed < 0.5) {
    return "red";
  }
  return "maroon";
}

// geoJSON event handlers -----------------------------------------------------------------------------------------------------

function onHover(e: LeafletMouseEvent) {
  const targetLayer = e.target;
  targetLayer.setStyle({
    fillOpacity: 0.9,
  });

  //display country name
  const countryName = targetLayer.feature.properties.name;
  if (countryNameDiv.textContent !== countryName) {
    countryNameDiv.textContent = countryName;

    //clear country data
    casesDiv.textContent = "";
    deathsDiv.textContent = "";
    deathsperConfirmedDiv.textContent = "";
  }
}

function onOut(e: LeafletMouseEvent) {
  // reset opacity
  e.target.setStyle({
    fillOpacity: 0.6,
  });
}

function onClick(e: LeafletMouseEvent) {
  //delete previous tooltip
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Tooltip) {
      map.removeLayer(layer);
    }
  });

  const targetLayer = e.target;

  //zoom to country on click
  map.fitBounds(targetLayer.getBounds() as leaflet.LatLngBoundsLiteral);

  targetLayer.setStyle({
    fillOpacity: 0.9,
  });

  //display country name
  const countryName = targetLayer.feature.properties.name;
  countryNameDiv.textContent = countryName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryData = covidStats.find((entry: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Object.keys(entry)[0] === targetLayer.feature.id;
  });

  // display country data as tooltip
  let tooltipContent;
  if (countryData) {
    tooltipContent = `
      <div">
        <p><strong>Country: </strong><br>${
          targetLayer.feature.properties.name
        }</p>
        <p><strong>Confirmed Cases: </strong><br>${countryData[
          targetLayer.feature.id
        ].confirmed.toLocaleString()}</p>
        <p><strong>Deaths: </strong><br>${countryData[
          targetLayer.feature.id
        ].deaths.toLocaleString()}</p>
        <p><strong>Case Fatality Rate: </strong><br>${(
          (countryData[targetLayer.feature.id].deaths /
            countryData[targetLayer.feature.id].confirmed) *
          100
        ).toFixed(2)}%</p>
      </div>
    `;
  } else {
    // no data found
    tooltipContent = `<div>
      <p><strong>Country: </strong><br>${targetLayer.feature.properties.name}</p>
      <p><strong>NO DATA FOUND </strong>`;
  }
  //open tooltip
  targetLayer.bindTooltip(tooltipContent, { permanent: true }).openTooltip();
}

// calculate deaths per confirmed covid case for each country
function onEach(feature: Feature, layer: leaflet.Layer) {
  const countryCode = feature.id;
  const countryStats = covidStats.find((entry) => {
    return Object.keys(entry)[0] === countryCode;
  });

  // set color based on covid data
  const pathLayer = layer as leaflet.Path;
  const fillColor = countryStats
    ? calculateColor(countryStats[countryCode!])
    : "clear";
  pathLayer.setStyle({
    fillColor: fillColor,
    fillOpacity: 0.6,
  });

  // add event listeners
  pathLayer.on({ mouseover: onHover, mouseout: onOut, click: onClick });
}

// map setup -----------------------------------------------------------------------------------------------------

let covidStats: CountryStats[] = [];

async function mapSetup() {
  // get covid data
  const dataObj = await fetchCovidData();
  covidStats = dataObj.result;
  // get geojson data
  const data = await fetch(
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
  );
  const geoJSONData = (await data.json()) as GeoJsonObject;
  // geojson layer
  geoJSON(geoJSONData, {
    onEachFeature: onEach,
    style: {
      fillOpacity: 0.6,
      weight: 1,
    },
  }).addTo(map);
}

// main -----------------------------------------------------------------------------------------------------

mapSetup().catch((error) => {
  console.error(error);
});
