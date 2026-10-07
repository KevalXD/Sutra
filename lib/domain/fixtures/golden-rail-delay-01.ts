import type {
  Alternative,
  Disruption,
  RecoveryCandidate,
  Trip,
} from "../types";

const DAY = "2026-11-10";
const NEXT_DAY = "2026-11-11";

export const goldenTrip: Trip = {
  id: "trip-golden-rail-delay-01",
  version: 1,
  currency: "INR",

  items: [
    {
      id: "RAIL-A",
      kind: "transport",
      label: "Rail A",
      mode: "rail",
      legs: [
        {
          id: "RAIL-A-LEG-1",
          bookingId: "RAIL-A",
          origin: "Mangaluru Central",
          destination: "Hassan Junction",
          departureAt: `${DAY}T09:00:00`,
          arrivalAt: `${DAY}T13:00:00`,
        },
      ],
    },
    {
      id: "RAIL-B",
      kind: "transport",
      label: "Rail B",
      mode: "rail",
      legs: [
        {
          id: "RAIL-B-LEG-1",
          bookingId: "RAIL-B",
          origin: "Hassan Junction",
          destination: "Mysuru Junction",
          departureAt: `${DAY}T13:30:00`,
          arrivalAt: `${DAY}T15:30:00`,
        },
      ],
    },
    {
      id: "HOTEL-1",
      kind: "accommodation",
      label: "Mysuru Hotel",
      location: "Mysuru",
      checkInAt: `${DAY}T17:00:00`,
      checkOutAt: `${NEXT_DAY}T10:00:00`,
    },
  ],

  dependencies: [
    {
      id: "DEP-RAIL-A-RAIL-B",
      fromItemId: "RAIL-A",
      toItemId: "RAIL-B",
      kind: "CONNECTION",
      minimumBufferMinutes: 30,
    },
    {
      id: "DEP-RAIL-B-HOTEL-1",
      fromItemId: "RAIL-B",
      toItemId: "HOTEL-1",
      kind: "WINDOW",
    },
  ],

  constraints: {
    latestArrivalAt: `${DAY}T19:00:00`,
    maxExtraBudget: 500,
    noOvernight: true,
    softPreferences: ["EARLIER_ARRIVAL"],
  },
};

export const goldenDisruption: Disruption = {
  source: "SIMULATED",
  scenarioId: "golden-rail-delay-01",
  bookingId: "RAIL-A",
  kind: "delay",
  delayMinutes: 120,
};

export const goldenAlternatives: Alternative[] = [
  {
    id: "RC-A-ALT",
    replacementForBookingId: "RAIL-B",
    arrivalAt: `${DAY}T17:45:00`,
    extraCost: 450,
    source: "SIMULATED_OFFER",
  },
  {
    id: "RC-B-ALT",
    replacementForBookingId: "RAIL-B",
    arrivalAt: `${DAY}T18:30:00`,
    extraCost: 350,
    source: "SIMULATED_OFFER",
  },
  {
    id: "RC-C-ALT",
    replacementForBookingId: "RAIL-B",
    arrivalAt: `${DAY}T19:30:00`,
    extraCost: 250,
    source: "SIMULATED_OFFER",
  },
  {
    id: "RC-D-ALT",
    replacementForBookingId: "RAIL-B",
    arrivalAt: `${DAY}T23:30:00`,
    extraCost: 150,
    source: "SIMULATED_OFFER",
  },
  {
    id: "RC-E-ALT",
    replacementForBookingId: "RAIL-B",
    arrivalAt: `${DAY}T17:45:00`,
    extraCost: 700,
    source: "SIMULATED_OFFER",
  },
];

export const goldenCandidates: RecoveryCandidate[] = [
  {
    id: "RC-A",
    alternatives: [goldenAlternatives[0]],
    impactStates: {
      "RAIL-A": "DISRUPTED",
      "RAIL-B": "AFFECTED",
      "HOTEL-1": "AFFECTED",
    },
    recoveryChanges: {
      "RAIL-A": "UNCHANGED",
      "RAIL-B": "REPLACED",
      "HOTEL-1": "UNCHANGED",
    },
    feasible: true,
    violations: [],
    extraCost: 450,
    finalArrivalAt: `${DAY}T17:45:00`,
  },
  {
    id: "RC-B",
    alternatives: [goldenAlternatives[1]],
    impactStates: {
      "RAIL-A": "DISRUPTED",
      "RAIL-B": "AFFECTED",
      "HOTEL-1": "AFFECTED",
    },
    recoveryChanges: {
      "RAIL-A": "UNCHANGED",
      "RAIL-B": "REPLACED",
      "HOTEL-1": "UNCHANGED",
    },
    feasible: true,
    violations: [],
    extraCost: 350,
    finalArrivalAt: `${DAY}T18:30:00`,
  },
  {
    id: "RC-C",
    alternatives: [goldenAlternatives[2]],
    impactStates: {
      "RAIL-A": "DISRUPTED",
      "RAIL-B": "AFFECTED",
      "HOTEL-1": "AFFECTED",
    },
    recoveryChanges: {
      "RAIL-A": "UNCHANGED",
      "RAIL-B": "REPLACED",
      "HOTEL-1": "UNCHANGED",
    },
    feasible: false,
    violations: [
      {
        kind: "LATEST_ARRIVAL",
        itemId: "RAIL-B",
        message: "Final arrival at 19:30 exceeds the 19:00 latest-arrival constraint.",
      },
    ],
    extraCost: 250,
    finalArrivalAt: `${DAY}T19:30:00`,
  },
  {
    id: "RC-D",
    alternatives: [goldenAlternatives[3]],
    impactStates: {
      "RAIL-A": "DISRUPTED",
      "RAIL-B": "AFFECTED",
      "HOTEL-1": "AFFECTED",
    },
    recoveryChanges: {
      "RAIL-A": "UNCHANGED",
      "RAIL-B": "REPLACED",
      "HOTEL-1": "UNCHANGED",
    },
    feasible: false,
    violations: [
      {
        kind: "LATEST_ARRIVAL",
        itemId: "RAIL-B",
        message: "Final arrival at 23:30 exceeds the 19:00 latest-arrival constraint.",
      },
      {
        kind: "NO_OVERNIGHT",
        itemId: "RAIL-B",
        message: "Recovery requires overnight travel while overnight travel is prohibited.",
      },
    ],
    extraCost: 150,
    finalArrivalAt: `${DAY}T23:30:00`,
  },
  {
    id: "RC-E",
    alternatives: [goldenAlternatives[4]],
    impactStates: {
      "RAIL-A": "DISRUPTED",
      "RAIL-B": "AFFECTED",
      "HOTEL-1": "AFFECTED",
    },
    recoveryChanges: {
      "RAIL-A": "UNCHANGED",
      "RAIL-B": "REPLACED",
      "HOTEL-1": "UNCHANGED",
    },
    feasible: false,
    violations: [
      {
        kind: "MAX_EXTRA_BUDGET",
        itemId: "RAIL-B",
        message: "Extra cost of ₹700 exceeds the maximum recovery budget of ₹500.",
      },
    ],
    extraCost: 700,
    finalArrivalAt: `${DAY}T17:45:00`,
  },
];

export const goldenExpectedRecommendation = {
  selectedCandidateId: "RC-A",
  decisionSource: "AI" as const,
};

export const goldenExpectedFallback = {
  selectedCandidateId: "RC-B",
  decisionSource: "DETERMINISTIC_FALLBACK" as const,
};
