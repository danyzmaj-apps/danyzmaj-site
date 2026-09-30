# danyzmaj.com

Static site for https://www.danyzmaj.com/. See `AGENTS.md` for architecture and conventions.

## Screens canvas

`docs/screens.html` is a self-contained viewer of every page and its meaningful states
(homepage rampage frames, burned paper theme, projects gallery, each product page's
interactive states and preview-error fallbacks, privacy/terms pages, plus a 390×844 phone row).
Regenerate it with:

```sh
tool/capture_screens.sh                                   # everything
SCREENS_ONLY=home--landing--rest,vedro--product--default tool/capture_screens.sh
```

The script serves the repo on a local port and drives Chromium through Playwright fetched
with `npx` (nothing is added to the site). The clock, locale (`en-US`) and timezone
(`Europe/Zagreb`) are fixed, and any request to another origin, any 404, console error or
uncaught page error fails the run. The states are listed in `tool/screens/catalog.cjs`.
Output goes to `docs/screens/<id>.png` and `docs/screens.html`. Never edit
`docs/screens.template.html`.
