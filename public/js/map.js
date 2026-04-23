async function initMap() {
  const res = await fetch('/api/config');
  const config = await res.json();

  if (!config.mapboxToken) {
    document.getElementById('map').innerHTML =
      '<p class="p-8 text-gray-600">Mapbox token not configured. Add MAPBOX_PUBLIC_TOKEN to your .env file.</p>';
    return;
  }

  mapboxgl.accessToken = config.mapboxToken;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-79.3832, 43.6532],  // downtown Toronto — Mapbox expects [lng, lat]
    zoom: 12
  });

  map.addControl(new mapboxgl.NavigationControl());

  map.on('load', () => {
    loadIncidents(map);
  });
}

async function loadIncidents(map) {
  const res = await fetch('/api/incidents');

  if (!res.ok) {
    console.error('Could not load incidents:', res.status);
    return;
  }

  const geojson = await res.json();
  console.log(`Loaded ${geojson.features.length} incidents`);

  map.addSource('incidents', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'incidents-heat',
    type: 'heatmap',
    source: 'incidents',
    maxzoom: 16,
    paint: {
      'heatmap-weight': 1,

      // Denser clusters appear hotter as you zoom in
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        10, 0.5,
        16, 3
      ],

      // Warm color ramp: transparent → yellow → orange → red → dark red
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.2, 'rgb(254,235,177)',
        0.4, 'rgb(254,186,92)',
        0.6, 'rgb(241,105,19)',
        0.8, 'rgb(210,52,19)',
        1.0, 'rgb(128,0,38)'
      ],

      // Radius grows with zoom so hotspots become spatially precise
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 8,
        14, 20,
        16, 30
      ],

      // Fade out at high zoom where the basemap detail matters more
      'heatmap-opacity': [
        'interpolate', ['linear'], ['zoom'],
        14, 0.8,
        18, 0.2
      ]
    }
  });
}

initMap();
