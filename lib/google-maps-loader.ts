'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let loadPromise: Promise<void> | null = null;
let configuredKey: string | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing.'));
  }

  if (!loadPromise) {
    configuredKey = apiKey;
    setOptions({
      key: apiKey,
      v: 'weekly',
      libraries: ['places', 'visualization'],
    });

    loadPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('visualization'),
    ]).then(() => undefined);
  } else if (configuredKey !== apiKey) {
    return Promise.reject(new Error('Google Maps was already initialized with a different API key.'));
  }

  return loadPromise;
}
