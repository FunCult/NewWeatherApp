/* ===============================
   FUNCULT Weather — OpenWeather (keyed)
   Drop this file in as app.js
   =============================== */

const API_KEY = "159579a67bddf3fe42a90d0145993baf"; // ← your key
const DEFAULT_CITY = "Hermosa Beach, US";

/* ---------- State ---------- */
let currentUnits = "metric"; // "metric" | "imperial"
let lastCityLabel = DEFAULT_CITY;
let lastCoords = null; // { lat, lon }
let celsiusTemperature = null; // baseline in °C
let windMS = null; // baseline in m/s
let forecastList = []; // raw 3h forecast list

/* ---------- DOM ---------- */
const elCity = document.getElementById("city");
const elTemp = document.getElementById("temperature");
const elDesc = document.getElementById("description");
const elHumidity = document.getElementById("humidity");
const elWind = document.getElementById("wind");
const elWindUnit = document.getElementById("wind-unit");
const elDate = document.getElementById("date");
const elIcon = document.getElementById("icon");
const elForecast = document.getElementById("forecast");

const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const acList = document.getElementById("ac-list");

const cLink = document.getElementById("celsius-link");
const fLink = document.getElementById("fahrenheit-link");
const wheelBtn = document.getElementById("current-location-button");

// Favorites (optional: only used if present)
const favBar = document.getElementById("favBar");
const saveFavBtn = document.getElementById("saveFav");

/* ---------- Helpers ---------- */
function formatDate(tsMs) {
  const d = new Date(tsMs);
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} ${hh}:${mm} 🕙(✿◠‿◠)`;
}

function toF(c) {
  return (c * 9) / 5 + 32;
}
function msToMph(ms) {
  return ms * 2.23694;
}

/* ---------- OpenWeather API ---------- */
// Geocoding suggestions (autocomplete)
async function geocodeSuggest(q) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
    q
  )}&limit=5&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

// Current weather (metric baseline)
async function weatherByCityLabel(label) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    label
  )}&appid=${API_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather failed");
  return res.json();
}
async function weatherByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather failed");
  return res.json();
}

// 5-day / 3-hour forecast (metric baseline)
async function forecastByCityLabel(label) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
    label
  )}&appid=${API_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Forecast failed");
  return res.json();
}
async function forecastByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Forecast failed");
  return res.json();
}

/* ---------- Renderers ---------- */
function renderCurrent(data) {
  // Save baselines in metric for quick °C/°F toggle
  celsiusTemperature = data.main?.temp ?? null;
  windMS = data.wind?.speed ?? null;

  elCity.textContent = data.name || lastCityLabel;
  elDesc.textContent = data.weather?.[0]?.description || "—";
  elHumidity.textContent = data.main?.humidity ?? "--";
  elDate.textContent = formatDate((data.dt || Date.now() / 1000) * 1000);

  const icon = data.weather?.[0]?.icon || "01d";
  elIcon.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  elIcon.alt = data.weather?.[0]?.description || "weather icon";

  if (currentUnits === "metric") {
    elTemp.textContent =
      celsiusTemperature == null ? "--" : Math.round(celsiusTemperature);
    elWind.textContent = windMS == null ? "--" : Math.round(windMS);
    elWindUnit.textContent = "m/s";
  } else {
    elTemp.textContent =
      celsiusTemperature == null ? "--" : Math.round(toF(celsiusTemperature));
    elWind.textContent = windMS == null ? "--" : Math.round(msToMph(windMS));
    elWindUnit.textContent = "mph";
  }
}

// Choose ~noon per day for compact forecast cards
function pickNoonForecasts(list) {
  const byDay = {};
  list.forEach((item) => {
    const d = new Date(item.dt * 1000);
    const key = d.toLocaleDateString();
    const score = Math.abs(12 - d.getHours());
    if (!(key in byDay) || score < byDay[key].score) {
      byDay[key] = { item, score };
    }
  });
  return Object.values(byDay)
    .slice(0, 6)
    .map((x) => x.item);
}

function renderForecast() {
  if (!forecastList || !forecastList.length) {
    elForecast.innerHTML = "";
    return;
  }
  const isMetric = currentUnits === "metric";
  const noonish = pickNoonForecasts(forecastList);

  elForecast.innerHTML = noonish
    .map((f) => {
      const tC = f.main?.temp ?? null;
      const t = tC == null ? "--" : Math.round(isMetric ? tC : toF(tC));
      const icon = f.weather?.[0]?.icon || "01d";
      const desc = f.weather?.[0]?.description || "";
      const label = new Date(f.dt * 1000).toLocaleDateString(undefined, {
        weekday: "short",
      });
      return `
      <div class="day" title="${desc}">
        <div>${label}</div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" width="42" height="42"/>
        <div><strong>${t}°</strong></div>
      </div>`;
    })
    .join("");
}

/* ---------- Flows ---------- */
async function searchCity(label) {
  try {
    lastCityLabel = label;
    const [w, f] = await Promise.all([
      weatherByCityLabel(label),
      forecastByCityLabel(label),
    ]);
    lastCoords = w.coord || null;
    forecastList = f.list || [];
    renderCurrent(w);
    renderForecast();
  } catch (err) {
    // graceful fallback
    elCity.textContent = "City not found";
    elTemp.textContent = "--";
    elDesc.textContent = "—";
    elHumidity.textContent = "--";
    elWind.textContent = "--";
    elDate.textContent = "";
    elIcon.src = "https://openweathermap.org/img/wn/01d@2x.png";
    elForecast.innerHTML = "";
  }
}

async function showPosition(pos) {
  try {
    const lat = pos.coords.latitude,
      lon = pos.coords.longitude;
    const [w, f] = await Promise.all([
      weatherByCoords(lat, lon),
      forecastByCoords(lat, lon),
    ]);
    lastCoords = { lat, lon };
    lastCityLabel = w.name || "Your location";
    forecastList = f.list || [];
    renderCurrent(w);
    renderForecast();
  } catch {
    alert("Could not load your location weather.");
  }
}

/* ---------- Units toggle ---------- */
function setUnits(u) {
  if (u === currentUnits) return;
  currentUnits = u;

  // Toggle link styles if present
  if (cLink && fLink) {
    if (currentUnits === "metric") {
      cLink.classList.add("active");
      fLink.classList.remove("active");
    } else {
      cLink.classList.remove("active");
      fLink.classList.add("active");
    }
  }

  // Re-render using stored baselines
  if (celsiusTemperature != null) {
    if (currentUnits === "metric") {
      elTemp.textContent = Math.round(celsiusTemperature);
      elWind.textContent = windMS == null ? "--" : Math.round(windMS);
      elWindUnit.textContent = "m/s";
    } else {
      elTemp.textContent = Math.round(toF(celsiusTemperature));
      elWind.textContent = windMS == null ? "--" : Math.round(msToMph(windMS));
      elWindUnit.textContent = "mph";
    }
  }
  renderForecast();
}

/* ---------- Events ---------- */
// °C / °F links
if (cLink)
  cLink.addEventListener("click", (e) => {
    e.preventDefault();
    setUnits("metric");
  });
if (fLink)
  fLink.addEventListener("click", (e) => {
    e.preventDefault();
    setUnits("imperial");
  });

// Form search
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (cityInput.value || "").trim();
    if (!v) return;
    await searchCity(v);
    if (acList) acList.classList.add("d-none");
  });
}

// Geolocation (wheel button)
if (wheelBtn) {
  wheelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(showPosition, () =>
      alert("Unable to get your location.")
    );
  });
}

/* ---------- Autocomplete ---------- */
let acTimer = null;
if (cityInput) {
  cityInput.addEventListener("input", () => {
    const q = cityInput.value.trim();
    clearTimeout(acTimer);
    if (!acList) return;
    if (!q) {
      acList.classList.add("d-none");
      acList.innerHTML = "";
      return;
    }
    acTimer = setTimeout(() => fetchAC(q), 250);
  });
}

async function fetchAC(q) {
  try {
    const data = await geocodeSuggest(q);
    if (!acList) return;
    if (!data || !data.length) {
      acList.classList.add("d-none");
      acList.innerHTML = "";
      return;
    }
    acList.innerHTML = data
      .map((item) => {
        const label = [item.name, item.state, item.country]
          .filter(Boolean)
          .join(", ");
        const lat = (item.lat ?? item.latitude).toFixed(2);
        const lon = (item.lon ?? item.longitude).toFixed(2);
        return `<div class="ac-item" data-label="${label.replace(
          /"/g,
          "&quot;"
        )}">${label} <span class="muted">(${lat}, ${lon})</span></div>`;
      })
      .join("");
    acList.classList.remove("d-none");
  } catch {
    if (!acList) return;
    acList.classList.add("d-none");
    acList.innerHTML = "";
  }
}

if (acList) {
  acList.addEventListener("click", async (e) => {
    const item = e.target.closest(".ac-item");
    if (!item) return;
    const label = item.getAttribute("data-label");
    cityInput.value = label;
    acList.classList.add("d-none");
    await searchCity(label);
  });

  document.addEventListener("click", (e) => {
    if (!acList.contains(e.target) && e.target !== cityInput) {
      acList.classList.add("d-none");
    }
  });
}

/* ---------- Favorites (optional) ---------- */
const LS_KEY = "funcult:favorites";
function getFavs() {
  try {
    const a = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function renderFavs(arr) {
  if (!favBar) return;
  favBar.innerHTML = arr
    .map(
      (label) =>
        `<span class="chip" data-label="${label}">${label}<span class="del" title="remove"> ✖</span></span>`
    )
    .join("");
}
function loadFavs() {
  if (!favBar) return;
  const arr = getFavs();
  if (arr.length) renderFavs(arr);
  else {
    const seed = [
      "Hermosa Beach, US",
      "Barcelona, ES",
      "Tokyo, JP",
      "Copenhagen, DK",
      "Melbourne, AU",
    ];
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
    renderFavs(seed);
  }
}
if (favBar) {
  favBar.addEventListener("click", async (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const label = chip.getAttribute("data-label");
    if (e.target.classList.contains("del")) {
      const arr = getFavs().filter((x) => x !== label);
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
      renderFavs(arr);
    } else {
      await searchCity(label);
    }
  });
}
if (saveFavBtn) {
  saveFavBtn.addEventListener("click", () => {
    const label =
      elCity?.textContent || cityInput?.value?.trim() || lastCityLabel;
    if (!label) return;
    const arr = getFavs();
    if (!arr.includes(label)) {
      arr.unshift(label);
      localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 12)));
      renderFavs(arr.slice(0, 12));
    }
  });
}

/* ---------- Boot ---------- */
if (favBar) loadFavs();
searchCity(DEFAULT_CITY);
