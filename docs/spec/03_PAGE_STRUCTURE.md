# Sutra - Page and Workflow Structure

## 1. Route Model

Sutra uses one primary frontend route:

```text
/
```

Optional demo scenarios:

```text
/?scenario=delay
/?scenario=cancellation
```

The application should not create separate routes for:
- disruption;
- impact;
- recovery analysis;
- alternatives;
- recovery result.

These are stages inside one continuous experience.

---

## 2. Application Structure

Recommended high-level structure:

```text
App Shell
├── Header / Navigation
├── Hero / Trip Context
├── Workflow Stage Indicator
├── Trip Overview
├── Disruption Event
├── Impact Analysis
├── Recovery Analysis
├── Recovery Result
├── Alternatives / Supporting Detail
└── Footer / Attribution where required
```

The exact React component names may vary. The information architecture must remain consistent.

---

## 3. Header

Purpose:
- establish Sutra identity;
- provide a restrained navigation/context layer;
- avoid unnecessary product-dashboard navigation.

Possible content:
- Sutra wordmark/name;
- short context label;
- compact workflow status;
- optional scenario control for demo mode.

Do not add:
- login/profile/settings navigation;
- unrelated SaaS navigation;
- fake notification counters.

---

## 4. Hero / Trip Context

The hero establishes:
- the traveller journey;
- the purpose of Sutra;
- the current recovery context.

The hero should not become a generic marketing landing page.

Primary visual narrative:

```text
TRIP
  ↓
DISRUPTION
  ↓
IMPACT
  ↓
RECOVERY
```

Use large typography, travel/journey geometry, restrained motion, and strong negative space.

---

## 5. Trip Overview

Show enough information to understand the original itinerary.

### Required concepts

**Bookings**
- flight, train, or hotel;
- origin;
- destination;
- start/end time;
- cost.

**Traveller constraints**
- home;
- maximum extra budget;
- overnight restriction when applicable;
- must-arrive-by goals.

The user should be able to understand the itinerary before the disruption is introduced.

---

## 6. Disruption Stage

Show:
- affected booking;
- disruption type;
- delay duration when applicable;
- immediate effect.

Supported disruption types:

```text
delay
cancel
```

The disruption should visually interrupt the original journey rather than appearing as an unrelated alert card.

---

## 7. Impact Analysis Stage

Core relationship:

```text
Disrupted Booking
      ↓
Immediate Effect
      ↓
Downstream Booking
      ↓
Constraint Impact
```

The UI should communicate causality.

Useful visual mechanisms:
- Tracing Beam;
- SVG journey path;
- connected timeline;
- Status Mark;
- Thought Line;
- carefully staged reveal.

Do not show invented internal reasoning.

---

## 8. Recovery Analysis Stage

This stage communicates that Sutra is evaluating possible recovery paths.

Suggested user-facing activity:

```text
Checking affected bookings...
Tracing downstream connections...
Evaluating recovery candidates...
Validating traveller constraints...
```

The activity should be concise and deterministic in the demo.

The UI should avoid exposing:
- hidden chain-of-thought;
- raw model prompts;
- private internal deliberation;
- fabricated probability scores.

---

## 9. Recovery Result Stage

The result should appear as the strongest visual moment in the workflow.

### Priority

```text
Recovery status
      ↓
Repaired itinerary
      ↓
Constraint status
      ↓
Changes / cost
      ↓
Explanation
      ↓
Alternatives
```

### Feasible result

Show:
- success status;
- repaired itinerary;
- unchanged and changed bookings;
- additional cost;
- constraint validation;
- concise explanation;
- optional alternatives.

The result should answer:

> What happened, what did Sutra change, and does the repaired journey still satisfy the traveller's requirements?

---

## 10. No Feasible Recovery

Use a distinct terminal presentation.

Show:
- "No feasible recovery" status;
- relevant violated constraints;
- affected bookings;
- concise explanation;
- option to retry or inspect the original itinerary.

Do not present:
- green success indicators;
- a fake repaired itinerary;
- a technical error message.

---

## 11. Technical Error

Use a distinct error presentation.

Show:
- technical failure status;
- short explanation;
- retry action when appropriate.

Do not claim that the journey is infeasible simply because the API failed.

---

## 12. Demo Scenario Model

### Delay scenario

A disruption changes the timing of an existing booking and may invalidate a downstream connection or arrival requirement.

The interface should show the progression from:
- original itinerary;
- delay;
- downstream effect;
- recovery evaluation;
- repaired result.

### Cancellation scenario

A booking is cancelled and the recovery engine must evaluate replacement options.

The interface should show:
- cancelled booking;
- downstream impact;
- alternative evaluation;
- constraint validation;
- repaired result or infeasibility.

---

## 13. Responsive Structure

### Desktop

Use:
- wide editorial composition;
- strong journey/path visualization;
- two-column layouts where helpful;
- generous horizontal spacing.

### Tablet

Reduce:
- horizontal density;
- large display typography;
- side-by-side content where necessary.

### Mobile

Use:
- vertical journey flow;
- stacked itinerary items;
- compact status indicators;
- horizontally scrollable content only where semantically appropriate.

Do not simply shrink the desktop dashboard.

---

## 14. Component Placement Guidance

| Experience | Candidate component |
|---|---|
| Journey/recovery path | Tracing Beam / Skiper 19 |
| Stage status | Status Mark |
| Successful validation | Spring Check |
| Operational activity | Thought Line / adapted Terminal |
| Floating actions | Floating Dock |
| Compact result notification | Swipe Toast |
| Hero depth | Parallax Hero Images |
| Progressive content reveal | Scroll Stack / Scroll Expand |
| Typography emphasis | Kinetic Text / Text Loop |
| Atmospheric depth | Progressive Blur / restrained Side Rays |

These are candidates, not mandatory simultaneous inclusions.

---

## 15. Interaction Sequence

Recommended sequence:

```text
1. User sees trip
2. User starts recovery
3. Disruption becomes explicit
4. Journey impact is traced
5. Recovery analysis runs
6. Result resolves
7. Repaired itinerary becomes dominant
8. Supporting explanation is revealed
```

Motion should reinforce this sequence.

Avoid long animations that delay useful information.

---

## 16. State-to-UI Mapping

| State | Primary UI emphasis |
|---|---|
| IDLE | Trip context + start action |
| TRIP_LOADED | Itinerary + constraints |
| DISRUPTION_DETECTED | Disruption + affected booking |
| IMPACT_ANALYSIS | Journey impact path |
| RECOVERY_ANALYSIS | Operational activity |
| RECOVERY_READY | Repaired itinerary |
| NO_FEASIBLE_RECOVERY | Violated constraints |
| TECHNICAL_ERROR | Failure + retry |

---

## 17. Navigation Philosophy

Sutra is a workflow, not a collection of pages.

The user should feel that the same journey is being progressively understood and repaired.

Avoid:
- route changes for every workflow stage;
- browser-like navigation between stages;
- duplicated trip data across pages.

---

## 18. Attribution

If a selected external component requires attribution under its license, provide the required attribution in an appropriate unobtrusive location.

Do not remove required license or attribution information.
