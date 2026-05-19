# Backseat Inspector

Backseat Inspector is a driving comfort context concerned with how a trip felt for passengers, while avoiding unsupported claims about safety or efficiency.

## Language

**Comfort Report**:
A post-trip summary of passenger comfort, detected comfort events, confidence markers, and Trip Review data for one Trip.
_Avoid_: Driver score, safety report, driving evaluation

**Raw View**:
The Comfort Report view that includes all captured data and all detected Comfort Events.
_Avoid_: Unfiltered report

**Trusted View**:
The Comfort Report view that applies confidence markers to reduce the influence of low-confidence data without deleting it.
_Avoid_: Filtered report, clean report

**Trip**:
A single user-controlled recording period from start to finish, whether or not the vehicle is moving for the entire duration.
_Avoid_: Drive, recording session

**Comfort Event**:
A time-bounded moment or segment during a trip that contributes to passenger discomfort.
_Avoid_: Violation, infraction, safety incident

**Confidence Marker**:
A label on trip data that indicates reduced trust in sensor, location, calibration, or phone-placement quality.
_Avoid_: Data deletion, invalid sample

**Comfort Signal**:
A real-time, transient indication of current passenger comfort used for ambient trip feedback.
_Avoid_: Live score, safety warning, discomfort index

**Passenger Comfort**:
How smooth or uncomfortable a trip likely felt to a passenger.
_Avoid_: Safety, danger, efficiency

**Driver Control**:
The app's estimate of how much the driver's choices contributed to the comfort outcome.
_Avoid_: Driver blame, driving skill, fault

**Comfort Index**:
An experimental 0-100 summary of passenger comfort for a Comfort Report.
_Avoid_: Score, grade, rating, safety score

**Trip Review**:
A user-provided assessment of a Comfort Report, including event labels, whole-trip perception, missed events, and notes.
_Avoid_: Feedback bundle, survey

**Event Label**:
A user-provided assessment of one Comfort Event.
_Avoid_: Event feedback, correction

## Relationships

- A **Comfort Report** belongs to exactly one **Trip**.
- A **Comfort Report** has one **Raw View** and one **Trusted View**.
- A **Comfort Report** contains zero or more **Comfort Events**.
- A **Comfort Report** may include a **Comfort Index**.
- A **Comfort Report** may have one **Trip Review**.
- A **Comfort Report** separates **Passenger Comfort** from **Driver Control**.
- A **Trip** contains zero or more **Comfort Events**.
- A **Trip** contains zero or more **Confidence Markers**.
- A **Trip** may show a **Comfort Signal** while recording.
- A **Trusted View** uses **Confidence Markers** to reduce the influence of low-confidence data.
- A **Comfort Event** may be a hard braking, strong acceleration, uncomfortable turn, vertical impact, or rough-road segment.
- A **Trip Review** contains zero or more **Event Labels**.
- An **Event Label** belongs to exactly one **Comfort Event**.

## Example dialogue

> **Dev:** "Should the app show the driver a safety grade after the trip?"
> **Domain expert:** "No — it should produce a **Comfort Report**, because the app evaluates passenger comfort rather than driving safety."

## Flagged ambiguities

- "report", "raw report", and "filtered report" are views or descriptions of a **Comfort Report**, not separate domain concepts.
- "filtered" does not mean deleting low-confidence data; use **Trusted View** for confidence-weighted interpretation.
