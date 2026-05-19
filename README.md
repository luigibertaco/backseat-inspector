# Backseat Inspector

Backseat Inspector is an experimental web app for reviewing how smooth and comfortable a Trip felt for passengers.

The project is designed as a static, browser-based MVP that can be hosted on GitHub Pages and used from iPhone Safari. During a Trip, it records motion, orientation, gyroscope data when available, GPS samples, calibration state, and Trip metadata. After the Trip, it generates a local Comfort Report that highlights Comfort Events such as hard braking, strong acceleration, uncomfortable turns, vertical impacts, rough-road segments, and periods with Confidence Markers.

The goal is not to judge driving safety. Backseat Inspector focuses on Passenger Comfort and smoothness, with a transparent Comfort Index that can be tuned over time from exported Trip data and Trip Reviews.

## Project Status

This repository is at the product-definition stage. The first implementation should prioritize a small, static web app with modular browser-side code and deterministic local exports.

Planned MVP flow:

1. Open the app in iPhone Safari over HTTPS.
2. Grant motion and location permissions from an explicit user action.
3. Choose the phone mounting mode.
4. Calibrate while the car is stopped.
5. Record the Trip with a minimal, non-distracting Comfort Signal.
6. Finish the Trip and review the generated Comfort Report.
7. Add Event Labels and export the full local dataset as JSON.

## Core Principles

- Local-first: Trip data stays in the browser unless manually exported.
- Static hosting: the MVP should work on GitHub Pages without a backend.
- Privacy-aware: exported files may contain precise location history and should be treated as sensitive.
- Passenger Comfort only: avoid safety, danger, fuel economy, and efficiency claims.
- Experimental Comfort Index: every index should be versioned, explainable, and open to correction.
- Data preservation: low-confidence data receives Confidence Markers; it is not deleted.
- Testable algorithms: calibration, analysis, Comfort Index calculation, persistence, and export should be modular and covered by tests.

## What The App Measures

Backseat Inspector is expected to collect separate timestamped streams for motion and GPS because browser sensors report at different frequencies.

The first version should analyze:

- Longitudinal comfort: hard braking, strong acceleration, abrupt speed changes.
- Lateral comfort: uncomfortable turns and abrupt lateral variation.
- Vertical comfort: impacts, harsh road irregularities, and sustained rough-road segments.
- Confidence: calibration quality, sensor availability, GPS accuracy, phone movement, and mounting stability.

The Comfort Report should separate Passenger Comfort from Driver Control. For example, a rough road can make a passenger uncomfortable even when the driver is behaving reasonably; the app should preserve that distinction.

## MVP Features

- iPhone/Safari-first permission flow for motion, orientation, and location.
- Mounting mode selection for fixed mount or horizontal console placement.
- Calibration while stopped, including stability and levelness checks.
- Best-effort screen wake lock support with visible status.
- Batched local persistence during recording.
- Interrupted-trip recovery.
- Minimal Trip screen showing operational status only.
- Ambient Comfort Signal for comfort peaks.
- Post-trip Comfort Report with Raw View and Trusted View.
- Experimental Comfort Index from 0 to 100 with a human-readable classification.
- Comfort Event list with human-friendly explanations and technical metrics.
- Event Labels: correct, false positive, too mild, too severe.
- Trip Review with whole-trip perception, missed events, and notes.
- Deterministic JSON export including streams, events, analysis, Trip Review data, schema version, and algorithm version.

## Out Of Scope For The MVP

- Native iOS app.
- Android/Chrome as a primary target.
- Background capture while the screen is locked.
- Backend, login, sync, or automatic uploads.
- Route maps in the Comfort Report.
- Fuel economy, energy efficiency, or safety evaluation.
- OBD-II, Bluetooth vehicle telemetry, pedal position, steering angle, audio, or video.
- Reliable distinction between potholes and speed bumps.

## Suggested Architecture

The app should stay framework-free for the first version, while keeping the domain logic out of the UI.

Suggested modules:

- `permissions`: normalizes browser sensor and location permission behavior.
- `wake-lock`: requests, releases, and reacquires screen wake lock when possible.
- `calibration`: derives gravity, noise, initial orientation, confidence, and warnings.
- `recorder`: coordinates trip state, buffers, and batched writes.
- `persistence`: isolates IndexedDB or equivalent local storage behavior.
- `analysis`: converts raw streams into derived acceleration, jerk, Comfort Events, and Confidence Markers.
- `comfort-index`: turns Comfort Events and Confidence Markers into the Comfort Index and classifications.
- `review`: stores Event Labels and Trip Reviews.
- `export`: produces deterministic JSON exports.
- `ui`: orchestrates screens and user interactions without owning the physics logic.

## Data And Privacy

The MVP intentionally records full GPS coordinates because early development depends on high-quality Trip fixtures. That makes exported files sensitive: they can reveal precise movement history, home and work locations, and driving habits.

Before sharing any exported data, review it carefully. Future public sample fixtures should be anonymized, synthetic, coarse, or explicitly consented to.

The app should make this clear in the UI whenever location recording or export is involved.

## Testing Strategy

The first implementation should establish tests around externally visible behavior rather than private implementation details.

Recommended coverage:

- Calibration with stable, tilted, unstable, and differently oriented samples.
- Analysis using synthetic acceleration series for braking, acceleration, turns, vertical impacts, and rough roads.
- Comfort Index calculation with known Comfort Events and Confidence Markers.
- Export shape and determinism.
- Persistence contracts for batched writes, interruption recovery, and finalization.
- Wake lock support, unavailability, release, and visibility recovery.
- Comfort Signal smoothing and decay.
- Core UI flow: permissions, calibration, recording, finishing, reviewing, and exporting.

Real exported Trip fixtures can become regression tests later, but they should be handled carefully because they may contain sensitive route data.

## Development

There is no build system yet. The intended first version is a static web app that can run locally and be deployed to GitHub Pages.

Once implementation begins, this section should document:

- Local development commands.
- Test commands.
- GitHub Pages deployment steps.
- Browser support and sensor limitations.
- Export schema and versioning rules.

## License

This project is intended to be released as open source under the MIT License.

No license file has been added yet. Before distributing or accepting external contributions, add a `LICENSE` file containing the MIT License text and update this section accordingly.

## Name

Backseat Inspector is a working project name. It reflects the app's purpose: giving the driver a Comfort Report after the Trip, without turning the Trip screen into a distracting dashboard.
