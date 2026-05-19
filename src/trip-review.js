export const EVENT_LABELS = [
  { value: "correct", label: "Correct" },
  { value: "false-positive", label: "False positive" },
  { value: "too-mild", label: "Too mild" },
  { value: "too-severe", label: "Too severe" },
];

export const PERCEIVED_COMFORT_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "mixed", label: "Mixed" },
  { value: "uncomfortable", label: "Uncomfortable" },
];

export const PERCEIVED_ACCURACY_OPTIONS = [
  { value: "accurate", label: "Accurate" },
  { value: "mostly-accurate", label: "Mostly accurate" },
  { value: "some-missed", label: "Some missed" },
  { value: "not-accurate", label: "Not accurate" },
];

export function createTripReview({
  tripId,
  comfortEvents,
  eventLabels = {},
  perceivedComfort = "",
  perceivedAccuracy = "",
  missedComfortEvents = "",
  notes = "",
  now = () => new Date().toISOString(),
} = {}) {
  if (!tripId) {
    throw new Error("Trip Review requires a tripId.");
  }

  const events = Array.isArray(comfortEvents) ? comfortEvents : [];

  return {
    tripId,
    submittedAt: now(),
    eventLabels: events.map((event) => createEventLabel(event, eventLabels[event.eventId] ?? {})),
    overall: {
      perceivedComfort: normalizeOption(perceivedComfort, PERCEIVED_COMFORT_OPTIONS),
      perceivedAccuracy: normalizeOption(perceivedAccuracy, PERCEIVED_ACCURACY_OPTIONS),
      missedComfortEvents: normalizeText(missedComfortEvents),
      notes: normalizeText(notes),
    },
  };
}

export function createTripReviewFromFormData({ report, formData, now } = {}) {
  const eventLabels = {};

  for (const event of report?.comfortEvents ?? []) {
    eventLabels[event.eventId] = {
      label: formValue(formData, `eventLabel:${event.eventId}`),
      note: formValue(formData, `eventNote:${event.eventId}`),
    };
  }

  return createTripReview({
    tripId: report?.tripId,
    comfortEvents: report?.comfortEvents ?? [],
    eventLabels,
    perceivedComfort: formValue(formData, "perceivedComfort"),
    perceivedAccuracy: formValue(formData, "perceivedAccuracy"),
    missedComfortEvents: formValue(formData, "missedComfortEvents"),
    notes: formValue(formData, "notes"),
    now,
  });
}

function createEventLabel(event, input) {
  return {
    eventId: event.eventId,
    eventType: event.type,
    eventStartedAtMs: event.startedAtMs,
    eventEndedAtMs: event.endedAtMs,
    label: normalizeOption(input.label, EVENT_LABELS),
    note: normalizeText(input.note),
  };
}

function formValue(formData, name) {
  const value = formData?.get?.(name);

  return typeof value === "string" ? value : "";
}

function normalizeOption(value, options) {
  const normalized = normalizeText(value);

  return options.some((option) => option.value === normalized) ? normalized : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
