require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Deliver the Mapbox public token to the frontend without embedding it in static HTML
app.get('/api/config', (req, res) => {
  res.json({ mapboxToken: process.env.MAPBOX_PUBLIC_TOKEN || '' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Safe Walk running at http://localhost:${PORT}`);
});
