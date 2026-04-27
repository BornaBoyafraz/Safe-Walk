// Called by the Google Maps API loader once the script is ready
function initMap() {
  const downtown = { lat: 43.6532, lng: -79.3832 };

  const map = new google.maps.Map(document.getElementById('map'), {
    center: downtown,
    zoom: 13,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#212121' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#373737' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
      { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
      { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
      { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
      { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    ],
  });

  loadIncidentHeatmap(map);
}

async function loadIncidentHeatmap(map) {
  let geojson;
  try {
    const res = await fetch('/api/incidents');
    if (!res.ok) throw new Error(`/api/incidents returned ${res.status}`);
    geojson = await res.json();
  } catch (err) {
    console.error('Failed to load incidents:', err.message);
    return;
  }

  // GeoJSON coordinates are [lng, lat] — convert to LatLng objects for the heatmap
  const heatmapData = geojson.features.map(f => {
    const [lng, lat] = f.geometry.coordinates;
    return new google.maps.LatLng(lat, lng);
  });

  new google.maps.visualization.HeatmapLayer({
    data: heatmapData,
    map: map,
    radius: 20,
    opacity: 0.7,
    gradient: [
      'rgba(0, 0, 0, 0)',
      'rgba(255, 165, 0, 0.4)',
      'rgba(255, 100, 0, 0.6)',
      'rgba(255, 50, 0, 0.8)',
      'rgba(255, 0, 0, 1)',
    ],
  });

  console.log(`Heatmap loaded with ${heatmapData.length} incidents.`);
}
