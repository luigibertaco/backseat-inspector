import { createComfortReport } from "./comfort-report.js";

const DEFAULT_ALGORITHM_VERSION = "comfort-v1";

export function createTripDatasetExport(trip, { algorithmVersion = DEFAULT_ALGORITHM_VERSION } = {}) {
  if (trip?.status !== "finished") {
    throw new Error("Trip dataset export requires a finished Trip.");
  }

  const comfortReport = createComfortReport(trip);

  return {
    schemaVersion: trip.schemaVersion ?? "1",
    algorithmVersion,
    tripId: trip.tripId ?? null,
    deviceId: trip.deviceId ?? null,
    status: trip.status,
    timestamps: clone(trip.timestamps ?? {}),
    mountingMode: trip.mountingMode ?? null,
    streams: {
      motion: cloneArray(trip.streams?.motion),
      gps: cloneArray(trip.streams?.gps),
    },
    comfortEvents: cloneArray(comfortReport.comfortEvents),
    confidenceMarkers: cloneArray(trip.confidenceMarkers),
    comfortReport: clone(comfortReport),
    tripReview: trip.tripReview ? clone(trip.tripReview) : null,
  };
}

export function createTripDatasetExportJson(trip, options = {}) {
  return `${JSON.stringify(sortKeysDeep(createTripDatasetExport(trip, options)), null, 2)}\n`;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeysDeep(value[key])]),
  );
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function cloneArray(values) {
  return Array.isArray(values) ? values.map((value) => clone(value)) : [];
}

function clone(value) {
  return structuredClone(value);
}
