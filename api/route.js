const { computeRoutes, RouteApiError } = require('../server/routes-api');

function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeAddress(value, field) {
  if (typeof value !== 'string') {
    throw new RouteApiError(`${field} must be a string.`, 400, 'INVALID_ROUTE_REQUEST');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RouteApiError(`${field} is required.`, 400, 'INVALID_ROUTE_REQUEST');
  }
  return trimmed;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const body = parseJsonMaybe(req.body) || {};
    const origin = normalizeAddress(body.origin, 'origin');
    const destination = normalizeAddress(body.destination, 'destination');

    console.log('[route] route request received', {
      originChars: origin.length,
      destinationChars: destination.length,
    });

    const result = await computeRoutes(origin, destination);
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[route] route request failed', {
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      statusCode,
      message: err.message,
      details: err.details,
    });

    res.status(statusCode).json({
      error: err.message || 'Route computation failed.',
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      details: err.details,
    });
  }
};
