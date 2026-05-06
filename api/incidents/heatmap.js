const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const jsonPath = path.join(process.cwd(), 'public', 'data', 'heatmap.json');

  try {
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', 'application/json');
      return res.send(data);
    }
  } catch (e) {
    // fall through to empty response
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json([]);
};
