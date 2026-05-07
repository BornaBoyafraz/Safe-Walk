export function darkMapStyles(): google.maps.MapTypeStyle[] {
  return [
    { elementType: 'geometry',           stylers: [{ color: '#1a1a1f' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1f' }] },
    { elementType: 'labels.text.fill',   stylers: [{ color: '#6b6b7a' }] },
    { featureType: 'road',               elementType: 'geometry',          stylers: [{ color: '#2d2d35' }] },
    { featureType: 'road',               elementType: 'labels.text.fill',  stylers: [{ color: '#7a7a88' }] },
    { featureType: 'road.arterial',      elementType: 'geometry',          stylers: [{ color: '#2d2d35' }] },
    { featureType: 'road.highway',       elementType: 'geometry',          stylers: [{ color: '#333340' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#3a3a48' }] },
    { featureType: 'water',              elementType: 'geometry',          stylers: [{ color: '#0a0a0f' }] },
    { featureType: 'water',              elementType: 'labels.text.fill',  stylers: [{ color: '#2a2a35' }] },
    { featureType: 'poi',                elementType: 'geometry',          stylers: [{ color: '#222228' }] },
    { featureType: 'poi.park',           elementType: 'geometry',          stylers: [{ color: '#141c14' }] },
    { featureType: 'transit',            elementType: 'geometry',          stylers: [{ color: '#252532' }] },
    { featureType: 'administrative',     elementType: 'geometry',          stylers: [{ color: '#5a5a6a' }] },
    { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#aaaabc' }] },
  ];
}
