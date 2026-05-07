# Strategy Science 2026 · Boulder

The 9th annual Strategy Science Conference website. Hosted by the Leeds School of Business at the University of Colorado Boulder, May 28–30, 2026.

## Local preview

```
python3 -m http.server 8000
```

Then open http://localhost:8000/.

The pages use `fetch()` to load `data/program.json`, so they need to be served over HTTP — opening the HTML files directly via `file://` will not load the schedule matrix.

## Structure

- `index.html` — overview / homepage
- `program.html` — schedule matrix and filter / list view
- `sessions.html` — chronological session index
- `session.html` — per-session detail (parameterized via `?id=S01`…`S20`)
- `venue.html` — venue, travel, hotels, meals
- `about.html` — committees, past editions, contact
- `assets/` — shared CSS, JS, lockup images
- `data/program.json` — single source of truth for sessions, papers, authors, themes

Editing paper or session data in `data/program.json` updates every page automatically.
