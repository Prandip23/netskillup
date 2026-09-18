# netskillup: on-prem networking reference

A static, GitHub Pages-ready learning site covering on-prem networking:
Layer 2 switching, Layer 3 routing, TCP/UDP, DNS, and security fundamentals.
The current catalog has 45 published topics across six modules. Cloud
networking is intentionally out of scope for this segment.

The browser needs only HTML, CSS, and JavaScript. There is no application
server or deployment build. Node.js tools are used locally to synchronize
checked-in navigation and metadata, and to validate changes before publishing.

## Structure

```text
index.html                  static networking catalog, enhanced with search
css/style.css               shared layout, reading, responsive, and print styles
js/site-data.js             curriculum order, status, and search metadata
js/main.js                  catalog search, difficulty filter, and URL state
js/topic-page.js            contents, reading progress, tables, and diagram viewer
topics/*.html               hand-authored articles and inline SVG diagrams
scripts/site-lib.mjs        catalog adapter and HTML source helpers
scripts/sync-site.mjs       owned-region synchronization and discovery files
scripts/validate-site.mjs   read-only catalog, ID, and local-link checks
tests/                     unit and browser tests
sitemap.xml, robots.txt     generated search-engine discovery files
.github/workflows/          validation only, no deployment or auto-commit
```

The static catalog, prose, and adjacent-topic links work without JavaScript.
Search matches terms across titles, modules, summaries, and aliases; query and
level state are retained in the URL. It does not search article bodies.

## Local preview

Open [index.html](index.html) directly in a browser, or serve the repository
root with Python 3 to preview HTTP navigation:

```powershell
py -3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173. If the port is occupied, choose another port.
On macOS/Linux, use `python3` instead of `py -3`. Stop the server with Ctrl+C.

## Authoring and checks

Install Node.js 24 or later, then run from the repository root:

```powershell
npm ci
npm run sync
npm run check
```

- `npm run sync` writes the static homepage catalog/module links, topic
  breadcrumbs and adjacent navigation, missing heading IDs, article search
  forms, canonical/social metadata, sitemap, and robots file.
- `npm run check` runs unit tests, validates catalog references and local
  file/fragment targets, and checks generated output for drift. It is
  read-only. Fix source errors, run sync, and rerun the check when it fails.
- `npm test` runs just the unit tests.

For browser checks, install Chromium once (and again after a Playwright update):

```powershell
npx playwright install chromium
npm run test:browser
```

The browser suite starts and stops its own localhost server. It tests search,
URL state, no-JavaScript navigation, responsive layouts, selected axe checks,
keyboard interactions, reduced-motion mode, and print styles. Screenshots and
a sample PDF go to the ignored `test-results/` directory. Linux CI uses
`npx playwright install --with-deps chromium`.

Automation does not verify every technical claim or replace visual review.
Before publishing, inspect changed pages at mobile and desktop widths, 200%
browser zoom, keyboard-only navigation, and with a screen reader such as NVDA.
Check diagram labels and print output, not just page-level overflow.

## Adding a new topic

1. Add an entry in the intended module in [js/site-data.js](js/site-data.js).
   Use a stable slug, title, concise summary, `level` (`beginner` or
   `intermediate`), and `status: "planned"` until the article is ready.
   Add useful `aliases`, `prerequisites`, and `related` references where
   relevant. Reference identities use `track:slug`, for example `networking:arp`.
2. Create the article using
   [topics/broadcast-vs-collision-domain.html](topics/broadcast-vs-collision-domain.html)
   as the layout template. Follow [CLAUDE.md](CLAUDE.md) for writing voice,
   module colors, components, and inline SVG conventions.
3. Give readers a short answer, useful prerequisite links, a worked example,
   and symptom/check/interpretation guidance where it fits the subject. Use
   primary sources and distinguish standards from OS/vendor defaults.
   Label synthetic command output as illustrative. Add a verification date
   only after an actual content review; never bulk-refresh dates during sync.
4. Set `status: "published"` once the page is complete, then run sync and
   both check suites. Review the generated changes alongside the article.
   Neighboring navigation, the catalog, and discovery files can change too.

Keep module IDs and existing article URLs stable. Module objects own `track`,
`path`, and the CSS `color` token. Previous/next navigation stays within a track.
Planned topics are excluded from the public catalog and sitemap.

Edit catalog text in the catalog source, not its generated HTML. Sync owns
the marked metadata blocks and navigation regions. It preserves existing
heading IDs and does not reserialize article bodies or SVG. Preserve existing
IDs when changing heading wording so old deep links keep working.

The richer reference pattern is piloted on subnetting, ARP, DNS resolution,
TCP flow/congestion control, and TLS. Wireless, enterprise, and operations
articles are the next content batch. A separate AI reference is planned later;
neither expansion is published yet.

## Publishing on GitHub Pages

Publishing is a manual decision. The validation workflow never deploys or
commits generated changes. For this existing site, keep the configured Pages
source and custom domain unless you deliberately intend to change them.

1. Run `npm run check` and `npm run test:browser`, then review `git status`
   and `git diff`. Stage only the intended files in VS Code Source Control.
2. Inspect the staged changes and make the commit yourself:

   ```powershell
   git diff --cached
   git commit -m "Improve networking reference website"
   ```

3. Confirm the destination before pushing:

   ```powershell
   git remote -v
   git branch --show-current
   ```

4. When the remote and current branch are correct, push yourself:

   ```powershell
   git push -u origin HEAD
   ```

5. Check GitHub Actions validation and the configured Pages deployment. A push
   publishes only when it reaches the branch/workflow selected in repository
   Settings > Pages. A feature branch may need a pull request first.

[CNAME](CNAME) currently specifies `netskillup.com`; sync uses it for canonical
URLs and the sitemap. Local navigation uses relative links and is browser-tested
under a project subpath. Changing the deployment domain requires regenerating
metadata and reviewing DNS/Pages settings separately.
