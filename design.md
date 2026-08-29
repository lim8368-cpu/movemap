# DAIL Design System

## Product character

DAIL is a calm, trustworthy discovery and operations platform for specialist exercise centers. The visual language should feel considered and human rather than clinical, futuristic, or decorative.

## Genre and composition

- Genre: modern minimal
- Public pages: editorial, asymmetric content composition with clear reading rhythm
- Product dashboards: compact workbench layout with information density driven by the task
- Navigation: a contained floating surface; primary links sit with the account actions instead of a centered three-zone template
- Cards: use a card only when it communicates one boundary. Do not nest a bordered card inside another bordered card.

## Color tokens

| Role | Token | Value |
| --- | --- | --- |
| Paper | `--dail-paper` | `#F3F6F5` |
| Paper raised | `--dail-paper-raised` | `#F8FAF9` |
| Surface | `--dail-surface` | `#FCFDFC` |
| Surface soft | `--dail-surface-soft` | `#EAF1EF` |
| Ink | `--dail-ink` | `#14222B` |
| Ink secondary | `--dail-ink-secondary` | `#42545B` |
| Ink muted | `--dail-ink-muted` | `#5B6A69` |
| Rule | `--dail-rule` | `#D9E3E0` |
| Navy | `--dail-navy` | `#0F1C2E` |
| Navy raised | `--dail-navy-raised` | `#182C3D` |
| Teal | `--dail-teal` | `#158187` |
| Teal strong | `--dail-teal-strong` | `#106165` |
| Teal soft | `--dail-teal-soft` | `#DCEBEA` |
| Success | `--dail-success` | `#4F8A68` |
| Warning | `--dail-warning` | `#B98539` |
| Error | `--dail-error` | `#B85F58` |

Pure black and pure white are not base colors. Social provider buttons may retain provider brand colors.
Text on navy uses the dedicated light-ink levels `--dail-on-dark` and `--dail-on-dark-muted`; light-page muted text is never reused on a dark surface.

## Type and numbers

- Pretendard Variable is the primary Korean UI typeface.
- Display headings are strong, upright, and concise. Italics are not used for headings.
- English eyebrow labels are reserved for a genuine top-level chapter marker, not repeated above every section.
- Metrics, dates, times, and tabular data use tabular numerals.

## Shape and depth

- Controls: 8–10px radius
- Content cards: 12–16px radius
- Dialogs: 16px radius
- Pills are reserved for statuses, tags, and compact filters.
- Shadows are restrained; use a visible border before adding elevation.
- Decorative floating orbs, gradients used as decoration, and simulated device chrome are not part of the system.

## Spacing

Use the named spacing scale `--dail-space-1` through `--dail-space-8`. Marketing sections alternate between compact, regular, and generous vertical rhythm rather than repeating one fixed section height.

## Layering

Use `--dail-z-sticky`, `--dail-z-nav`, `--dail-z-popover`, and `--dail-z-modal`. Arbitrary large z-index values are not allowed.

## Responsive contract

- Supported checks: 320, 375, 414, 768, 1024, and 1440px.
- No horizontal page overflow.
- The shared header becomes a contained mobile menu.
- Dashboard navigation collapses without hiding the current task context.
- Touch targets are at least 44px where space permits.

## Motion

Motion communicates state changes only. Respect `prefers-reduced-motion`, do not animate layout on initial render, and avoid ornamental looping movement.
