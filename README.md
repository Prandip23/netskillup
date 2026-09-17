# netskillup: on-prem networking reference

A static, GitHub Pages–ready learning site covering on-prem networking:
Layer 2 switching, Layer 3 routing, TCP/UDP, DNS, and security fundamentals.
Cloud networking is intentionally out of scope for this segment.

## Structure

```
index.html              → homepage / master topic index (data-driven)
css/style.css           → single stylesheet for the whole site
js/site-data.js         → the list of modules + topics + publish status
js/main.js              → renders the index from site-data.js, handles search
js/topic-page.js        → adds section links, contents navigation, reading progress, and table scrolling
topics/*.html           → one file per published topic, enhanced by topic-page.js
```

## Local preview

Run the following from the repository root, then open `http://localhost:4173`.

```powershell
py -3 -m http.server 4173
```

## Adding a new topic

1. Open `js/site-data.js` and find the topic's entry (most are already listed
   with `status: "planned"`).
2. Create `topics/<slug>.html` — copy `topics/broadcast-vs-collision-domain.html`
   as the starting template. It already has the header, breadcrumb, prose
   styles, diagram block, comparison table, and next/prev nav wired up.
3. Flip that topic's `status` to `"published"` in `site-data.js`.
4. Commit + push. The homepage progress bar and topic list update automatically. No other file needs to change.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → Deploy from branch → select `main` (or your
   default branch) and `/ (root)`.
3. Site will be live at `https://<username>.github.io/<repo>/`.

No build step or dependencies. Plain HTML, CSS, and JavaScript.
