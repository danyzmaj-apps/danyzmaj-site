# Repository Guidelines

## Project Overview
Personal brand landing page for **danyzmaj** (deployed at `https://www.danyzmaj.com/`). A single self-contained HTML file renders an animated SVG logomark on a dark "letterpress" background. No application logic, no backend.

## Architecture & Data Flow
- Zero-dependency static site: one HTML document with inline `<style>`, inline SVG, and one tiny inline `<script>` (a single click listener). No external requests (favicon is an inline `data:image/svg+xml` URI).
- **Tap-morph architecture** (branch `feat/dragon-scroll-logo`): tapping/clicking the mark toggles it between the Z monogram and a top-down dragon. The whole page is a `<button class="trigger">` wrapping the SVG; JS only toggles `.awake` on `<html>` and mirrors it to `aria-pressed` — no per-frame JS.
- The choreography itself is pure CSS: `--p` is a registered custom property (`@property --p{syntax:'<number>'}`) that CSS-transitions 0→1 (`.awake`) or 1→0 on the toggle. Sub-timeline ramps (`--p1` straighten, `--ph` head flip, `--p2` wings, `--p3` fire) are `clamp(0,calc(…),1)` windows of `--p`, defined on the `svg` and recomputed live every animation frame as `--p` interpolates — this reactive recompute is what makes a single transitioned number drive a multi-beat sequence.
- Forward and reverse use different tokens: `html{transition:--p 1400ms var(--reveal)}` for the awakening (evenly-paced `cubic-bezier(0.4,0,0.2,1)` so all four beats stay legible — do NOT reuse the punchy `--ease` token here, it front-loads the whole show into the first 300ms), `html:not(.awake){…var(--recoil)}` for a quicker back-loaded snap home. Re-verify pacing by sampling `getComputedStyle(document.documentElement).getPropertyValue('--p')` at several `setTimeout` points after a click if you touch these curves — don't judge by end-state screenshots alone.
- SVG is split into anatomical groups — `#spine`, `#head` (`.side` profile / `.crown` top-down layers), `#tail`, `#wings` (`.fold`), `#spark`/`#fire` — each animated with `calc()`-interpolated CSS transforms (`transform-box:view-box`, absolute `px` origins). Transforms + opacity only; the world is ink/bone die-cut, so NEVER cross-fade with alpha — reveals use scale collapse/expand (e.g. the head's profile→bird's-eye card-flip).
- At `--p:0` the mark must render pixel-identical to the original monogram; path data is duplicated in the favicon data URI and must stay in sync with the `.side`/skeleton paths.
- Layout: unchanged from the original single static viewport (`body` grid, `overflow:hidden`, no scroll container) — the interaction lives entirely in the button/CSS, not in page height.
- SVG layering (paint order): wings → tail → spine → head → spark; `.body` (bone) with `.hole` (ink cutouts), `.acc` (ember accent).

## Key Directories
- `index.html` — the landing page (the animated logomark; everything below describes it).
- `<project>/` — per-app static pages for App Store listings, following the pattern
  `/<project>/` (support page, contact email) and `/<project>/privacy/` (privacy policy).
  Currently: `holdup/`. Each page is a self-contained HTML file reusing the brand tokens
  (`--ink`/`--bone`/`--ember`), the mono plate type, and the inline SVG favicon — copy an
  existing project's pair when adding a new app.
- `.gitignore` — ignores Python bytecode, `.DS_Store`, `.worktrees/`.

## Development Commands
No build, lint, or test tooling. Preview locally:
```sh
open index.html                 # macOS, file:// is sufficient
python3 -m http.server 8000     # or serve over HTTP
```

## Code Conventions & Common Patterns
- **Everything inline**: keep CSS in the `<head>` `<style>` block and SVG inline; do not split into separate files or add dependencies.
- **Design tokens** live as CSS custom properties on `:root` with poetic comments:
  `--ink:#171210` (background), `--bone:#F2EDE4` (mark), `--ember:#FF6A1F` (accent), `--ease` (620ms entrance flourish), `--reveal`/`--recoil` (tap-morph in/out curves). Reference tokens via `var(--…)`; never hardcode these colors elsewhere. `theme-color` meta mirrors `--ink`.
- **Compact CSS style**: no spaces after `:` or around `{}`, one rule per line where short.
- **Accessibility is deliberate**: the `<h1>` lives in `#plate`, permanently visible on BOTH pages (ink and paper) — the two themes must stay element-for-element identical, differing only in the swapped `--ink`/`--bone` values; the `svg` is `aria-hidden`, `#fx`/`#lure` are `aria-hidden`, and `prefers-reduced-motion` freezes the page entirely: the CSS query collapses all animations to 1ms (no idle blink/lure) and `push()` bails before doing anything, so scroll/keys never trigger the rampage or the theme flip — the mark just stands still. Preserve all of these when editing.
- **Flat means flat — no filters, ever**: the mark carries no drop-shadow in either theme (a shadow darkens the page around the mark and makes the painted `.hole` overlays visibly mismatch the background). Holes are painted `var(--ink)` and must be indistinguishable from the page bed in both themes.
- **Animation**: the rampage is a `wake` keyframe on `html.rampage` scrubbed by JS (`currentTime` driven from scroll); idle life runs on its own clock — `pulse` (`.acc`), `blink` (`.eye`), `lure` (`#lure`). **Any animation that must not be scrubbed by the rampage timeline MUST be added to the exclusion regex in the script** (`/^(pulse|blink|lure)$/`), or the scroll will hijack its clock. Idle motion must be discrete and legible (a blink, a falling ember) — NEVER slow sub-pixel scaling of the hard-edged mark, which reads as pixel shimmer, not life.
- **The eye winding trap**: the side-head eye is drawn ONLY by the `.hole.eye` overlay path — it is deliberately NOT wound into the `.body` path (unlike the mouth line, which is both) so the `blink` scale-collapse reveals bone, not a wound hole. Don't "re-sync" the eye subpath back into the body path.
- Viewport sizing uses `min-height:100svh` with `100vh` fallback and `min(58vmin,620px)` for the mark — keep the fluid-with-cap pattern.

## Important Files
- `index.html` — entry point, styles, markup, favicon: the whole project.

## Runtime/Tooling Preferences
- No runtime, package manager, or framework — and none should be introduced. Changes must keep the page a single dependency-free HTML file.
- `.gitignore`'s Python entries only anticipate ad-hoc local scripts (e.g., `http.server`); there is no Python code in the repo.

## Testing & QA
- No test framework. QA is visual: open the page, verify the mark at rest matches the original monogram exactly and sits rock-still (idle life is only the eye blink every ~6.4s, the ember lure drifting at the bottom, the `danyzmaj` wordmark beneath), scroll and watch the full rampage (Z reassembles into the dragon → liftoff → charge → the page burns to paper), then scroll again to burn back. After each settle, diff the two pages mentally: same elements, same positions, only the ink/bone colors swapped — and the eye/mouth holes must blend seamlessly into the background in both.
- Also verify: keyboard (ArrowDown/PageDown drive the timeline, ArrowUp/PageUp retreat), stopping mid-scroll (the untended fire dies back down and disarms cleanly), no-JS (static Z), reduced-motion (scroll and keys do nothing — the page stays the static ink monogram, name legible), and mobile/desktop centering.
- When touching SVG paths, update both the inline `<svg>` and the favicon data URI.

## Projects Gallery & Product Pages
- The homepage's `Projects / 02` link opens `#projects`, a CSS `:target` screen sliding over the dragon. Its two project links work without JS; hash changes stop any active rampage, manage focus, and update `aria-expanded`. Escape closes the gallery. The gallery scrolls internally on small screens; the homepage remains a fixed stage.
- `push()` ignores input while the gallery is open. Rampage scrubbing selects `CSSAnimation` objects only, so gallery transitions keep their own clock. Reduced motion opens the gallery instantly.
- Project previews are self-contained: the PixelPup dog is an embedded copy of `pixelpup/assets/dog_labrador.png`; its landscape and the Hold Up sign are CSS. Preview product colors stay fixed across the parent ink/paper themes.
- `holdup/index.html` is a product landing page with support at `#support` and the existing privacy link. Its small sign demo fits editable text into a fixed sign and offers three preview backgrounds; this is a browser preview, not the full app. Keep the static sign and product copy usable without JS.
- `pixelpup/index.html` contains the existing product playground. Its beta status and release links are maintained there.
