const Anthropic = require('@anthropic-ai/sdk');

// Only instantiate the client if the key is present — avoids crashing the server
// when the key isn't set yet.
let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Cache by rounded grid cell (~300m) + hour so repeated queries within a
// session don't trigger new API calls.
const cache = new Map();

function cacheKey(lat, lng, hour) {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${hour}`;
}

// Returns a 0–1 risk estimate (0 = safe, 1 = dangerous) using Claude,
// falling back to null if the key is missing, the call times out, or the
// response isn't a clean number. Caller must handle null.
async function estimateRisk(lat, lng, hour) {
  if (!client) return null;

  const key = cacheKey(lat, lng, hour);
  if (cache.has(key)) return cache.get(key);

  const timeLabel =
    hour >= 21 || hour < 5  ? 'late night (high-risk hours)' :
    hour >= 5  && hour < 7  ? 'early morning' :
    hour >= 7  && hour < 19 ? 'daytime' :
                              'evening';

  const prompt = `You are a pedestrian safety scoring engine for Toronto, Canada.

Rate the pedestrian safety risk for this location:
- Latitude: ${lat.toFixed(4)}, Longitude: ${lng.toFixed(4)}
- Time: ${hour}:00 (${timeLabel})
- Context: this area has very few recorded crime incidents in police data, so your estimate fills the gap.

Return ONLY a single decimal number between 0.00 and 1.00 where:
  0.00 = very safe (busy, well-lit, low-crime Toronto neighbourhood)
  1.00 = high risk (isolated, poorly lit, known problem area)

Base your estimate on your knowledge of Toronto's geography, neighbourhood character, and typical pedestrian safety patterns. Output the number only — no explanation.`;

  try {
    // Race against a 4-second timeout so a slow API call never blocks routing
    const response = await Promise.race([
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);

    const raw = response.content[0]?.text?.trim();
    const score = parseFloat(raw);

    if (!isFinite(score) || score < 0 || score > 1) {
      console.warn(`Claude returned unexpected safety score "${raw}" — ignoring`);
      return null;
    }

    cache.set(key, score);
    return score;
  } catch (err) {
    if (err.message !== 'timeout') {
      console.warn('Claude risk estimate failed:', err.message);
    }
    return null;
  }
}

module.exports = { estimateRisk };
