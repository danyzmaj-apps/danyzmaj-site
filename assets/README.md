# Site branding assets

The root favicon artwork comes from the existing danyzmaj dragon monogram. PixelPup keeps its existing paw artwork. Neither icon is a new logo.

Root icon files are used by the homepage and Hold Up pages. The equivalent PixelPup files live in `pixelpup/assets/`.

- `favicon.svg`: square vector source.
- `favicon.ico`: 16, 32, and 48 pixel entries for browser compatibility and the default `/favicon.ico` request.
- `favicon-96x96.png`: crawlable square PNG for search results.
- `icon-192x192.png`: larger browser/bookmark icon.
- `apple-touch-icon.png`: opaque 180 pixel icon for Apple bookmarks and home-screen shortcuts.

PNG and ICO variants are rendered from the SVG source, not independently redrawn. Regenerate them together when the artwork changes. Keep the filenames stable for search crawlers.

`social-preview.png` is the 1200 × 630 homepage share image. The Hold Up share image at `holdup/assets/social-preview.png` uses the official Apple bezel documented in that folder. PixelPup's existing 1440 × 720 preview remains unchanged.

The pages use ordinary same-origin asset links. There are no image CDNs, tracking endpoints, or browser-storage requirements.
