const HARD_BRAKING_THRESHOLD = -2.7;
const STRONG_ACCELERATION_THRESHOLD = 2.7;
const UNCOMFORTABLE_TURN_THRESHOLD = 2.2;
const ABRUPT_LATERAL_DELTA_THRESHOLD = 2.4;
const ABRUPT_LATERAL_JERK_THRESHOLD = 9;
const VERTICAL_IMPACT_THRESHOLD = 3.5;
const ROUGH_ROAD_VERTICAL_THRESHOLD = 1.5;
const ROUGH_ROAD_MIN_SAMPLE_COUNT = 4;
const ROUGH_ROAD_MIN_DURATION_MS = 750;
const ROUGH_ROAD_SPEED_REDUCTION_THRESHOLD = 1;

export function detectComfortEvents(trip) {
  const motionSamples = Array.isArray(trip?.streams?.motion) ? trip.streams.motion : [];
  const gpsSamples = Array.isArray(trip?.streams?.gps) ? trip.streams.gps : [];
  const events = [];
  let brakingSegment = null;
  let accelerationSegment = null;
  let turnSegment = null;
  let verticalSegment = null;
  let previousSample = null;

  for (const sample of motionSamples) {
    const longitudinal = sample?.acceleration?.y;
    const lateral = sample?.acceleration?.x;
    const vertical = sample?.acceleration?.z;

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

    if (Number.isFinite(vertical) && Math.abs(vertical) >= ROUGH_ROAD_VERTICAL_THRESHOLD) {
      verticalSegment = appendSample(verticalSegment, previousSample, sample, "z", vertical, strongestAbs);
    } else if (verticalSegment) {
      const verticalEvent = createVerticalEvent(verticalSegment, gpsSamples);

      if (verticalEvent) {
        events.push(verticalEvent);
      }

      verticalSegment = null;
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
  if (verticalSegment) {
    const verticalEvent = createVerticalEvent(verticalSegment, gpsSamples);

    if (verticalEvent) {
      events.push(verticalEvent);
    }
  }

  return events;
}

function appendSample(segment, previousSample, sample, axis, value, comparePeak) {
  const jerk = calculateJerk(previousSample, sample, axis, value);
  const peak = segment ? comparePeak(segment.peak, value) : value;
  const peakUpdated = !segment || peak === value;

  return {
    startedAtMs: segment?.startedAtMs ?? sample.timestamp,
    endedAtMs: sample.timestamp,
    sampleCount: (segment?.sampleCount ?? 0) + 1,
    peak,
    peakAtMs: peakUpdated ? sample.timestamp : segment.peakAtMs,
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

function createVerticalEvent(segment, gpsSamples) {
  if (isRoughRoadSegment(segment)) {
    return createRoughRoadEvent(segment, gpsSamples);
  }

  if (Math.abs(segment.peak) >= VERTICAL_IMPACT_THRESHOLD) {
    return createVerticalImpactEvent(segment, gpsSamples);
  }

  return null;
}

function isRoughRoadSegment(segment) {
  return (
    segment.sampleCount >= ROUGH_ROAD_MIN_SAMPLE_COUNT &&
    segment.endedAtMs - segment.startedAtMs >= ROUGH_ROAD_MIN_DURATION_MS
  );
}

function createVerticalImpactEvent(segment, gpsSamples) {
  const speedAtPeak = findNearestSpeedMetersPerSecond(gpsSamples, segment.peakAtMs);

  return {
    type: "vertical-impact",
    startedAtMs: segment.peakAtMs,
    endedAtMs: segment.peakAtMs,
    explanation: "An isolated vertical impact was detected from a short vertical acceleration spike.",
    driverControl: {
      interpretation: `A single vertical impact is a limited Driver Control signal; it was recorded ${formatSpeedContext(speedAtPeak)}.`,
    },
    metrics: {
      axis: "vertical",
      peakMetersPerSecondSquared: roundMetric(segment.peak),
      peakAbsMetersPerSecondSquared: roundMetric(Math.abs(segment.peak)),
      peakJerkMetersPerSecondCubed: roundMetric(segment.peakJerk ?? 0),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(segment.peakJerk ?? 0)),
      speedAtPeakMetersPerSecond: roundNullableMetric(speedAtPeak),
      sampleCount: segment.sampleCount,
    },
  };
}

function createRoughRoadEvent(segment, gpsSamples) {
  const speedAtStart = findNearestSpeedMetersPerSecond(gpsSamples, segment.startedAtMs);
  const speedAtEnd = findNearestSpeedMetersPerSecond(gpsSamples, segment.endedAtMs);
  const speedResponse = classifySpeedResponse(speedAtStart, speedAtEnd);

  return {
    type: "rough-road-segment",
    startedAtMs: segment.startedAtMs,
    endedAtMs: segment.endedAtMs,
    explanation: "A sustained rough-road segment was detected from repeated vertical acceleration changes.",
    driverControl: {
      speedResponse,
      interpretation: createRoughRoadDriverControlInterpretation(speedResponse),
    },
    metrics: {
      axis: "vertical",
      peakMetersPerSecondSquared: roundMetric(segment.peak),
      peakAbsMetersPerSecondSquared: roundMetric(Math.abs(segment.peak)),
      peakJerkMetersPerSecondCubed: roundMetric(segment.peakJerk ?? 0),
      peakAbsJerkMetersPerSecondCubed: roundMetric(Math.abs(segment.peakJerk ?? 0)),
      speedAtStartMetersPerSecond: roundNullableMetric(speedAtStart),
      speedAtEndMetersPerSecond: roundNullableMetric(speedAtEnd),
      speedResponse,
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

function findNearestSpeedMetersPerSecond(samples, timestamp) {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  let nearestSample = null;
  let nearestDistance = Infinity;

  for (const sample of samples) {
    if (!Number.isFinite(sample?.timestamp) || !Number.isFinite(sample?.speedMetersPerSecond)) {
      continue;
    }

    const distance = Math.abs(sample.timestamp - timestamp);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSample = sample;
    }
  }

  return nearestSample?.speedMetersPerSecond ?? null;
}

function classifySpeedResponse(speedAtStart, speedAtEnd) {
  if (!Number.isFinite(speedAtStart) || !Number.isFinite(speedAtEnd)) {
    return "unknown";
  }

  return speedAtEnd <= speedAtStart - ROUGH_ROAD_SPEED_REDUCTION_THRESHOLD
    ? "reduced"
    : "maintained";
}

function createRoughRoadDriverControlInterpretation(speedResponse) {
  const interpretations = {
    reduced:
      "Driver Control: speed was reduced during the rough-road segment, suggesting a responsive speed choice.",
    maintained:
      "Driver Control: speed was maintained during the rough-road segment, so Passenger Comfort was affected while speed stayed steady.",
    unknown:
      "Driver Control: speed response could not be estimated because GPS speed context was unavailable.",
  };

  return interpretations[speedResponse] ?? interpretations.unknown;
}

function formatSpeedContext(speedMetersPerSecond) {
  if (!Number.isFinite(speedMetersPerSecond)) {
    return "without GPS speed context";
  }

  return `at about ${Math.round(speedMetersPerSecond * 3.6)} km/h`;
}

function roundMetric(value) {
  return Math.round(value * 10) / 10;
}

function roundNullableMetric(value) {
  return Number.isFinite(value) ? roundMetric(value) : null;
}
