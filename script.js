// ---------- 1) Find the HTML elements ----------
const form = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const locBtn = document.getElementById("locBtn");
const message = document.getElementById("message");
const suggestions = document.getElementById("suggestions");
const result = document.getElementById("result");

let currentPlace = null;
let refreshTimer = null;

// ---------- 2) Weather code -> words ----------
const weatherCodes = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy",
  45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
};

function placeLabel(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

// ---------- 3) Search a real location ----------
async function searchCity(query) {
  message.textContent = "Searching...";
  suggestions.innerHTML = "";
  result.hidden = true;

  try {
    const url = "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(query) + "&count=5&language=en";
    const data = await (await fetch(url)).json();

    if (!data.results) {
      message.textContent = "Location not found. Check the spelling and try again.";
      return;
    }
    if (data.results.length === 1) {
      loadWeather(data.results[0]);
      return;
    }

    message.textContent = "Select your location:";
    data.results.forEach(function (place) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = placeLabel(place);
      btn.addEventListener("click", function () {
        suggestions.innerHTML = "";
        loadWeather(place);
      });
      li.appendChild(btn);
      suggestions.appendChild(li);
    });
  } catch (error) {
    message.textContent = "Could not search. Check your internet and try again.";
  }
}

// ---------- 4) Get LIVE weather + 5 day forecast ----------
async function loadWeather(place, silent) {
  if (!silent) {
    message.textContent = "Loading live weather...";
    result.hidden = true;
  }

  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + place.latitude +
      "&longitude=" + place.longitude +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&forecast_days=6&timezone=auto";
    const data = await (await fetch(url)).json();

    currentPlace = place;
    showWeather(place, data.current);
    showForecast(data.daily);
    message.textContent = "";
    startAutoRefresh();
  } catch (error) {
    message.textContent = "Could not load weather. Check your internet and try again.";
  }
}

// ---------- 5) Show current weather ----------
function showWeather(place, current) {
  document.getElementById("place").textContent = placeLabel(place);
  document.getElementById("temp").textContent = Math.round(current.temperature_2m) + "°";
  document.getElementById("condition").textContent =
    weatherCodes[current.weather_code] || "Weather unavailable";
  document.getElementById("feels").textContent = Math.round(current.apparent_temperature) + "°C";
  document.getElementById("humidity").textContent = current.relative_humidity_2m + "%";
  document.getElementById("wind").textContent = current.wind_speed_10m + " km/h";
  document.getElementById("updated").textContent =
    "Updated " + current.time.replace("T", " ") + " local time";
  setBackground(current.weather_code);
  result.hidden = false;
}

// ---------- 6) Show next 5 days (vertical list) ----------
function showForecast(daily) {
  const list = document.getElementById("forecast");
  list.innerHTML = "";

  // index 0 is today, so we show days 1 to 5
  for (let i = 1; i <= 5; i++) {
    const dayName = new Date(daily.time[i] + "T00:00:00")
      .toLocaleDateString("en-US", { weekday: "long" });

    const li = document.createElement("li");

    const day = document.createElement("span");
    day.className = "f-day";
    day.textContent = dayName;

    const temps = document.createElement("span");
    temps.className = "f-temps";
    temps.textContent = Math.round(daily.temperature_2m_max[i]) + "°";
    const low = document.createElement("span");
    low.textContent = Math.round(daily.temperature_2m_min[i]) + "°";
    temps.appendChild(low);

    const cond = document.createElement("span");
    cond.className = "f-cond";
    cond.textContent = weatherCodes[daily.weather_code[i]] || "";

    li.appendChild(day);
    li.appendChild(temps);
    li.appendChild(cond);
    list.appendChild(li);
  }
}

// ---------- 7) Background by weather ----------
function setBackground(code) {
  let type = "cloudy";
  if (code === 0 || code === 1) type = "clear";
  else if (code >= 51 && code <= 67) type = "rain";
  else if (code >= 80 && code <= 82) type = "rain";
  else if (code >= 71 && code <= 77) type = "snow";
  else if (code >= 95) type = "storm";

  document.body.classList.remove("clear", "cloudy", "rain", "snow", "storm");
  document.body.classList.add(type);
}

// ---------- 8) Auto refresh every 10 minutes ----------
function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(function () {
    if (currentPlace) loadWeather(currentPlace, true);
  }, 10 * 60 * 1000);
}

// ---------- 9) Use my current location ----------
function useMyLocation() {
  if (!navigator.geolocation) {
    message.textContent = "Your browser does not support location.";
    return;
  }
  message.textContent = "Finding your location... (allow location access)";
  suggestions.innerHTML = "";
  result.hidden = true;

  navigator.geolocation.getCurrentPosition(
    async function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      let place = { name: "Your location", latitude: lat, longitude: lon };

      try {
        const url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
          lat + "&longitude=" + lon + "&localityLanguage=en";
        const info = await (await fetch(url)).json();
        place = {
          name: info.city || info.locality || "Your location",
          admin1: info.principalSubdivision,
          country: info.countryName,
          latitude: lat,
          longitude: lon
        };
      } catch (error) { /* keep "Your location" */ }

      loadWeather(place);
    },
    function () {
      message.textContent = "Location blocked. Allow location access, or search a city instead.";
    }
  );
}

// ---------- 10) Events ----------
form.addEventListener("submit", function (event) {
  event.preventDefault();
  searchCity(cityInput.value.trim());
});
locBtn.addEventListener("click", useMyLocation);

useMyLocation();
