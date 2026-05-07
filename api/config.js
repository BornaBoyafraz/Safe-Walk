module.exports = (req, res) => {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const oneKeyFallback = process.env.GOOGLE_MAPS_API_KEY || '';
  const key = browserKey || oneKeyFallback;

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({
    googleMapsApiKey: key,
    source: browserKey
      ? 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
      : oneKeyFallback
        ? 'GOOGLE_MAPS_API_KEY_ONE_KEY_FALLBACK'
        : 'missing',
  });
};
