import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, {
  LatLng,
  LeafletMouseEvent,
  geoJSON,
  Control,
  DomUtil,
} from "leaflet";
import "./leafletWorkaround";
import { GeoJsonObject, Feature, Geometry } from "geojson";

// html elements -----------------------------------------------------------------------------------------------------
const countryNameDiv = document.querySelector("#countryName")!;
const casesDiv = document.querySelector("#cases")!;
const deathsDiv = document.querySelector("#deaths")!;
const deathsperConfirmedDiv = document.querySelector("#deathsPerConfirmed")!;
let legend: Control;
let legendTitle: HTMLHeadElement;

// leaflet map vars--------------------------------------------------------------------------------------------------------

const map = leaflet.map("map").setView([0, 0], 2);
const playerPos: leaflet.LatLng = new LatLng(0, 0);
const playerMarker = leaflet.marker(playerPos);
let currentFilter: "covid" | "population" = "covid";
let geojson: leaflet.GeoJSON;

let covidData: CovidData[] = [];
let populationData: PopulationData[] = [];

// custom data types -----------------------------------------------------------------------------------------------------

interface CovidData {
  countryCode: string;
  confirmed: number;
  deaths: number;
  recovered: number;
  fatalityRate: number;
}

type CovidCountryRecord = Record<string, CovidData>;

interface DataResponse {
  count: number;
  date: string;
  result: CovidCountryRecord[];
}

interface PopulationData {
  yearcode: string;
  countryname: string;
  countrycode: string;
  totalpop: number;
  netmigration: number;
  ruralpop: number;
  urbanpop: number;
  urbanpopratio: number;
}

// openstreet map -----------------------------------------------------------------------------------------------------

leaflet
  .tileLayer(
    `https://tile.jawg.io/jawg-sunny/{z}/{x}/{y}{r}.png?access-token=uBKVvqD2oEJYhl5b1gcf5Rms5xQMCGSf92x27kCjWtl7s9n7nHhXost4klC0hh4I`, //not sensitive
    {
      attribution:
        '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 0,
      maxZoom: 7,
    }
  )
  .addTo(map);

// labels

// map buttons -----------------------------------------------------------------------------------------------------

// geolocation button
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

//filter button
const filterButton = document.querySelector("#filter")!;
filterButton.addEventListener("click", () => {
  toggleFilter();
});

filterButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  toggleFilter();
  //
});

// covid data -----------------------------------------------------------------------------------------------------
async function fetchCovidData(): Promise<CovidData[]> {
  const response = await fetch(
    "https://raw.githubusercontent.com/aguizaro/MapDataVisualizer/main/resources/covid.json"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch covid data");
  }
  const data = (await response.json()) as DataResponse;
  const dataArray = data.result;
  const parsedData = dataArray.map((item) => {
    const key = Object.keys(item)[0];
    return {
      countryCode: key,
      confirmed: item[key].confirmed,
      deaths: item[key].deaths,
      recovered: item[key].recovered,
      fatalityRate: item[key].deaths / item[key].confirmed,
    } as CovidData;
  });

  return parsedData;
}

async function fetchPoplationData(): Promise<PopulationData[]> {
  const response = await fetch(
    "https://raw.githubusercontent.com/aguizaro/MapDataVisualizer/main/resources/pop.json"
  );
  if (!response.ok) {
    throw new Error("Failed to fetch population data");
  }
  const data = await response.json();
  const parsedData = data.map((item: PopulationData) => ({
    ...item,
    totalpop: Number(item.totalpop),
    netmigration: Number(item.netmigration),
    ruralpop: Number(item.ruralpop),
    urbanpop: Number(item.urbanpop),
    urbanpopratio: Number(Number(item.urbanpop) / Number(item.totalpop)),
  })) as PopulationData[];

  return parsedData;
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

function calculateCovidColor(
  covData: CovidData,
  popData: PopulationData
): string {
  //country data is not this
  if (covData === undefined || popData === undefined) {
    return "clear";
  }
  const infectionRate = covData.confirmed / popData.totalpop;
  let color = "";
  if (infectionRate < 0.005) {
    color = "#fff33b";
  } else if (infectionRate < 0.01) {
    color = "#fdc70c";
  } else if (infectionRate < 0.05) {
    color = "#f3903f";
  } else if (infectionRate < 0.1) {
    color = "#ed683c";
  } else if (infectionRate < 0.21) {
    color = "#e93e3a";
  }
  return color;
}

function calculatePopulationColor(data: PopulationData): string {
  if (data === undefined) {
    return "clear";
  }
  const urbanPopRatio = data.urbanpopratio;
  let color = "";
  if (urbanPopRatio < 0.6) {
    color = "#fff33b";
  } else if (urbanPopRatio < 0.7) {
    color = "#fdc70c";
  } else if (urbanPopRatio < 0.8) {
    color = "#f3903f";
  } else if (urbanPopRatio < 0.9) {
    color = "#ed683c";
  } else if (urbanPopRatio < 0.99) {
    color = "#e93e3a";
  }
  return color;
}

function updateToolTips() {
  //delete previous tooltip
  geojson.eachLayer((layer) => {
    if (layer.getTooltip() == null) return;
    if (layer.isTooltipOpen()) {
      const tooltip = layer.getTooltip();
      if (tooltip) {
        const newContent = createToolTipContent(layer as leaflet.FeatureGroup);
        tooltip.setContent(newContent).openTooltip();
      }
    } else layer.unbindTooltip();
  });
}

function removeAllTooltips() {
  geojson.eachLayer((layer) => {
    layer.unbindTooltip();
  });
}

function toggleFilter() {
  currentFilter = currentFilter === "covid" ? "population" : "covid";
  updateToolTips();
  toggleLegend();
  //refresh all layers
  geojson.eachLayer((layer) => {
    const countryCode = ((layer as leaflet.FeatureGroup).feature as Feature)
      .id as string;
    applyColorToLayer(layer, countryCode);
  });
}

function applyColorToLayer(layer: leaflet.Layer, countryCode: string) {
  const countryCovidData = covidData.find((entry: CovidData) => {
    return entry.countryCode === countryCode;
  })!;

  const popData = populationData.find((entry) => {
    return entry.countrycode === countryCode;
  });

  // set color based on covid data
  const pathLayer = layer as leaflet.Path;
  let fillColor = ""; //empty string uses default color
  if (currentFilter === "covid" && countryCovidData && popData && countryCode) {
    fillColor = calculateCovidColor(countryCovidData, popData);
  } else if (currentFilter === "population" && popData && countryCode) {
    fillColor = calculatePopulationColor(popData);
  }
  // apply color
  pathLayer.setStyle({
    fillColor: fillColor,
    fillOpacity: 0.75,
    weight: 2,
  });
}

function toggleLegend() {
  //delete previous legend
  if (legend) {
    map.removeControl(legend);
  }

  legend = new Control({ position: "bottomleft" });
  legendTitle = DomUtil.create("h4", "legend-title");
  if (currentFilter === "covid") {
    legendTitle.innerText = "COVID-19 Infeciton Rate";

    legend.onAdd = () => {
      const div = DomUtil.create("div", "legend");
      div.appendChild(legendTitle);
      const grades = [0.5, 1, 5, 10, 20];
      const colors = ["#fff33b", "#fdc70c", "#f3903f", "#ed683c", "#e93e3a"];

      for (let i = 0; i < grades.length; i++) {
        div.innerHTML += `<i style="background-color:${colors[i]}">< ${grades[i]}%</i>`;
      }
      return div;
    };
  } else {
    legendTitle.innerText = "Urban Population Ratio";

    legend.onAdd = () => {
      const div = DomUtil.create("div", "legend");
      div.appendChild(legendTitle);
      const grades = [60, 70, 80, 90, 99];
      const colors = ["#fff33b", "#fdc70c", "#f3903f", "#ed683c", "#e93e3a"];

      for (let i = 0; i < grades.length; i++) {
        div.innerHTML += `<i style="background-color:${colors[i]}">< ${grades[i]}%</i>`;
      }
      return div;
    };
  }

  legend.addTo(map);
}

function createToolTipContent(targetLayer: leaflet.FeatureGroup) {
  const countryCovidData = covidData.find((entry: CovidData) => {
    return entry.countryCode === (targetLayer.feature! as Feature).id;
  })!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryPopData = populationData.find((entry: any) => {
    return entry.countrycode === (targetLayer.feature! as Feature).id;
  })!;

  // display country data as tooltip
  let tooltipContent;
  if (currentFilter == "covid") {
    if (!countryCovidData || !countryPopData) {
      tooltipContent = `<div>
      <p id='country-name'>${
        (targetLayer.feature! as Feature).properties!.name
      }</p>
      <p><strong>NO DATA FOUND </strong>`;
    } else {
      tooltipContent = `<div>
      <p id='country-name'>${
        (targetLayer.feature! as Feature).properties!.name
      }</p>
      <h4>COVID-19 Data</h4>
      <p><strong>Confirmed Cases: </strong><br>${countryCovidData.confirmed.toLocaleString()}</p>
      <p><strong>Population: </strong><br>${countryPopData.totalpop.toLocaleString()}</p>
      <p><strong>Deaths: </strong><br>${countryCovidData.deaths.toLocaleString()}</p>
      <p><strong>Case Fatality Rate: </strong><br>${(
        countryCovidData.fatalityRate * 100
      ).toFixed(2)}%</p>
      <p id="focus"><strong>Infection Rate: </strong><br>${(
        (countryCovidData.confirmed / countryPopData.totalpop) *
        100
      ).toFixed(2)}%</p>
    </div>`;
    }
  } else {
    if (!countryPopData) {
      tooltipContent = `<div>
      <p id='country-name'>${
        (targetLayer.feature! as Feature).properties!.name
      }</p>
        <p><strong>NO DATA FOUND </strong>`;
    } else {
      tooltipContent = `
    <div>
    <p id='country-name'>${
      (targetLayer.feature! as Feature).properties!.name
    }</p>
      <h4>Population Data</h4>
      <p><strong>Urban Population</strong><br>${(
        populationData.find(
          (entry) => entry.countrycode === (targetLayer.feature! as Feature).id
        )?.urbanpop ?? "N/A"
      ).toLocaleString()}</p>
    <p><strong>Rural Population</strong><br>${(
      populationData.find(
        (entry) => entry.countrycode === (targetLayer.feature! as Feature).id
      )?.ruralpop ?? "N/A"
    ).toLocaleString()}</p>
    <p><strong>Total Population</strong><br>${(
      populationData.find(
        (entry) => entry.countrycode === (targetLayer.feature! as Feature).id
      )?.totalpop ?? "N/A"
    ).toLocaleString()}</p>
      <p id="focus"><strong>Urban Ratio</strong><br>${(
        (Number(
          populationData.find(
            (entry) =>
              entry.countrycode === (targetLayer.feature! as Feature).id
          )?.urbanpopratio
        ) ?? "N/A") * 100
      ).toFixed(2)}%</p>
    </div>
  `;
    }
  }
  return tooltipContent;
}

// geoJSON event handlers -----------------------------------------------------------------------------------------------------

function onHover(e: LeafletMouseEvent) {
  const targetLayer = e.target;
  targetLayer.setStyle({
    fillOpacity: 1,
    weight: 4,
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
    fillOpacity: 0.75,
    weight: 2,
  });
  // clear country name
  countryNameDiv.textContent = "";
}

function onClick(e: LeafletMouseEvent) {
  removeAllTooltips();

  const targetLayer = e.target as leaflet.FeatureGroup;

  //zoom to country on click
  map.fitBounds(targetLayer.getBounds().pad(0.5));

  //display country name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryName = (targetLayer.feature as Feature<Geometry, any>).properties
    .name;
  countryNameDiv.textContent = countryName;

  const tooltipContent = createToolTipContent(targetLayer);
  //open tooltip
  targetLayer.bindTooltip(tooltipContent, { permanent: true }).openTooltip();
}

//
function onEach(feature: Feature, layer: leaflet.Layer) {
  const countryCode = feature.id as string;
  applyColorToLayer(layer, countryCode);

  // add event listeners
  layer.on({ mouseover: onHover, mouseout: onOut, click: onClick });
}

// map setup -----------------------------------------------------------------------------------------------------

async function mapSetup() {
  // get covid data
  covidData = await fetchCovidData();
  // get population data
  populationData = await fetchPoplationData();
  // get geojson data
  const data = await fetch(
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
  );
  const geoJSONData = (await data.json()) as GeoJsonObject;
  // geojson layer
  geojson = geoJSON(geoJSONData, {
    onEachFeature: onEach,
  }).addTo(map);
  // create legend
  toggleLegend();
}

// main -----------------------------------------------------------------------------------------------------

mapSetup().catch((error) => {
  console.error(error);
});
