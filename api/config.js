module.exports = (req, res) => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  res.json({
    googleMapsApiKey: key,
    source: key ? 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY' : 'missing',
  });
};
