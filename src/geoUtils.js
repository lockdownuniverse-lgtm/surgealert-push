// src/geoUtils.js
// Haversine distance formula — returns distance in km between two lat/lon points

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert meters to degrees latitude (approximate)
function metersToDegLat(meters) {
  return meters / 111320;
}

// Convert meters to degrees longitude at a given latitude
function metersToDegLon(meters, lat) {
  return meters / (111320 * Math.cos((lat * Math.PI) / 180));
}

// Build a bounding box around a point for fast pre-filtering
function boundingBox(lat, lon, radiusKm) {
  const r = radiusKm * 1000;
  return {
    minLat: lat - metersToDegLat(r),
    maxLat: lat + metersToDegLat(r),
    minLon: lon - metersToDegLon(r, lat),
    maxLon: lon + metersToDegLon(r, lat),
  };
}

module.exports = { haversine, boundingBox };
