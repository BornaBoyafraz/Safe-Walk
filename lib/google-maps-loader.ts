'use client';

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { explainGoogleMapsError } from './google-maps-errors';

let loadPromise: Promise<void> | null = null;
let configuredKey: string | null = null;
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 12000;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Google Maps loader timed out after ${ms}ms.`));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps browser API key is missing.'));
  }

  if (!loadPromise) {
    configuredKey = apiKey;

    const authFailurePromise = new Promise<never>((_, reject) => {
      const previousAuthFailure = window.gm_authFailure;
      window.gm_authFailure = () => {
        previousAuthFailure?.();
        reject(new Error('Google Maps authentication failed. Check API key, referrer restrictions, enabled APIs, and billing.'));
      };
    });

    setOptions({
      key: apiKey,
      v: 'weekly',
      // Keep the full browser referrer available so Google Cloud wildcard
      // restrictions such as https://safewalk-two.vercel.app/* continue to match.
    });

    const importsPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('visualization'),
    ]).then(([mapsLibrary, placesLibrary, visualizationLibrary]) => {
      if (!mapsLibrary?.Map) {
        throw new Error('Maps JavaScript API loaded without the maps library.');
      }
      if (!placesLibrary?.Autocomplete) {
        throw new Error('Maps JavaScript API loaded without the Places Autocomplete library.');
      }
      if (!visualizationLibrary?.HeatmapLayer) {
        throw new Error('Maps JavaScript API loaded without the visualization library.');
      }
    });

    loadPromise = Promise.race([
      withTimeout(importsPromise, GOOGLE_MAPS_LOAD_TIMEOUT_MS),
      authFailurePromise,
    ]).catch((error) => {
      const message = explainGoogleMapsError(error);
      console.error('[Safe Walk] Google Maps load failed:', message, error);
      loadPromise = null;
      configuredKey = null;
      throw new Error(message);
    });
  } else if (configuredKey !== apiKey) {
    return Promise.reject(new Error('Google Maps was already initialized with a different API key.'));
  }

  return loadPromise;
}
