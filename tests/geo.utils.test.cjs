const test = require('node:test');
const assert = require('node:assert/strict');
const { GeoUtils } = require('../dist/core/utils/geo.utils.js');

test('Haversine distance is zero for identical coordinates', () => {
  const point = { lat: 21.0285, lng: 105.8542 };
  assert.equal(GeoUtils.calculateDistanceMeters(point, point), 0);
});

test('Haversine distance is symmetric and positive for distinct coordinates', () => {
  const a = { lat: 21.0285, lng: 105.8542 };
  const b = { lat: 21.0385, lng: 105.8542 };
  assert.equal(GeoUtils.calculateDistanceMeters(a, b), GeoUtils.calculateDistanceMeters(b, a));
  assert.ok(GeoUtils.calculateDistanceMeters(a, b) > 1000);
});

test('bounding box accepts nearby points and rejects distant points', () => {
  const center = { lat: 21.0285, lng: 105.8542 };
  assert.equal(GeoUtils.isWithinBoundingBox(center, { lat: 21.03, lng: 105.855 }, 6), true);
  assert.equal(GeoUtils.isWithinBoundingBox(center, { lat: 21.2, lng: 105.85 }, 6), false);
});
