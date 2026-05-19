const HARD_BRAKING_THRESHOLD = -2.7;
const STRONG_ACCELERATION_THRESHOLD = 2.7;
const UNCOMFORTABLE_TURN_THRESHOLD = 2.2;
const ABRUPT_LATERAL_DELTA_THRESHOLD = 2.4;
const ABRUPT_LATERAL_JERK_THRESHOLD = 9;

export function detectComfortEvents(trip) {
  const motionSamples = Array.isArray(trip?.streams?.motion) ? trip.streams.motion : [];
  const events = [];
  let brakingSegment = null;
  let accelerationSegment = null;
  let turnSegment = null;
  let previousSample = null;

  for (const sample of motionSamples) {
    const longitudinal = sample?.acceleration?.y;
    const lateral = sample?.acceleration?.x;

    if (previousSample) {
      const abruptLateralEvent = detectAbruptLateralVariation(previousSample, sample);

      if (abruptLateralEvent) {
        events.push(abruptLateralEvent);
      }
    }

    if (Number.isFinite(longitudinal) && longitudinal <= HARD_BRAKING_THRESHOLD) {
      brakingSegment = appendSample(brakingSegment, previousSample, sample, "y", longitudinal, Math.min);
    } else if (brakingSegment) {
      events.push(createHardBrakingEvent(brakingSegment));
      brakingSegment = null;
    }

    if (Number.isFinite(longitudinal) && longitudinal >= STRONG_ACCELERATION_THRESHOLD) {
      accelerationSegment = appendSample(accelerationSegment, previousSample, sample, "y", longitudinal, Math.max);
    } else if (accelerationSegment) {
      events.push(createStrongAccelerationEvent(accelerationSegment));
      accelerationSegment = null;
    }

    if (Number.isFinite(lateral) && Math.abs(lateral) >= UNCOMFORTABLE_TURN_THRESHOLD) {
      turnSegment = appendSample(turnSegment, previousSample, sample, "x", lateral, strongestAbs);
    } else if (turnSegment) {
      events.push(createUncomfortableTurnEvent(turnSegment));
      turnSegment = null;
    }

    previousSample = sample;
  }

  if (brakingSegment) {
    events.push(createHardBrakingEvent(brakingSegment));
  }
  if (accelerationSegment) {
    events.push(createStrongAccelerationEvent(accelerationSegment));
  }
  if (turnSegment) {
    events.push(createUncomfortableTurnEvent(turnSegment));
  }

  return events;
}

function appendSample(segment, previousSample, sample, axis, value, comparePeak) {
  const jerk = calculateJerk(previousSample, sample, axis, value);

  return {
    startedAtMs: segment?.startedAtMs ?? sample.timestamp,
    endedAtMs: sample.timestamp,
    sampleCount: (segment?.sampleCount ?? 0) + 1,
    peak: segment ? comparePeak(segment.peak, value) : value,
    peakJerk: updatePeakJerk(segment?.peakJerk, jerk),
  };
}

function createHardBrakingEvent(segment) {
  return {
    type: "hard-braking",
    startedAtMs: segment.startedAtMs,
    endedAtMs: segment.endedAtMs,
    explanation: "Hard braking was detected from sustained longitudinal deceleration.",
    metrics: {
      axis: "longitudinal",
      peakMetersPerSecondSquared: roundMetric(segment.peak),
      peakAbsMetersPerSecondSquared: roundMetric(Math.abs(segment.peak)),
      peakJerkMetersPerSecondCubed: roundMetric(segment.peakJerk ?? 0),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(segment.peakJerk ?? 0)),
      sampleCount: segment.sampleCount,
    },
  };
}

function createStrongAccelerationEvent(segment) {
  return {
    type: "strong-acceleration",
    startedAtMs: segment.startedAtMs,
    endedAtMs: segment.endedAtMs,
    explanation: "Strong acceleration was detected from sustained longitudinal acceleration.",
    metrics: {
      axis: "longitudinal",
      peakMetersPerSecondSquared: roundMetric(segment.peak),
      peakAbsMetersPerSecondSquared: roundMetric(Math.abs(segment.peak)),
      peakJerkMetersPerSecondCubed: roundMetric(segment.peakJerk ?? 0),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(segment.peakJerk ?? 0)),
      sampleCount: segment.sampleCount,
    },
  };
}

function createUncomfortableTurnEvent(segment) {
  return {
    type: "uncomfortable-turn",
    startedAtMs: segment.startedAtMs,
    endedAtMs: segment.endedAtMs,
    explanation: "An uncomfortable turn was detected from sustained lateral acceleration.",
    metrics: {
      axis: "lateral",
      peakMetersPerSecondSquared: roundMetric(segment.peak),
      peakAbsMetersPerSecondSquared: roundMetric(Math.abs(segment.peak)),
      peakJerkMetersPerSecondCubed: roundMetric(segment.peakJerk ?? 0),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(segment.peakJerk ?? 0)),
      sampleCount: segment.sampleCount,
    },
  };
}

function calculateJerk(previousSample, sample, axis, value) {
  const previousValue = previousSample?.acceleration?.[axis];
  const elapsedSeconds = (sample?.timestamp - previousSample?.timestamp) / 1000;

  if (!Number.isFinite(previousValue) || !Number.isFinite(value) || elapsedSeconds <= 0) {
    return null;
  }

  return (value - previousValue) / elapsedSeconds;
}

function updatePeakJerk(currentPeakJerk, jerk) {
  if (!Number.isFinite(jerk)) {
    return currentPeakJerk;
  }

  return Number.isFinite(currentPeakJerk) ? strongestAbs(currentPeakJerk, jerk) : jerk;
}

function detectAbruptLateralVariation(previousSample, sample) {
  const previousLateral = previousSample?.acceleration?.x;
  const lateral = sample?.acceleration?.x;
  const elapsedSeconds = (sample?.timestamp - previousSample?.timestamp) / 1000;

  if (!Number.isFinite(previousLateral) || !Number.isFinite(lateral) || elapsedSeconds <= 0) {
    return null;
  }

  const lateralDelta = lateral - previousLateral;
  const jerk = lateralDelta / elapsedSeconds;

  if (
    Math.abs(lateralDelta) < ABRUPT_LATERAL_DELTA_THRESHOLD ||
    Math.abs(jerk) < ABRUPT_LATERAL_JERK_THRESHOLD
  ) {
    return null;
  }

  return {
    type: "abrupt-lateral-variation",
    startedAtMs: previousSample.timestamp,
    endedAtMs: sample.timestamp,
    explanation: "Abrupt lateral variation was detected from a fast side-to-side acceleration change.",
    metrics: {
      axis: "lateral",
      lateralDeltaMetersPerSecondSquared: roundMetric(lateralDelta),
      peakJerkMetersPerSecondCubed: roundMetric(jerk),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(jerk)),
    },
  };
}

function strongestAbs(first, second) {
  return Math.abs(second) > Math.abs(first) ? second : first;
}

function roundMetric(value) {
  return Math.round(value * 10) / 10;
}
