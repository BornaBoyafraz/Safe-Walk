'use client';

const GOOGLE_MAPS_ERROR_HINTS: Array<[RegExp, string]> = [
  [
    /MissingKeyMapError|NoApiKeys|API key is missing/i,
    'Google Maps browser key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in local and Vercel environments.',
  ],
  [
    /InvalidKeyMapError|invalid api key|MalformedCredentialsMapError/i,
    'Google rejected the browser key. Check that NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is copied correctly.',
  ],
  [
    /RefererNotAllowedMapError|not authorized.*URL|referrer/i,
    'Google blocked this domain. Add the current origin to the browser key HTTP referrer restrictions.',
  ],
  [
    /ApiNotActivatedMapError|ApiTargetBlockedMapError|not authorized to use this service|This API project is not authorized/i,
    'A required Google Maps API is disabled or blocked by API restrictions. Enable Maps JavaScript API and Places API for the browser key.',
  ],
  [
    /BillingNotEnabledMapError|billing/i,
    'Google Maps billing is not enabled for this project.',
  ],
  [
    /OverQuotaMapError|quota|rate limit/i,
    'Google Maps quota was exceeded or rate-limited. Check quotas and billing in Google Cloud Console.',
  ],
  [
    /timeout|timed out|network|fetch/i,
    'Google Maps did not load in time. Check network access, browser extensions, and whether maps.googleapis.com is reachable.',
  ],
];

export function explainGoogleMapsError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  for (const [pattern, message] of GOOGLE_MAPS_ERROR_HINTS) {
    if (pattern.test(raw)) return message;
  }

  return `Google Maps failed to initialize. Open the browser console for the original Maps error: ${raw}`;
}

export function browserKeyMissingMessage() {
  return 'Google Maps browser key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, then redeploy or restart the dev server.';
}
