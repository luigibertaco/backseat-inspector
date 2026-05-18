# Backseat Inspector

Backseat Inspector is an experimental web app for reviewing how smooth and comfortable a car trip felt for passengers.

The project is designed as a static, browser-based MVP that can be hosted on GitHub Pages and used from iPhone Safari. During a trip, it records motion, orientation, gyroscope data when available, GPS samples, calibration state, and trip metadata. After the trip, it generates a local report that highlights hard braking, strong acceleration, uncomfortable turns, vertical impacts, rough-road segments, and low-confidence sensor periods.

The goal is not to judge driving safety. Backseat Inspector focuses on passenger comfort and smoothness, with transparent scoring that can be tuned over time from exported trip data and manual feedback.

## Project Status

This repository is at the product-definition stage. The first implementation should prioritize a small, static web app with modular browser-side code and deterministic local exports.

Planned MVP flow:

1. Open the app in iPhone Safari over HTTPS.
2. Grant motion and location permissions from an explicit user action.
3. Choose the phone mounting mode.
4. Calibrate while the car is stopped.
5. Record the trip with minimal, non-distracting real-time feedback.
6. Finish the trip and review the generated report.
7. Label detected events and export the full local dataset as JSON.

## Core Principles

- Local-first: trip data stays in the browser unless manually exported.
- Static hosting: the MVP should work on GitHub Pages without a backend.
- Privacy-aware: exported files may contain precise location history and should be treated as sensitive.
- Passenger comfort only: avoid safety, danger, fuel economy, and efficiency claims.
- Experimental scoring: every score should be versioned, explainable, and open to correction.
- Data preservation: low-confidence data is marked, not deleted.
- Testable algorithms: calibration, analysis, scoring, persistence, and export should be modular and covered by tests.

## What The App Measures

Backseat Inspector is expected to collect separate timestamped streams for motion and GPS because browser sensors report at different frequencies.

The first version should analyze:

- Longitudinal comfort: hard braking, strong acceleration, abrupt speed changes.
- Lateral comfort: uncomfortable turns and abrupt lateral variation.
- Vertical comfort: impacts, harsh road irregularities, and sustained rough-road segments.
- Confidence: calibration quality, sensor availability, GPS accuracy, phone movement, and mounting stability.

The report should separate experienced comfort from estimated driver control. For example, a rough road can make a passenger uncomfortable even when the driver is behaving reasonably; the app should preserve that distinction.

## MVP Features

- iPhone/Safari-first permission flow for motion, orientation, and location.
- Mounting mode selection for fixed mount or horizontal console placement.
- Calibration while stopped, including stability and levelness checks.
- Best-effort screen wake lock support with visible status.
- Batched local persistence during recording.
- Interrupted-trip recovery.
- Minimal trip screen showing operational status only.
- Ambient background color feedback for comfort peaks.
- Post-trip report with raw and filtered/trusted views.
- Experimental score from 0 to 100 with a human-readable classification.
- Event list with human-friendly explanations and technical metrics.
- Manual event feedback: correct, false positive, too mild, too severe.
- Global trip feedback and notes.
- Deterministic JSON export including streams, events, analysis, feedback, schema version, and algorithm version.

## Out Of Scope For The MVP

- Native iOS app.
- Android/Chrome as a primary target.
- Background capture while the screen is locked.
- Backend, login, sync, or automatic uploads.
- Route maps in the report.
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
- `analysis`: converts raw streams into derived acceleration, jerk, comfort events, and confidence markers.
- `scoring`: turns events and confidence into scores and classifications.
- `review`: stores manual event labels and global trip feedback.
- `export`: produces deterministic JSON exports.
- `ui`: orchestrates screens and user interactions without owning the physics logic.

## Data And Privacy

The MVP intentionally records full GPS coordinates because early development depends on high-quality trip fixtures. That makes exported files sensitive: they can reveal precise movement history, home and work locations, and driving habits.

Before sharing any exported data, review it carefully. Future public sample fixtures should be anonymized, synthetic, coarse, or explicitly consented to.

The app should make this clear in the UI whenever location recording or export is involved.

## Testing Strategy

The first implementation should establish tests around externally visible behavior rather than private implementation details.

Recommended coverage:

- Calibration with stable, tilted, unstable, and differently oriented samples.
- Analysis using synthetic acceleration series for braking, acceleration, turns, vertical impacts, and rough roads.
- Scoring with known event sets and confidence markers.
- Export shape and determinism.
- Persistence contracts for batched writes, interruption recovery, and finalization.
- Wake lock support, unavailability, release, and visibility recovery.
- Real-time discomfort index smoothing and decay.
- Core UI flow: permissions, calibration, recording, finishing, reviewing, and exporting.

Real exported trip fixtures can become regression tests later, but they should be handled carefully because they may contain sensitive route data.

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

Backseat Inspector is a working project name. It reflects the app's purpose: giving the driver a passenger-comfort report after the trip, without turning the trip screen into a distracting dashboard.
