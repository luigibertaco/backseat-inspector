import test from "node:test";
import assert from "node:assert/strict";

import { createComfortReport } from "../src/comfort-report.js";
import {
  createMemoryTripStore,
  saveTripReview,
} from "../src/trip-recorder.js";
import {
  createTripReview,
  createTripReviewFromFormData,
} from "../src/trip-review.js";

test("Trip Review stores Event Labels and optional notes for detected Comfort Events", () => {
  const report = createComfortReport(finishedTripWithEvents());
  const review = createTripReview({
    tripId: report.tripId,
    comfortEvents: report.comfortEvents,
    eventLabels: {
      [report.comfortEvents[0].eventId]: {
        label: "correct",
        note: "Felt exactly like the report described.",
      },
      [report.comfortEvents[1].eventId]: {
        label: "too-severe",
        note: "",
      },
    },
    perceivedComfort: "mixed",
    perceivedAccuracy: "mostly-accurate",
    missedComfortEvents: "Small pothole before the turn.",
    notes: "Passenger noticed two moments.",
    now: () => "2026-05-19T10:20:00.000Z",
  });

  assert.equal(review.tripId, "trip-review");
  assert.equal(review.submittedAt, "2026-05-19T10:20:00.000Z");
  assert.equal(review.eventLabels.length, 2);
  assert.deepEqual(review.eventLabels[0], {
    eventId: report.comfortEvents[0].eventId,
    eventType: "hard-braking",
    eventStartedAtMs: 250,
    eventEndedAtMs: 250,
    label: "correct",
    note: "Felt exactly like the report described.",
  });
  assert.equal(review.eventLabels[1].label, "too-severe");
  assert.equal(review.eventLabels[1].note, "");
  assert.deepEqual(review.overall, {
    perceivedComfort: "mixed",
    perceivedAccuracy: "mostly-accurate",
    missedComfortEvents: "Small pothole before the turn.",
    notes: "Passenger noticed two moments.",
  });
});

test("Trip Review can be created from form data", () => {
  const report = createComfortReport(finishedTripWithEvents());
  const formData = new FormData();

  formData.set(`eventLabel:${report.comfortEvents[0].eventId}`, "false-positive");
  formData.set(`eventNote:${report.comfortEvents[0].eventId}`, "Passenger did not notice this.");
  formData.set(`eventLabel:${report.comfortEvents[1].eventId}`, "too-mild");
  formData.set("perceivedComfort", "uncomfortable");
  formData.set("perceivedAccuracy", "some-missed");
  formData.set("missedComfortEvents", "The rough patch lasted longer.");
  formData.set("notes", "Try this route again.");

  const review = createTripReviewFromFormData({
    report,
    formData,
    now: () => "2026-05-19T10:25:00.000Z",
  });

  assert.equal(review.eventLabels[0].label, "false-positive");
  assert.equal(review.eventLabels[0].note, "Passenger did not notice this.");
  assert.equal(review.eventLabels[1].label, "too-mild");
  assert.equal(review.overall.perceivedComfort, "uncomfortable");
  assert.equal(review.overall.perceivedAccuracy, "some-missed");
});

test("Trip Review persistence keeps data associated with the correct finished Trip", async () => {
  const trip = finishedTripWithEvents();
  const store = createMemoryTripStore();

  await store.saveTrip(trip);

  const report = createComfortReport(trip);
  const review = createTripReview({
    tripId: report.tripId,
    comfortEvents: report.comfortEvents,
    eventLabels: {
      [report.comfortEvents[0].eventId]: {
        label: "correct",
        note: "Clear braking moment.",
      },
    },
    perceivedComfort: "comfortable",
    perceivedAccuracy: "accurate",
    missedComfortEvents: "",
    notes: "",
    now: () => "2026-05-19T10:30:00.000Z",
  });

  const savedTrip = await saveTripReview({ store, tripId: trip.tripId, review });
  const persisted = await store.loadTrip(trip.tripId);

  assert.equal(savedTrip.tripId, "trip-review");
  assert.equal(savedTrip.tripReview.tripId, "trip-review");
  assert.equal(savedTrip.tripReview.eventLabels[0].eventId, report.comfortEvents[0].eventId);
  assert.deepEqual(persisted.tripReview, savedTrip.tripReview);
});

test("Trip Review persistence rejects reviews for another Trip", async () => {
  const trip = finishedTripWithEvents();
  const store = createMemoryTripStore();

  await store.saveTrip(trip);

  await assert.rejects(
    () =>
      saveTripReview({
        store,
        tripId: trip.tripId,
        review: {
          tripId: "other-trip",
          eventLabels: [],
          overall: {},
        },
      }),
    /same Trip/,
  );
});

function finishedTripWithEvents() {
  return {
    tripId: "trip-review",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:04.000Z",
    },
    streams: {
      motion: [
        { timestamp: 0, acceleration: { x: 0, y: 0, z: 0.1 } },
        { timestamp: 250, acceleration: { x: 0, y: -3.2, z: 0.1 } },
        { timestamp: 500, acceleration: { x: 0, y: -0.2, z: 0.1 } },
        { timestamp: 1250, acceleration: { x: 0, y: 0, z: 1.8 } },
        { timestamp: 1500, acceleration: { x: 0, y: 0, z: -1.9 } },
        { timestamp: 1750, acceleration: { x: 0, y: 0, z: 2.1 } },
        { timestamp: 2000, acceleration: { x: 0, y: 0, z: -1.7 } },
        { timestamp: 2250, acceleration: { x: 0, y: 0, z: 1.6 } },
        { timestamp: 2500, acceleration: { x: 0, y: 0, z: 0.2 } },
      ],
      gps: [
        {
          timestamp: 1250,
          latitude: 0,
          longitude: 0,
          speedMetersPerSecond: 11.9,
          accuracyMeters: 8,
        },
        {
          timestamp: 2250,
          latitude: 0,
          longitude: 0.001,
          speedMetersPerSecond: 9.7,
          accuracyMeters: 8,
        },
      ],
    },
    confidenceMarkers: [],
  };
}
