import { detectComfortEvents } from "./comfort-events.js";

const LOW_ACCURACY_THRESHOLD_METERS = 30;
const EARTH_RADIUS_METERS = 6371000;
const COMFORT_INDEX_EXPERIMENTAL = true;
const DEFAULT_EVENT_IMPACT_MULTIPLIER = 1;
const CONFIDENCE_MARKER_MULTIPLIERS = {
  low: 0.9,
  medium: 0.7,
  high: 0.45,
};
const EVENT_IMPACT_WEIGHTS = {
  "hard-braking": 12,
  "strong-acceleration": 10,
  "uncomfortable-turn": 10,
  "abrupt-lateral-variation": 8,
  "vertical-impact": 8,
  "rough-road-segment": 24,
};

export function createComfortReport(trip) {
  const durationSeconds = calculateDurationSeconds(trip?.timestamps);
  const motionSamples = Array.isArray(trip?.streams?.motion) ? trip.streams.motion : [];
  const gpsSamples = Array.isArray(trip?.streams?.gps) ? trip.streams.gps : [];
  const confidenceMarkers = Array.isArray(trip?.confidenceMarkers) ? trip.confidenceMarkers : [];
  const approximateDistanceMeters = calculateApproximateDistanceMeters(gpsSamples);
  const comfortEvents = detectComfortEvents(trip).map(addComfortEventId);
  const rawView = createComfortReportView({
    id: "raw",
    label: "Raw View",
    comfortEvents,
    confidenceMarkers,
    eventImpactMultiplier: DEFAULT_EVENT_IMPACT_MULTIPLIER,
    capturedData: createCapturedDataSummary(motionSamples, gpsSamples),
  });
  const trustedView = createComfortReportView({
    id: "trusted",
    label: "Trusted View",
    comfortEvents,
    confidenceMarkers,
    eventImpactMultiplier: calculateTrustedEventImpactMultiplier(confidenceMarkers),
    capturedData: createCapturedDataSummary(motionSamples, gpsSamples),
  });

  return {
    tripId: trip?.tripId ?? null,
    durationSeconds,
    comfortEvents,
    confidenceMarkers,
    rawView,
    trustedView,
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

function createComfortReportView({
  id,
  label,
  comfortEvents,
  confidenceMarkers,
  eventImpactMultiplier,
  capturedData,
}) {
  return {
    id,
    label,
    capturedData,
    comfortEvents: cloneArray(comfortEvents),
    confidenceMarkers: cloneArray(confidenceMarkers),
    confidenceAdjustment: createConfidenceAdjustment(confidenceMarkers, eventImpactMultiplier),
    passengerComfort: createPassengerComfortSummary(comfortEvents, eventImpactMultiplier),
    driverControl: createDriverControlSummary(comfortEvents),
  };
}

function createCapturedDataSummary(motionSamples, gpsSamples) {
  return {
    motionSampleCount: motionSamples.length,
    gpsSampleCount: gpsSamples.length,
  };
}

function createPassengerComfortSummary(comfortEvents, eventImpactMultiplier) {
  return {
    eventCount: comfortEvents.length,
    comfortIndex: calculateComfortIndex(comfortEvents, eventImpactMultiplier),
  };
}

function createDriverControlSummary(comfortEvents) {
  const interpretations = comfortEvents
    .map((event) => event.driverControl?.interpretation)
    .filter(Boolean);

  return {
    eventCount: interpretations.length,
    interpretations,
  };
}

function calculateComfortIndex(comfortEvents, eventImpactMultiplier) {
  const eventPenalty = comfortEvents.reduce(
    (total, event) => total + eventImpactWeight(event) * eventImpactMultiplier,
    0,
  );
  const score = clampComfortIndex(Math.round(100 - eventPenalty));

  return {
    experimental: COMFORT_INDEX_EXPERIMENTAL,
    score,
    classification: classifyComfortIndex(score),
  };
}

function eventImpactWeight(event) {
  return EVENT_IMPACT_WEIGHTS[event.type] ?? 6;
}

function calculateTrustedEventImpactMultiplier(confidenceMarkers) {
  if (confidenceMarkers.length === 0) {
    return DEFAULT_EVENT_IMPACT_MULTIPLIER;
  }

  return confidenceMarkers.reduce(
    (multiplier, marker) =>
      Math.min(multiplier, CONFIDENCE_MARKER_MULTIPLIERS[marker.severity] ?? multiplier),
    DEFAULT_EVENT_IMPACT_MULTIPLIER,
  );
}

function createConfidenceAdjustment(confidenceMarkers, eventImpactMultiplier) {
  const hasAdjustment = eventImpactMultiplier < DEFAULT_EVENT_IMPACT_MULTIPLIER;

  return {
    eventImpactMultiplier,
    explanation: hasAdjustment
      ? "Confidence Markers reduced Comfort Event influence in this view without deleting raw Trip data."
      : "No Confidence Markers changed Comfort Event influence in this view.",
    markerCount: confidenceMarkers.length,
  };
}

function classifyComfortIndex(score) {
  if (score >= 90) {
    return "Smooth";
  }

  if (score >= 75) {
    return "Mostly comfortable";
  }

  if (score >= 55) {
    return "Mixed comfort";
  }

  return "Uncomfortable";
}

function clampComfortIndex(score) {
  return Math.max(0, Math.min(100, score));
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

function cloneArray(values) {
  return values.map((value) => structuredClone(value));
}

function addComfortEventId(event, index) {
  return {
    ...event,
    eventId: `${event.type}-${event.startedAtMs}-${event.endedAtMs}-${index}`,
  };
}
