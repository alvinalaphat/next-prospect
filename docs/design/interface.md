# Interface design standard

Read this document before creating or materially changing a page, component,
interaction, or visual style. It adapts the
[v0 Best Practices Guide](https://v0-best-practice-guide.vercel.app/) to
NextProspect so future interface work stays consistent with Vercel's Geist
design language. The external guide was reviewed on 2026-11-03; this file is
the repository-owned requirement when the source and the current app differ.

## Design intent

The interface should feel quiet, precise, and fast. Optimize for a sales rep
scanning evidence and making a decision, not for decorative novelty. Use clear
hierarchy, strong information grouping, generous whitespace, and concise copy.
Show detail progressively so the primary decision remains obvious.

## Required foundation

- Use Geist Sans for interface text and Geist Mono only for values that benefit
  from fixed-width alignment, such as scores and technical identifiers.
- Use the semantic tokens defined in `app/globals.css`. Components must not add
  raw hex colors or create local light/dark color pairs.
- Support light and dark themes with equivalent hierarchy, legibility, status
  meaning, and interaction affordances.
- Preserve the guide's core palette roles: background, foreground, muted,
  border, success, and cyan. Use the repo's accessible positive, warning, error,
  focus, hover, overlay, and shadow tokens for their named purposes.
- Keep body copy near a 1.5 line height and headings near 1.2. Favor readable
  measure and hierarchy over squeezing more content into a row.
- Use the established 8px corner radius and subtle `--geist-shadow`. Borders,
  spacing, and background contrast should carry most of the visual structure;
  shadows are secondary.

## Layout and spacing

- Build spacing from the guide's 16px, 24px, and 32px rhythm. Smaller 4px and
  8px increments are acceptable inside compact controls and related groups.
- Default reading, form, and explanation surfaces to a centered `max-w-4xl`
  measure. Data-heavy dashboard and table surfaces may use the app's existing
  `max-w-7xl` shell when the extra width materially improves scanning.
- Keep related labels, values, evidence, and actions together. Do not move
  supporting context to a distant appendix when it can sit beside the decision
  it explains.
- Avoid layout shifts during interaction. Floating or overlay controls should
  not push primary content, and loading or secret-dependent UI should reserve
  or suppress space deliberately.
- Design mobile and desktop together. Dense rows must reflow, scroll, or reduce
  secondary detail without hiding the primary action or meaning.

## Components and interaction

- Reuse existing components and patterns before introducing a variant. Shared
  behavior such as buttons, disclosures, badges, selection, and feedback should
  not be restyled independently on each page.
- Every interactive control needs a clear default, hover, active, focus-visible,
  disabled, and loading state when applicable. Use semantic tokens for these
  states and retain visible keyboard focus.
- Prefer native elements and semantics: buttons for actions, links for
  navigation, `details`/`summary` for simple disclosure, labels for form fields,
  and real table structure for tabular data.
- Keep target sizes comfortable and avoid icon-only controls unless the icon is
  conventional and has an accessible name. Destructive actions must be visually
  distinct and require appropriate confirmation.
- Motion should clarify state changes, remain brief and subtle, and honor
  `prefers-reduced-motion`. Do not animate merely to make a static surface feel
  busier.
- Use progressive disclosure for secondary detail, but keep the summary useful:
  a collapsed row should still identify what is inside and why it matters.

## Content and accessibility

- Write for sales users first. Translate implementation terminology into plain
  language without increasing the certainty of the underlying evidence.
- Never rely on color alone for status or selection. Pair it with text, shape,
  position, or an icon.
- Maintain WCAG AA contrast for text and essential controls. Check both themes,
  browser zoom, long content, empty states, errors, and keyboard-only use.
- Preserve logical heading order, landmarks, accessible names, form labels, and
  screen-reader state such as `aria-expanded`, `aria-selected`, or live feedback
  where native semantics do not supply it.

## Required workflow for interface changes

1. Read this document and inspect the nearest existing components and tokens.
2. State the primary user task and information hierarchy before styling.
3. Reuse semantic tokens and shared primitives; add a global token or component
   only when the pattern is genuinely reusable.
4. Verify the affected flow in Chrome at desktop and mobile widths, in light and
   dark themes. Use keyboard navigation, exercise the interaction states, and
   check the console for errors.
5. Run the code checks required by `docs/testing/verification.md`. Record any
   browser-QA limitation explicitly in the pull request rather than claiming
   coverage that did not occur.

When a product requirement conflicts with an example in the external guide,
preserve the product requirement and apply the Geist principles to the resulting
interaction. Document a deliberate exception here if it is likely to recur.
