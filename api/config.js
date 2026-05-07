module.exports = (req, res) => {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const localFallback =
    process.env.NODE_ENV !== 'production'
      ? process.env.GOOGLE_MAPS_API_KEY || ''
      : '';

  res.json({
    googleMapsApiKey: browserKey || localFallback,
    source: browserKey ? 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY' : localFallback ? 'GOOGLE_MAPS_API_KEY_DEV_FALLBACK' : 'missing',
  });
};
