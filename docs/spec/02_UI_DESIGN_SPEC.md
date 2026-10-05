# Sutra - UI Design Specification

## 1. Design Direction

**Visual direction:** Luxury Travel × Intelligent Operations × Cinematic Restraint

Sutra should combine the atmosphere of premium travel interfaces with the clarity of an operations system.

The design should communicate intelligence through structure, motion, hierarchy, and precise status communication - not through stereotypical "AI" decoration.

---

## 2. Color System

### Foundation

| Token | Hex |
|---|---|
| Background | `#07110E` |
| Surface | `#0B1814` |
| Surface Elevated | `#10211B` |
| Surface Soft | `#142820` |
| Border | `#20352C` |
| Border Strong | `#2D463A` |

### Typography

| Token | Hex |
|---|---|
| Text Primary | `#F4F1E8` |
| Text Secondary | `#B8C3BD` |
| Text Muted | `#7D8B84` |
| Text Disabled | `#52615A` |

### Brand

| Token | Hex |
|---|---|
| Brand Green | `#54C98B` |
| Brand Green Bright | `#79E2A8` |
| Brand Green Deep | `#195D3A` |
| Brand Green Soft | `#163B2C` |

### Travel

| Token | Hex |
|---|---|
| Travel Blue | `#5C8EDB` |
| Travel Blue Bright | `#78A9F0` |
| Travel Blue Soft | `#172C45` |

### Semantic

| Token | Hex |
|---|---|
| Success | `#54C98B` |
| Warning | `#E6B85C` |
| Danger | `#E36C68` |
| Information | `#6FA6E8` |

### Usage ratio

Use approximately:

```text
70% neutral foundation
20% typography / structural contrast
10% accent / semantic color
```

Accent colors should communicate meaning. They should not become decorative wallpaper.

---

## 3. Typography

### Font families

**Display / headings**
- Instrument Sans

**Body / UI**
- Inter

**Technical / agent activity**
- IBM Plex Mono

### Type scale

| Role | Size |
|---|---:|
| H1 | 64-88px |
| H2 | 40-56px |
| H3 | 28-36px |
| Body | 16-18px |
| UI | 14-15px |
| Caption | 12-13px |
| Technical | 12-14px |

Recommended weights:
- 400
- 500
- 600
- 700

Do not use 900 as a default visual weight.

Responsive typography should scale down appropriately rather than forcing desktop sizes onto mobile.

---

## 4. Radius

| Token | Value |
|---|---:|
| XS | 6px |
| SM | 10px |
| MD | 14px |
| LG | 18px |
| XL | 24px |
| Pill | 999px |

Guidance:
- Standard cards: 14px
- Major panels: 18px
- Hero surfaces: 18-24px
- Buttons: 10px
- Status badges: pill

Avoid rounding every nested element.

---

## 5. Shadows

```text
Level 1:
0 4px 20px rgba(0,0,0,0.18)

Level 2:
0 12px 40px rgba(0,0,0,0.24)

Level 3:
0 24px 70px rgba(0,0,0,0.30)
```

Use shadows to establish hierarchy, not as decoration.

---

## 6. Glass Treatment

Glass is optional and must be restrained.

Recommended characteristics:
- surface opacity around 72%;
- backdrop blur around 18px;
- low-opacity border;
- dark foundation underneath.

Use glass selectively for:
- floating controls;
- navigation;
- contextual overlays;
- selected hero surfaces.

Do not turn the entire application into translucent glass.

---

## 7. Gradients

### Atmospheric gradient

```text
#07110E → #0B1814 → #10211B
```

### Optional accent gradient

```text
#195D3A → #5C8EDB
```

Accent gradients should remain low-opacity and purposeful.

Avoid purple/cyan AI gradients.

---

## 8. Layout Principles

The interface should have strong visual hierarchy and generous negative space.

Priorities:
1. Current recovery status.
2. Journey relationship.
3. Important constraints.
4. Recovery result.
5. Supporting operational detail.

Use a structured editorial layout rather than a wall of cards.

Prefer:
- large journey bands;
- connected timeline/path structures;
- asymmetric but balanced compositions;
- progressive disclosure;
- focused result panels.

Avoid:
- dashboard grids filled with equal-sized cards;
- excessive metric tiles;
- nested cards inside cards;
- ornamental separators everywhere.

---

## 9. Motion Philosophy

Motion should communicate state, continuity, and causality.

### Primary animation library

Motion.

Use Motion for:
- state transitions;
- layout transitions;
- reveal sequences;
- subtle hover/focus states;
- workflow progression.

### Advanced animation

GSAP may be used for:
- cinematic scroll-driven sequences;
- complex SVG path drawing;
- advanced timeline choreography.

GSAP should not be added merely because it is available.

### Lenis

Use Lenis only if a smooth-scroll implementation materially improves the experience and does not interfere with accessibility or native browser behavior.

---

## 10. Reduced Motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

When reduced motion is requested:
- disable or simplify decorative movement;
- remove large parallax effects;
- avoid continuous looping animation;
- preserve state transitions through opacity/color/instant layout changes;
- keep all content understandable without animation.

Motion must never be the only way to understand a state.

---

## 11. Visual Workflow

The main experience should visually reinforce:

```text
TRIP → DISRUPTION → IMPACT → RECOVERY → EXPLANATION
```

The transition between stages should feel continuous.

Do not navigate the user through separate pseudo-pages for each stage.

---

## 12. Component Roles

The selected component families are reference building blocks, not permission to use every component simultaneously.

### React Bits

Primary/core candidates:
- Scroll Stack
- Status Mark
- Spring Check
- Swipe Toast
- Thought Line
- Target Cursor
- Scroll Expand

Conditional:
- Flex Carousel
- Accordion Gallery
- Folder / Folder Float
- Chroma Grid
- Lattice Loader
- Call Chip

Atmospheric:
- Side Rays
- Particles

Low priority:
- Ripple Distortion

### Aceternity UI

Core candidates:
- Parallax Hero Images
- Terminal, repurposed as concise Sutra agent activity
- Floating Dock
- Tracing Beam

Conditional:
- 3D Globe
- 3D Animated Pin
- File Upload
- Gooey Input

Dropped:
- GitHub Globe
- 3D Marquee
- Animated Testimonials

### Magic UI

Core:
- Kinetic Text, used sparingly

Conditional:
- Orbiting Circles
- Aurora Text

Atmospheric:
- Meteors

Dropped:
- Pulsating Button
- Smooth Cursor when another cursor system is already selected

### Motion Primitives

Core:
- Text Loop
- Text Shimmer Basic
- Toolbar Dynamic
- Progressive Blur

Conditional:
- Image Comparison

Dropped/redundant:
- Text Shimmer Wave Color
- duplicate cursor implementations

### Skiper UI

Approved free components:
- Skiper 19 - SVG path drawing / scroll-driven sequence; preferred for the recovery path
- Skiper 17 - sticky card stack; optional
- Skiper 50 - conditional carousel/depth treatment

Pro-only components must not be used:
- Skiper 12
- Skiper 23
- Skiper 35
- Skiper 80
- Skiper 88

If a free component requires attribution, preserve the required attribution/license obligations.

---

## 13. Component Source Rule

`core-sutra-ui.md` is a curated component specification and source inventory.

It must not be treated as if it contains complete source code for every listed component.

When complete source code is supplied:
- integrate the source directly where practical;
- preserve the component's intended behavior;
- adapt styling to Sutra tokens.

When only installation/usage information exists:
- do not fabricate a claim that the original source was integrated;
- do not invent missing files from a registry demo;
- either obtain the actual source or create a clearly Sutra-native implementation.

The final implementation report must distinguish:
- integrated original/source-provided component;
- adapted component;
- Sutra-native implementation;
- not integrated.

---

## 14. Interaction Details

Buttons:
- clear labels;
- 10px radius;
- restrained hover movement;
- visible focus state.

Status:
- use semantic color;
- pair color with text/icon;
- never rely on color alone.

Loading:
- communicate the current workflow stage;
- avoid fake "AI thinking" animations.

Errors:
- explain what failed at a user-appropriate level;
- provide retry where applicable.

---

## 15. Accessibility

Minimum expectations:
- semantic HTML;
- keyboard navigability;
- visible focus;
- adequate contrast;
- meaningful button labels;
- alt text for meaningful imagery;
- no interaction dependent only on hover;
- reduced-motion support;
- responsive layouts.

The premium visual treatment must not reduce usability.
