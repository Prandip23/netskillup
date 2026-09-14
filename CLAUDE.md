# CLAUDE.md

Guidance for working in this repo. For file/folder structure and the
add-a-topic mechanics, see `README.md`; this file covers what README
doesn't: writing voice, component conventions, and content status.

## Writing voice

This is **education material**, not interview prep. Never frame anything as
an "interview tip," "interview hack," or "what they'll ask you." Callouts and
asides are plain tips for understanding/working with the tech day to day.

- **No em dashes. None, anywhere.** The single most obvious "written by AI"
  tell is stringing clauses together with "—" as a habitual joiner
  ("...unmanageable — so networking is broken into layers, where..."). Write
  with periods, commas, colons, parentheses, or "because/since/so/but"
  instead. There's always a plainer way to say it. This isn't limited to
  body paragraphs: it applies to `<title>` tags, `.topic-dek`, meta
  descriptions, headings, breadcrumbs, table cells, and inline SVG diagram
  text too. A "Heading — subtitle" pattern becomes "Heading: subtitle" or
  "Heading (subtitle)"; a `<title>Foo — netskillup</title>` becomes
  `<title>Foo · netskillup</title>` (the site already uses `·` as its
  breadcrumb separator, e.g. "Module 02 · Layer 2"). Catch every one and
  rewrite it before moving on. No exceptions, not even "just one aside."
- **One real analogy, mapped all the way through.** Don't gesture at an
  analogy once in the intro and then abandon it. Pick one concrete, fresh
  scenario per topic and map every sub-part of the concept back to it
  explicitly (see `topics/osi-vs-tcpip.html`'s food-delivery-app analogy,
  mapped to all 7 OSI layers). Avoid reusing the same analogy across
  multiple topics (mail/letters is retired site-wide, don't bring it back).
- **Name real protocols, fields, and hardware.** Every layer/mechanism
  section needs at least one concrete, correctly-placed example (a protocol
  name, header field, port number, timer value), not just an abstract
  description. If a layer/section has no named example, that's a gap, fix it.
- Contractions, short sentences, and a direct tone are fine and expected.
  Match the voice already in `topics/hubs-switches-routers.html` and
  `topics/duplex.html`, which read well.

## Topic-page component pattern

Copy `topics/broadcast-vs-collision-domain.html` as the starting template
(per README). Specifically:

- `.topic-header` has **no eyebrow/tag badge**. The breadcrumb link already
  spells out the module name ("← Module 0X · <Module Name>"). A separate
  "FUND"/"L2"/"L3" pill next to it is redundant and was removed everywhere.
  Module color identity now comes only from the `--module-color` custom
  property set inline (`style="--module-color: var(--l2);"`), which feeds a
  slim top border on `.topic-header` (`css/style.css`). Set it to the right
  module variable (`--fund`, `--l2`, `--l3`, `--l4`, `--app`, `--sec`; see
  `css/style.css:15-20`) for whichever module the topic belongs to.
- Standard structure: `site-header` → `topic-header` (breadcrumb, `h1`,
  `.topic-dek`) → `article.topic-body` (prose, `figure.diagram-block` for
  diagrams, `table.compare-table` for side-by-sides, `div.callout` for a
  closing tip) → `nav.topic-nav` (prev/next) → `site-footer`.
- Callout labels (`span.callout-label`) should be short, specific, and
  descriptive of the actual point being made (e.g. "WHY THIS RARELY COMES UP
  ANYMORE", "CONNECTING THE DOTS"), not a generic "TIP" and never framed
  around interviews.

## Diagram convention: animated inline SVG, not raster GIFs

There is no image/asset pipeline in this repo (no `img/`, no `.gif`/`.png`
anywhere). Every diagram is hand-authored inline `<svg>`, and that's
intentional: it's lightweight, themeable with the site's existing hex
palette, and needs no build step. Keep it that way; don't introduce raster
images or an asset folder for diagrams.

Two animation patterns are in use, matching the two different jobs motion
does on this site:

1. **Ambient/decorative motion** (continuous loop): for a real, ongoing
   mechanism: packets flowing along a path, a hub flooding every port, a
   broadcast staying inside its domain. Use `<animateMotion>`/`<mpath>` or a
   looping `<animate>` on `opacity`/`stroke-dashoffset`, `repeatCount="indefinite"`.
   Pattern reference: `index.html`'s hero SVG, and the flood/forwarding
   animations in `topics/broadcast-vs-collision-domain.html` and
   `topics/hubs-switches-routers.html`.
2. **Draw-in once** (plays on load, then rests): for a static
   relationship/mapping diagram (boxes and connectors) where you just want
   the eye guided through it once, not looping forever while someone reads.
   Animate `stroke-dashoffset` from the line's length to `0`, `fill="freeze"`,
   staggered `begin` times. Pattern reference: the OSI↔TCP/IP mapping diagram
   in `topics/osi-vs-tcpip.html`.

Both patterns need a `prefers-reduced-motion` guard. Copy the inline
`<script type="text/javascript"><![CDATA[ ... ]]></script>` block from one
of the examples above into any new animated `<svg>` (for looping animations,
set `dur` to a huge number so they park in place; for draw-in-once
animations, set `dur` to `0.01s` and `begin` to `0s` so they render the final
state instantly).

**Rule of thumb: only animate when there's a real sequence or timing to
show** (a request/reply exchange, something flooding vs. not, a state
changing over time). A diagram that's just a static layout (e.g. the four
topology shapes in `topics/network-topologies.html`) doesn't need motion.
Don't animate for its own sake.

VS Code's HTML/JS language service will flag the `<![CDATA[ ... ]]>` inside
these inline SVG `<script>` blocks as a syntax error ("Expression expected").
That's a false positive: it doesn't understand SVG foreign-content CDATA
handling in the HTML parser. The pattern is valid and already shipping in
`index.html`; ignore that diagnostic on these blocks.

## Content status

- **Module 01: Fundamentals** (5/5 topics): published and upgraded to the
  current voice/component/diagram standard above.
- **Module 02: Layer 2 (Data Link)**, **Module 03: Layer 3 (Network)**, and
  **Module 04: Layer 4 (Transport)**: written to the same standard (see
  `js/site-data.js` for the current per-topic `status`).
- **Module 05 (App/Naming), 06 (Security)**: still `"planned"`, not started.
  When picking these up, follow this same guide.
