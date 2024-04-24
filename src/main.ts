import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng, LeafletMouseEvent, geoJSON } from "leaflet";
import "./leafletWorkaround";
import { Feature, GeoJsonObject } from "geojson";

// leaflet map vars --------------------------------------------------------------------------------------------------------

const MAX_ZOOM = 19;
const map = leaflet.map("map").setView([0, 0], 2);
const playerPos: leaflet.LatLng = new LatLng(0, 0);
const playerMarker = leaflet.marker(playerPos);

// openstreet map -----------------------------------------------------------------------------------------------------

// sattelite map
leaflet
  .tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      minZoom: 0,
      maxZoom: MAX_ZOOM,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }
  )
  .addTo(map);

// labels
leaflet
  .tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: MAX_ZOOM,
    }
  )
  .addTo(map);

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

async function updateMap() {
  try {
    await updatePosition();
    playerMarker.setLatLng(playerPos);
    playerMarker.addTo(map);
    map.setView(playerMarker.getLatLng(), 5);
  } catch (error) {
    console.error(error);
  }
}

// map interactions -----------------------------------------------------------------------------------------------------

// geoJSON for country boundaries
const geoJSONLayer = geoJSON();
fetch(
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
)
  .then((response) => response.json())
  .then((data: GeoJsonObject) => {
    geoJSONLayer.addData(data);
    //fill
    geoJSONLayer.setStyle({
      fillColor: "clear",
      fillOpacity: 0.25,
      weight: 1,
    });
    //hover over individual country
    geoJSONLayer.eachLayer((layer) => {
      layer.on("mouseover", (event: LeafletMouseEvent) => {
        const targetLayer = event.target;
        targetLayer.setStyle({
          fillColor: "blue",
          fillOpacity: 0.5,
        });
        //display country name
        const countryName = targetLayer.feature.properties.name;
        const countryNameDiv = document.querySelector("#countryName")!;
        countryNameDiv.textContent = countryName;
      });
      //reset style on mouseout
      layer.on("mouseout", (event: LeafletMouseEvent) => {
        const targetLayer = event.target;
        targetLayer.setStyle({
          fillColor: "clear",
          fillOpacity: 0.25,
        });
        //clear country name
        const countryNameDiv = document.querySelector("#countryName")!;
        countryNameDiv.textContent = "";
      });
      //zoom to country on click
      layer.on("click", (event: LeafletMouseEvent) => {
        map.fitBounds(event.target.getBounds() as leaflet.LatLngBoundsLiteral);
      });
    });
    geoJSONLayer.addTo(map);
  })
  .catch((error) => {
    console.error(error);
  });
