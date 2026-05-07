'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let map;
let routeData       = null;
let fastestPolyline = null;
let safestPolyline  = null;
let originMarker    = null;
let destMarker      = null;
let activeMode      = 'safest';
let heatmapLayer    = null;
let incidentCache   = null;
let streetlightMarkers = [];

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Fetch the API key from the server, then inject the Maps script dynamically
// so the key never appears in the HTML source.

// Google calls this global function when the API key fails authentication.
// Without it, auth failures are completely silent in the UI.
window.gm_authFailure = function () {
  console.error('[SafeWalk] Google Maps authentication failed. The API key is missing, invalid, or has incorrect restrictions.');
  showError(
    'Google Maps failed to authenticate. Check that the API key is valid and has Maps JavaScript API, Places API, and Routes API enabled with no HTTP referrer restrictions blocking server calls.'
  );
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      console.error('[SafeWalk] /api/config returned', res.status);
      throw new Error('Config endpoint returned ' + res.status);
    }
    const { googleMapsApiKey } = await res.json();

    if (!googleMapsApiKey) {
      console.error('[SafeWalk] GOOGLE_MAPS_API_KEY is not set in environment variables.');
      showError('Google Maps API key is not configured on the server. Set GOOGLE_MAPS_API_KEY in your environment.');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,visualization&callback=initMap&loading=async`;
    script.async = true;
    script.onerror = () => {
      console.error('[SafeWalk] Google Maps script failed to load (network error or CSP block).');
      showError('Google Maps failed to load. Check your network connection and that the API key is valid.');
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error('[SafeWalk] Bootstrap error:', err.message);
    showError('Could not connect to server: ' + err.message);
  }
});

// ─── Map init (called by Google Maps loader as callback) ──────────────────────
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 43.6532, lng: -79.3832 },
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: true,
    styles: darkMapStyles(),
  });

  setupAutocomplete();
  setupFindButton();
  setupModeTabs();
  setupHeatmapToggle();
  setupStreetlightLayer();

  // Preload heatmap data in background so toggle is instant
  setTimeout(async () => {
    try {
      const res = await fetch('/api/incidents/heatmap');
      if (res.ok) {
        const rows = await res.json();
        incidentCache = rows.map(r => new google.maps.LatLng(r.lat, r.lng));
      }
    } catch (e) { /* silent fail — will load on demand */ }
  }, 2000);
}

window.initMap = initMap;

// ─── Autocomplete ─────────────────────────────────────────────────────────────
function setupAutocomplete() {
  const torontoBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(43.58, -79.64),
    new google.maps.LatLng(43.86, -79.12)
  );
  const opts = { bounds: torontoBounds, strictBounds: false };

  new google.maps.places.Autocomplete(document.getElementById('from-input'), opts);
  new google.maps.places.Autocomplete(document.getElementById('to-input'),   opts);
}

// ─── Find Route button ────────────────────────────────────────────────────────
function setupFindButton() {
  document.getElementById('find-btn').addEventListener('click', findRoute);

  // Also trigger on Enter key in either input
  ['from-input', 'to-input'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') findRoute();
    });
  });
}

async function findRoute() {
  const origin      = document.getElementById('from-input').value.trim();
  const destination = document.getElementById('to-input').value.trim();

  if (!origin || !destination) {
    showError('Enter both a start location and a destination.');
    return;
  }

  setLoading(true);
  clearRoutes();
  hideError();

  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Route computation failed.');

    routeData = data;
    drawRoutes(data);
    showInfoPanel(data, activeMode);
  } catch (err) {
    showError(err.message);
    showEmptyState();
  } finally {
    setLoading(false);
  }
}

// ─── Mode tabs ────────────────────────────────────────────────────────────────
function setupModeTabs() {
  document.getElementById('tab-safest').addEventListener('click',  () => switchMode('safest'));
  document.getElementById('tab-fastest').addEventListener('click', () => switchMode('fastest'));
}

function switchMode(mode) {
  activeMode = mode;

  document.getElementById('tab-safest').className  = 'tab-' + (mode === 'safest'  ? 'active' : 'inactive') + ' flex-1 py-2';
  document.getElementById('tab-fastest').className = 'tab-' + (mode === 'fastest' ? 'active' : 'inactive') + ' flex-1 py-2';

  if (fastestPolyline) fastestPolyline.setOptions(polylineStyle(mode === 'fastest', 'fastest'));
  if (safestPolyline)  safestPolyline.setOptions(polylineStyle(mode === 'safest',   'safest'));

  if (routeData) showInfoPanel(routeData, mode);
}

// ─── Polyline decoder (Google encoded polyline algorithm) ─────────────────────
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let result = 0, shift = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0; shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ─── Route drawing ────────────────────────────────────────────────────────────
function polylineStyle(isActive, type) {
  if (!isActive) return { strokeWeight: 3, strokeColor: '#666666', strokeOpacity: 0.4 };
  return {
    strokeWeight: 6,
    strokeColor: type === 'fastest' ? '#4285F4' : '#34A853',
    strokeOpacity: 1,
  };
}

function drawRoutes(data) {
  const fastestPoints = decodePolyline(data.fastest.polyline);
  const safestPoints  = decodePolyline(data.safest.polyline);

  // Draw background route first so active route renders on top
  if (activeMode === 'safest') {
    fastestPolyline = newPolyline(fastestPoints, polylineStyle(false, 'fastest'));
    safestPolyline  = newPolyline(safestPoints,  polylineStyle(true,  'safest'));
  } else {
    safestPolyline  = newPolyline(safestPoints,  polylineStyle(false, 'safest'));
    fastestPolyline = newPolyline(fastestPoints, polylineStyle(true,  'fastest'));
  }

  // Fit map to show both routes
  const bounds = new google.maps.LatLngBounds();
  [...fastestPoints, ...safestPoints].forEach(p => bounds.extend(p));
  map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });

  // Place origin and destination markers
  placeMarkers(fastestPoints[0], fastestPoints[fastestPoints.length - 1]);
}

function newPolyline(path, options) {
  return new google.maps.Polyline({ path, map, ...options });
}

function placeMarkers(origin, dest) {
  if (originMarker) originMarker.setMap(null);
  if (destMarker)   destMarker.setMap(null);

  originMarker = new google.maps.Marker({
    position: origin,
    map,
    zIndex: 10,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: '#1a1a2e',
      strokeWeight: 2,
    },
  });

  destMarker = new google.maps.Marker({
    position: dest,
    map,
    zIndex: 10,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: '#34A853',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
  });
}

function clearRoutes() {
  [fastestPolyline, safestPolyline, originMarker, destMarker].forEach(obj => obj?.setMap(null));
  fastestPolyline = safestPolyline = originMarker = destMarker = null;
  routeData = null;
  document.getElementById('info-panel').classList.add('hidden');
  showEmptyState();
}

// ─── Info panel ───────────────────────────────────────────────────────────────
function showInfoPanel(data, mode) {
  const route = mode === 'safest' ? data.safest : data.fastest;

  const mins = Math.round(parseInt(route.duration) / 60);
  const km   = (route.distanceMeters / 1000).toFixed(1);
  const pct  = Math.round((1 - route.safety_score) * 100);

  document.getElementById('info-time').textContent     = mins + ' min';
  document.getElementById('info-distance').textContent = km + ' km';
  updateSafetyBar(pct);

  const compEl    = document.getElementById('comparison-text');
  const detailsEl = document.getElementById('safety-details');

  if (mode === 'safest' && data.fastest.polyline !== data.safest.polyline) {
    const fastestMins = Math.round(parseInt(data.fastest.duration) / 60);
    const fastestPct  = Math.round((1 - data.fastest.safety_score) * 100);
    const extraMins   = mins - fastestMins;
    const safetyGain  = pct - fastestPct;
    const scoreDiff   = Math.abs(data.fastest.safety_score - data.safest.safety_score);

    if (scoreDiff < 0.05) {
      compEl.textContent = 'Both routes have similar safety profiles for this trip.';
    } else if (extraMins <= 0 && safetyGain > 0) {
      compEl.textContent = `No extra time, and ${safetyGain}% safer — clearly the better route.`;
    } else if (extraMins > 0 && safetyGain > 0) {
      compEl.textContent = `${extraMins} min longer, but ${safetyGain}% safer than the fastest route.`;
    } else {
      compEl.textContent = `${extraMins > 0 ? extraMins + ' min longer' : 'Same time'} via a different path.`;
    }
    compEl.classList.remove('hidden');

    const avoided = (data.fastest.dangerous_segments || 0) - (data.safest.dangerous_segments || 0);
    if (avoided > 0) {
      detailsEl.textContent = `Avoids ${avoided} higher-risk segment${avoided > 1 ? 's' : ''} on the faster route.`;
      detailsEl.classList.remove('hidden');
    } else {
      detailsEl.classList.add('hidden');
    }
  } else if (mode === 'safest') {
    compEl.textContent = 'The fastest route is already the safest option here.';
    compEl.classList.remove('hidden');
    detailsEl.classList.add('hidden');
  } else {
    compEl.classList.add('hidden');
    detailsEl.classList.add('hidden');
  }

  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('info-panel').classList.remove('hidden');
}

function updateSafetyBar(pct) {
  const fill  = document.getElementById('safety-bar-fill');
  const label = document.getElementById('safety-pct');
  const color = pct > 70 ? '#34A853' : pct > 40 ? '#FBBC04' : '#EA4335';

  fill.style.width           = pct + '%';
  fill.style.backgroundColor = color;
  label.textContent          = pct + '%';
  label.style.color          = color;
}

// ─── Loading / error / empty state ────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('find-btn').disabled = on;
  document.getElementById('loading').classList.toggle('hidden', !on);
  document.getElementById('empty-state').classList.add('hidden');
  if (on) document.getElementById('info-panel').classList.add('hidden');
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-msg').classList.add('hidden');
}

function showEmptyState() {
  document.getElementById('empty-state').classList.remove('hidden');
}

// ─── Heatmap layer (Google Maps native HeatmapLayer) ─────────────────────────
function setupHeatmapToggle() {
  const toggle = document.getElementById('heatmap-toggle');
  const label  = document.getElementById('heatmap-label');

  toggle.addEventListener('change', async e => {
    if (!e.target.checked) {
      if (heatmapLayer) heatmapLayer.setMap(null);
      if (heatmapZoomListener) {
        google.maps.event.removeListener(heatmapZoomListener);
        heatmapZoomListener = null;
      }
      return;
    }

    // Already built from preload or a previous toggle — show immediately
    if (incidentCache) {
      showHeatmap(incidentCache);
      return;
    }

    const origText = label.textContent;
    toggle.disabled = true;
    label.textContent = 'Loading...';

    try {
      const res = await fetch('/api/incidents/heatmap');
      if (!res.ok) throw new Error('/api/incidents/heatmap returned ' + res.status);
      const rows = await res.json();
      incidentCache = rows.map(r => new google.maps.LatLng(r.lat, r.lng));
      showHeatmap(incidentCache);
    } catch (err) {
      console.error('Heatmap load failed:', err.message);
      e.target.checked = false;
    } finally {
      toggle.disabled = false;
      label.textContent = origText;
    }
  });
}

// Ambient amber → deep red gradient — avoids pure-red saturation that reads as "entire city is dangerous"
const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,200,100,0)',
  'rgba(255,170,60,0.10)',
  'rgba(255,140,20,0.22)',
  'rgba(255,100,0,0.38)',
  'rgba(225,55,0,0.55)',
  'rgba(185,20,0,0.72)',
  'rgba(140,0,0,0.85)',
];

// Returns density rendering parameters scaled to the current map zoom level.
// At city scale only major hotspots register; at street scale precise clusters emerge.
function heatmapOptionsForZoom(z) {
  if (z <= 11) return { radius: 14, maxIntensity: 150, opacity: 0.40 };
  if (z <= 13) return { radius: 18, maxIntensity:  80, opacity: 0.48 };
  if (z <= 15) return { radius: 16, maxIntensity:  38, opacity: 0.56 };
  return               { radius: 11, maxIntensity:  16, opacity: 0.65 };
}

let heatmapZoomListener = null;

function showHeatmap(points) {
  if (heatmapLayer) {
    heatmapLayer.setMap(map);
    return;
  }

  const opts = heatmapOptionsForZoom(map.getZoom());
  heatmapLayer = new google.maps.visualization.HeatmapLayer({
    data: points,
    map: map,
    radius: opts.radius,
    maxIntensity: opts.maxIntensity,
    dissipating: true,
    opacity: opts.opacity,
    gradient: HEATMAP_GRADIENT,
  });

  // Re-tune density parameters whenever the user zooms in or out
  let rafPending = false;
  heatmapZoomListener = map.addListener('zoom_changed', () => {
    if (rafPending || !heatmapLayer || !heatmapLayer.getMap()) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      heatmapLayer.setOptions(heatmapOptionsForZoom(map.getZoom()));
    });
  });
}

// ─── Streetlight layer ────────────────────────────────────────────────────────
function setupStreetlightLayer() {
  map.addListener('idle', onMapIdle);
}

async function onMapIdle() {
  if (map.getZoom() < 15) {
    clearStreetlights();
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) return;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const params = new URLSearchParams({
    minLat: sw.lat(),
    maxLat: ne.lat(),
    minLng: sw.lng(),
    maxLng: ne.lng(),
  });

  try {
    const res = await fetch('/api/streetlights?' + params);
    if (!res.ok) return;
    const geojson = await res.json();

    clearStreetlights();

    streetlightMarkers = geojson.features.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      return new google.maps.Marker({
        position: { lat, lng },
        map,
        clickable: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: '#00E5FF',
          fillOpacity: 0.3,
          strokeWeight: 0,
        },
      });
    });
  } catch (err) {
    console.error('Streetlight fetch failed:', err.message);
  }
}

function clearStreetlights() {
  streetlightMarkers.forEach(m => m.setMap(null));
  streetlightMarkers = [];
}


// ─── Dark map style ────────────────────────────────────────────────────────────
function darkMapStyles() {
  return [
    { elementType: 'geometry',           stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
    { featureType: 'road',               elementType: 'geometry',          stylers: [{ color: '#373737' }] },
    { featureType: 'road',               elementType: 'labels.text.fill',  stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'road.arterial',      elementType: 'geometry',          stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway',       elementType: 'geometry',          stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
    { featureType: 'water',              elementType: 'geometry',          stylers: [{ color: '#000000' }] },
    { featureType: 'water',              elementType: 'labels.text.fill',  stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'poi',                elementType: 'geometry',          stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'poi.park',           elementType: 'geometry',          stylers: [{ color: '#1a2e1a' }] },
    { featureType: 'transit',            elementType: 'geometry',          stylers: [{ color: '#2f3948' }] },
    { featureType: 'administrative',     elementType: 'geometry',          stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  ];
}
