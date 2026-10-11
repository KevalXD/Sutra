# Sutra Round 1 Demo and Submission Plan

## 1. External requirements

The DevHack 2026 rulebook states that Round 1 is an online ideation round. The submission includes a PPT and a drive link containing an MVP demo video. The rulebook explicitly says the MVP demo video carries extra weight.

The Round 1 PPT must include:

- team name and members;
- team leader contact details and college;
- problem statement;
- solution summary;
- technical approach and flow diagrams;
- impact and benefits;
- business impact;
- market potential and scalability;
- GitHub link of MVP;
- demo video.

The organizing team also requires use of the supplied PPT template without modifying its contents.

## 2. Demo objective

The demo should prove one thing clearly:

> Sutra can take a disrupted existing journey and produce a constraint-valid recovery plan.

## 3. Golden demo story

```text
1. Show existing rail itinerary.
2. Show traveller constraints.
3. Start recovery.
4. Show rail delay.
5. Show affected booking/connection.
6. Show downstream impact.
7. Show candidate alternatives.
8. Show hard-constraint rejection.
9. Show AI recommendation.
10. Show independent-feasibility result.
11. Show repaired itinerary.
12. Show changes/cost/constraint status.
13. Show traveller actions.
```

## 4. Secondary proof scenarios

Use short demonstrations or screenshots for:

```text
delay → no feasible recovery
cancellation → recovery
technical failure → retry
```

Do not let secondary cases consume most of the presentation time.

## 5. Judge-visible proof points

The judge must be able to see:

```text
Disruption
→ affected bookings
→ alternatives
→ hard constraints
→ AI decision
→ repaired itinerary
```

Avoid relying on verbal claims about hidden backend behavior.

## 6. AI demonstration

The AI portion should be framed as:

```text
Deterministic engine
  → removes invalid options

AI
  → ranks/explains valid options

Deterministic validator
  → verifies the recommendation
```

This is more credible than presenting the LLM as the sole source of truth.

## 7. Failure-safe demo

The guaranteed demo must use deterministic fixtures.

If a live API exists in the build, it should be optional enrichment, not a dependency.

Keep a known-good local scenario path available for rehearsal and recording.

## 8. Demo language discipline

Prefer:

- "simulated disruption" when the source is simulated;
- "recovery offer" when provider bookability is unverified;
- "proposed action" when no transaction has occurred;
- "feasible" only when hard constraints have passed.

Avoid:

- "live" when the data is simulated;
- "booked" when a transaction was not executed;
- "available" when only schedule data is known;
- "optimal" unless the optimization claim is actually proved.

## 9. PPT planning

The PPT should tell the same story as the product:

```text
problem
→ why current travel disruption handling is insufficient
→ Sutra approach
→ technical architecture
→ recovery flow
→ impact
→ business/scalability
→ working MVP proof
```

Do not introduce capabilities in slides that are not represented in the MVP.

## 10. Demo video planning

The video should prioritize:

- one uninterrupted golden-path recovery;
- visible constraint filtering;
- clear repaired itinerary;
- short explanation of AI boundary;
- distinct infeasible/error behavior if time permits.

## 11. Round 1 submission checklist

```text
[ ] Required PPT template followed exactly
[ ] Team information correct
[ ] PS 4.1 clearly identified
[ ] Solution summary matches MVP
[ ] Technical approach matches actual architecture
[ ] Impact claims are supported
[ ] Business/scalability claims are credible
[ ] GitHub MVP link works
[ ] Demo video link works
[ ] Golden path recorded successfully
[ ] No unsupported capability is claimed
[ ] Final rehearsal completed
```

## 12. Final rehearsal standard

The team should perform the demo from a clean environment and be able to recover from:

- refresh;
- API restart;
- scenario restart;
- AI timeout/fallback;
- no-feasible scenario.

The recorded demo should remain valid even if a live external service is unavailable.
