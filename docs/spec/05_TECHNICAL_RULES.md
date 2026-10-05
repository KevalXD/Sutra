# Sutra - Technical Rules

## 1. Purpose

This document defines the implementation rules for the Sutra frontend.

The goal is a premium, reliable, maintainable hackathon frontend that can integrate with a separately developed backend without coupling the visual layer to backend implementation details.

---

## 2. Required Stack

| Area | Decision |
|---|---|
| Framework | Next.js App Router |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component foundation | shadcn/ui where useful |
| Primary animation | Motion |
| Advanced animation | GSAP only where justified |
| Smooth scroll | Lenis only where justified |
| Icons | Lucide React |
| State | React state/reducer/context only when justified |
| API | Small typed Sutra API/client abstraction |
| Demo data | Deterministic local simulator |
| Testing | Practical component/workflow checks appropriate to the repo |

The implementation should not add unnecessary libraries.

---

## 3. Existing Project Compatibility

The current frontend context is expected to use:
- Next.js 15 App Router;
- React 19;
- TypeScript;
- Tailwind CSS v4;
- Motion;
- Lucide React.

Before changing architecture:
1. inspect the existing repository;
2. identify the actual active frontend;
3. identify existing API handlers;
4. identify the existing workflow/state logic;
5. preserve working backend/state behavior unless there is a clear reason to change it.

Do not rebuild the backend merely to improve the UI.

---

## 4. Component Architecture

Separate concerns into:

```text
data/API
   ↓
workflow/state
   ↓
domain UI components
   ↓
visual/animation components
```

A visual component should not directly know how a third-party API works.

Recommended conceptual structure:

```text
app/
components/
  sutra/
lib/
hooks/
styles/
```

Exact filenames may vary if the existing repository has a sound structure.

---

## 5. API Boundary

Create or preserve a single frontend-facing API layer.

Visual components should receive normalized data such as:
- itinerary;
- disruption;
- constraints;
- impact;
- recovery result.

Avoid scattered endpoint strings throughout JSX.

---

## 6. State Management

Prefer:
- `useState`;
- `useReducer`;
- React context only when justified.

Do not add Redux or Zustand by default.

The workflow has a finite set of states and should avoid contradictory combinations.

If the existing `hooks/use-recovery-flow.ts` correctly manages this workflow, preserve and improve it rather than replacing it without evidence.

---

## 7. Deterministic Demo

The application must remain demoable without a live backend.

The deterministic simulator should:
- work offline;
- be repeatable;
- support delay and cancellation scenarios;
- produce valid success and/or no-feasible-recovery states;
- expose technical failure separately where needed.

The demo must never rely on random values that could change between judging runs.

---

## 8. Animation Rules

### Motion

Use Motion for the majority of UI animation.

Good uses:
- entrance/reveal;
- workflow state transitions;
- layout changes;
- hover/focus;
- result resolution.

### GSAP

Use GSAP only for genuinely advanced sequences such as:
- SVG path drawing;
- scroll-driven choreography;
- complex timeline animation.

### Lenis

Use only if smooth scrolling materially improves the experience.

Do not introduce Lenis if it causes:
- scroll accessibility problems;
- mobile issues;
- unnecessary complexity.

---

## 9. Animation Performance

Avoid:
- animating large numbers of DOM nodes continuously;
- unnecessary blur animation;
- heavy canvas effects;
- continuous particles behind every section;
- layout-thrashing animations.

Prefer:
- `transform`;
- `opacity`;
- CSS transitions;
- GPU-friendly properties.

Animations should not delay the appearance of critical recovery information.

---

## 10. Reduced Motion

Every major animated experience must have a reduced-motion path.

Respect:

```text
prefers-reduced-motion
```

A user must still understand:
- disruption;
- impact;
- recovery status;
- repaired itinerary;

without animation.

---

## 11. Icons

Use Lucide React as the primary icon system.

Do not mix several unrelated icon families without a strong reason.

Icons should:
- reinforce meaning;
- remain visually consistent;
- not replace necessary labels.

---

## 12. External UI Components

Approved component sources include:
- React Bits;
- Aceternity UI;
- Magic UI;
- Motion Primitives;
- Skiper UI.

Use only components that are:
- free/openly usable for the project;
- compatible with the repository;
- actually available from source or installable dependency;
- visually appropriate for Sutra.

Do not assume a registry demo's source code is available merely because a usage snippet exists.

---

## 13. `core-sutra-ui.md` Rule

`core-sutra-ui.md` is a curated registry/reference document.

It may contain:
- component names;
- source/registry references;
- installation instructions;
- usage examples;
- notes on priority;
- licensing/attribution information.

It does not automatically guarantee that complete source code exists for every entry.

The implementation agent must classify each component as one of:

```text
SOURCE PROVIDED
USAGE / INSTALL INFO ONLY
SOURCE REQUIRED
SUTRA-NATIVE IMPLEMENTATION
NOT USED
```

Never claim to have integrated original source that was not actually supplied.

---

## 14. Priority Components

The intended visual system prioritizes:

1. Tracing Beam
2. Thought Line
3. Status Mark
4. Spring Check
5. Scroll Stack
6. Floating Dock
7. Swipe Toast
8. Progressive Blur
9. Skiper 19
10. Skiper 17, optional

These should be used selectively.

The objective is not to maximize the number of imported components.

---

## 15. Avoid Component Soup

Do not use:
- multiple cursor systems;
- multiple shimmer systems;
- multiple competing navigation patterns;
- decorative components with no semantic purpose;
- five animation libraries for the same interaction.

Every major visual component should answer a question:

> Does this improve understanding, hierarchy, continuity, or premium presentation?

If not, omit it.

---

## 16. Responsive Rules

Desktop is the primary showcase environment, but the application must remain usable on:
- desktop;
- tablet;
- mobile.

Do not solve responsiveness only by shrinking everything.

On mobile:
- convert journey layouts to vertical flow;
- stack major panels;
- simplify path visualizations;
- preserve semantic order;
- keep actions accessible.

---

## 17. Accessibility Rules

Required:
- semantic HTML;
- keyboard access;
- visible focus;
- adequate contrast;
- descriptive labels;
- meaningful alt text;
- no hover-only information;
- reduced-motion support.

Do not make decorative animation interfere with:
- focus;
- reading;
- clicking;
- scrolling.

---

## 18. Image and Asset Rules

Use imagery only when it contributes to:
- travel context;
- atmosphere;
- hierarchy;
- storytelling.

Avoid generic stock-photo collage aesthetics.

Do not introduce external image dependencies that can break the demo.

If an image is required for a core visual, provide a stable local or repository-managed asset where practical.

---

## 19. Performance Rules

Prioritize:
- fast initial render;
- limited JavaScript;
- optimized images;
- lazy loading for non-critical media;
- no unnecessary third-party scripts.

Do not add a visual effect that creates a noticeable performance penalty on ordinary hardware.

---

## 20. Error Boundaries and Failure Handling

The frontend should fail gracefully.

At minimum distinguish:

```text
successful recovery
no feasible recovery
technical failure
```

A technical failure must never be silently converted into a no-recovery state.

---

## 21. Security and Trust

The frontend must not:
- expose secrets;
- embed private API keys;
- place provider credentials in client code;
- trust user-controlled query parameters as authoritative backend data;
- bypass backend validation.

Authentication is outside the MVP.

---

## 22. Logging

Development logs may be used during implementation.

Production/demo UI should not expose:
- stack traces;
- private prompts;
- internal server details;
- secrets;
- raw provider credentials.

User-facing messages should remain concise and useful.

---

## 23. Code Quality

Prefer:
- small focused components;
- typed props;
- reusable domain primitives;
- clear naming;
- centralized constants/tokens;
- minimal duplication.

Avoid:
- giant monolithic page components;
- hard-coded recovery results inside presentation components;
- duplicated API logic;
- unexplained magic numbers;
- unused imports/dependencies.

---

## 24. Visual Token Usage

Use the values defined in `02_UI_DESIGN_SPEC.md`.

Do not silently introduce a second color system.

If a component library uses different defaults:
- adapt it to Sutra tokens;
- preserve its interaction behavior where useful;
- avoid allowing library defaults to redefine the product identity.

---

## 25. Tailwind and CSS

Use Tailwind for normal layout and styling.

Use custom CSS only when:
- the visual effect genuinely requires it;
- the rule would be awkward or brittle in utility classes;
- a component library requires a specific implementation.

Avoid large uncontrolled global styles.

---

## 26. Build and Integration Discipline

Before implementation:
1. inspect the repository;
2. identify the active frontend;
3. identify existing working workflow/API code;
4. identify available component sources;
5. map the source to the required UI.

During implementation:
1. build the workflow shell;
2. integrate core domain UI;
3. integrate verified visual components;
4. add motion;
5. add responsive behavior;
6. run build/type checks;
7. inspect all workflow states.

---

## 27. QA Checklist

Before declaring the frontend complete, verify:

### Functional
- [ ] `/` loads.
- [ ] `/?scenario=delay` loads.
- [ ] `/?scenario=cancellation` loads.
- [ ] Trip data renders.
- [ ] Disruption renders.
- [ ] Impact stage renders.
- [ ] Recovery analysis renders.
- [ ] Feasible recovery renders.
- [ ] No-feasible-recovery renders.
- [ ] Technical error is distinct.

### Visual
- [ ] Sutra color tokens are used.
- [ ] Typography matches the specification.
- [ ] Workflow feels continuous.
- [ ] No generic dashboard/card-grid overload.
- [ ] Animation supports the narrative.
- [ ] Component integrations are actually visible.
- [ ] No unnecessary decorative effects dominate.

### Accessibility
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Labels are meaningful.
- [ ] Reduced motion works.
- [ ] Color is not the only status indicator.

### Engineering
- [ ] TypeScript passes.
- [ ] Production build passes.
- [ ] No missing imports.
- [ ] No dead dependencies introduced.
- [ ] API calls remain behind the intended abstraction.
- [ ] No secrets are exposed.
- [ ] Demo works without external API dependency.

---

## 28. Definition of Done

The frontend is complete only when:

1. The Sutra workflow is visually coherent from trip to recovery.
2. The locked design tokens are applied consistently.
3. The supplied/verified UI components are integrated honestly.
4. Missing component source is not fabricated.
5. Existing working backend/state behavior remains functional.
6. Both delay and cancellation scenarios work.
7. Feasible, infeasible, and technical-error outcomes are distinguishable.
8. The deterministic demo works without external services.
9. Responsive and reduced-motion behavior is functional.
10. The application passes build/type checks.

A polished appearance alone is not sufficient. The implementation must preserve the product's recovery logic and data contract.
