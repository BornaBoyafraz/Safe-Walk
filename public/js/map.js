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
let reportMarkers   = [];
let reportingMode   = false;
let pendingReportLatLng = null;
let mapClickListener = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Fetch the API key from the server, then inject the Maps script dynamically
// so the key never appears in the HTML source.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const { googleMapsApiKey } = await res.json();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=visualization,places&callback=initMap`;
    script.onerror = () => showError('Google Maps failed to load. Check that the API key has Maps JS, Places, and Routes APIs enabled.');
    document.head.appendChild(script);
  } catch (err) {
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
  setupReportsToggle();
  setupReportFlow();
  setupStreetlightLayer();
}

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

  const compEl = document.getElementById('comparison-text');
  if (mode === 'safest' && data.fastest.polyline !== data.safest.polyline) {
    const fastestMins = Math.round(parseInt(data.fastest.duration) / 60);
    const fastestPct  = Math.round((1 - data.fastest.safety_score) * 100);
    const extraMins   = mins - fastestMins;
    const safetyGain  = pct - fastestPct;

    if (extraMins <= 0 && safetyGain > 0) {
      compEl.textContent = `No extra time, and ${safetyGain}% safer — clearly the better route.`;
    } else if (extraMins > 0 && safetyGain > 0) {
      compEl.textContent = `${extraMins} min longer, but ${safetyGain}% safer than the fastest route.`;
    } else {
      compEl.textContent = `${extraMins > 0 ? extraMins + ' min longer' : 'Same time'} via a different path.`;
    }
    compEl.classList.remove('hidden');
  } else if (mode === 'safest') {
    compEl.textContent = 'The fastest route is already the safest option here.';
    compEl.classList.remove('hidden');
  } else {
    compEl.classList.add('hidden');
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

// ─── Heatmap layer ────────────────────────────────────────────────────────────
function setupHeatmapToggle() {
  document.getElementById('heatmap-toggle').addEventListener('change', async e => {
    if (!e.target.checked) {
      heatmapLayer?.setMap(null);
      return;
    }

    try {
      if (!incidentCache) {
        const res = await fetch('/api/incidents');
        if (!res.ok) throw new Error('/api/incidents returned ' + res.status);
        incidentCache = await res.json();
      }

      const points = incidentCache.features.map(f => {
        const [lng, lat] = f.geometry.coordinates;
        return new google.maps.LatLng(lat, lng);
      });

      if (!heatmapLayer) {
        heatmapLayer = new google.maps.visualization.HeatmapLayer({
          data: points,
          radius: 20,
          opacity: 0.7,
          gradient: [
            'rgba(0,0,0,0)',
            'rgba(255,165,0,0.4)',
            'rgba(255,100,0,0.6)',
            'rgba(255,50,0,0.8)',
            'rgba(255,0,0,1)',
          ],
        });
      }

      heatmapLayer.setMap(map);
    } catch (err) {
      console.error('Heatmap load failed:', err.message);
      e.target.checked = false;
    }
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

// ─── Community reports layer ──────────────────────────────────────────────────
function setupReportsToggle() {
  document.getElementById('reports-toggle').addEventListener('change', async e => {
    if (!e.target.checked) {
      clearReportMarkers();
      return;
    }
    await loadReportMarkers();
  });
}

async function loadReportMarkers() {
  try {
    const res = await fetch('/api/reports');
    if (!res.ok) return;
    const geojson = await res.json();

    clearReportMarkers();

    const iconColors = {
      harassment: '#EA4335',
      suspicious_activity: '#FBBC04',
      poor_lighting: '#00E5FF',
      other: '#9ca3af',
    };

    reportMarkers = geojson.features.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      const { category, note } = f.properties;
      const color = iconColors[category] || '#9ca3af';

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#1a1a2e',
          strokeWeight: 1.5,
        },
        title: category.replace('_', ' ') + (note ? ': ' + note : ''),
      });
      return marker;
    });
  } catch (err) {
    console.error('Failed to load community reports:', err.message);
  }
}

function clearReportMarkers() {
  reportMarkers.forEach(m => m.setMap(null));
  reportMarkers = [];
}

// ─── Report incident flow ─────────────────────────────────────────────────────
function setupReportFlow() {
  document.getElementById('report-btn').addEventListener('click', startReporting);
  document.getElementById('report-submit').addEventListener('click', submitReport);
  document.getElementById('report-cancel').addEventListener('click', cancelReporting);
}

function startReporting() {
  reportingMode = true;
  pendingReportLatLng = null;

  document.getElementById('report-panel').classList.remove('hidden');
  document.getElementById('report-prompt').textContent = 'Click anywhere on the map to place your report.';
  document.getElementById('report-fields').classList.add('hidden');
  document.getElementById('report-category').value = '';
  document.getElementById('report-note').value = '';

  // Change cursor to crosshair
  map.setOptions({ draggableCursor: 'crosshair' });

  mapClickListener = map.addListener('click', e => {
    pendingReportLatLng = e.latLng;

    // Drop a temporary marker
    if (window._tempReportMarker) window._tempReportMarker.setMap(null);
    window._tempReportMarker = new google.maps.Marker({
      position: e.latLng,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      zIndex: 20,
    });

    document.getElementById('report-prompt').textContent = 'Location set. What happened here?';
    document.getElementById('report-fields').classList.remove('hidden');
  });
}

async function submitReport() {
  if (!pendingReportLatLng) {
    document.getElementById('report-prompt').textContent = 'Click on the map first to set a location.';
    return;
  }

  const category = document.getElementById('report-category').value;
  if (!category) {
    document.getElementById('report-prompt').textContent = 'Please select a category.';
    return;
  }

  const note = document.getElementById('report-note').value.trim();
  const btn = document.getElementById('report-submit');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: pendingReportLatLng.lat(),
        lng: pendingReportLatLng.lng(),
        category,
        note: note || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }

    cancelReporting();

    // If reports layer is on, refresh it to show the new pin
    if (document.getElementById('reports-toggle').checked) {
      await loadReportMarkers();
    }

    // Brief success message
    const panel = document.getElementById('report-panel');
    panel.classList.remove('hidden');
    document.getElementById('report-prompt').textContent = 'Report submitted. Thank you.';
    document.getElementById('report-fields').classList.add('hidden');
    setTimeout(() => panel.classList.add('hidden'), 2500);
  } catch (err) {
    document.getElementById('report-prompt').textContent = 'Submit failed: ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Submit';
  }
}

function cancelReporting() {
  reportingMode = false;
  pendingReportLatLng = null;

  if (mapClickListener) {
    google.maps.event.removeListener(mapClickListener);
    mapClickListener = null;
  }
  if (window._tempReportMarker) {
    window._tempReportMarker.setMap(null);
    window._tempReportMarker = null;
  }

  map.setOptions({ draggableCursor: null });
  document.getElementById('report-panel').classList.add('hidden');
  document.getElementById('report-submit').disabled = false;
  document.getElementById('report-submit').textContent = 'Submit';
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
