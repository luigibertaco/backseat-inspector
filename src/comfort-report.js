const LOW_ACCURACY_THRESHOLD_METERS = 30;
const EARTH_RADIUS_METERS = 6371000;

export function createComfortReport(trip) {
  const durationSeconds = calculateDurationSeconds(trip?.timestamps);
  const gpsSamples = Array.isArray(trip?.streams?.gps) ? trip.streams.gps : [];
  const approximateDistanceMeters = calculateApproximateDistanceMeters(gpsSamples);

  return {
    tripId: trip?.tripId ?? null,
    durationSeconds,
    gps: {
      pointCount: gpsSamples.length,
      approximateDistanceMeters,
      averageSpeedMetersPerSecond:
        durationSeconds > 0 ? approximateDistanceMeters / durationSeconds : 0,
      maximumSpeedMetersPerSecond: calculateMaximumSpeedMetersPerSecond(gpsSamples),
      lowAccuracySamplePercentage: calculateLowAccuracySamplePercentage(gpsSamples),
    },
  };
}

function calculateDurationSeconds(timestamps = {}) {
  const startedAtMs = Date.parse(timestamps.startedAt);
  const finishedAtMs = Date.parse(timestamps.finishedAt);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs)) {
    return 0;
  }

  return Math.max(0, Math.round((finishedAtMs - startedAtMs) / 1000));
}

function calculateApproximateDistanceMeters(samples) {
  let distance = 0;

  for (let index = 1; index < samples.length; index += 1) {
    distance += distanceBetween(samples[index - 1], samples[index]);
  }

  return distance;
}

function calculateMaximumSpeedMetersPerSecond(samples) {
  const speeds = samples
    .map((sample) => sample.speedMetersPerSecond)
    .filter(Number.isFinite);

  return speeds.length > 0 ? Math.max(...speeds) : 0;
}

function calculateLowAccuracySamplePercentage(samples) {
  if (samples.length === 0) {
    return 0;
  }

  const lowAccuracySamples = samples.filter(
    (sample) =>
      Number.isFinite(sample.accuracyMeters) &&
      sample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS,
  );

  return Math.round((lowAccuracySamples.length / samples.length) * 100);
}

function distanceBetween(start, end) {
  if (!hasCoordinates(start) || !hasCoordinates(end)) {
    return 0;
  }

  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function hasCoordinates(sample) {
  return Number.isFinite(sample?.latitude) && Number.isFinite(sample?.longitude);
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
