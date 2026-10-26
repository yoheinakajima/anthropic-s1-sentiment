# How X reacted to Anthropic's S-1

Static, filterable dashboard of X posts about Anthropic's IPO filing: sentiment, topics, and engagement. No build step. Plotly loads from a CDN.

```
index.html  app.js  style.css      the site
data/posts.json                    one record per post (url, handle, date, interactions, views, language, sentiment, topic, method hand|keyword, summary, hi = 100+ interactions)
data/meta.json                     last update time, counts, events, coverage and caveats
update/refresh.py                  merges new raw X search JSON, refreshes counts, scores new posts, rewrites data/*.json
update/fetch_x.py                  optional: pulls via the official X API (needs X_BEARER_TOKEN)
.github/workflows/refresh.yml      optional scheduled refresh (skips cleanly with no secret)
```

## Run locally
    python3 -m http.server 8000    # then open http://localhost:8000
(Opening index.html as a file won't work, because browsers block fetch() on file://.)

## Deploy
- **GitHub Pages:** push this folder as a repo, then Settings → Pages → Deploy from branch → `main` / root.
- **Netlify:** drag the folder onto app.netlify.com/drop, or connect the repo (build command empty, publish dir `.`).
- **Vercel:** `vercel` in this folder, or import the repo (framework "Other", no build).
Connecting the repo means every data commit redeploys automatically.

## Updating the data
**Path A (planned): scheduled Grok Bot run.** The X search tools used for the research exist only inside Grok Bot. A scheduled run searches X for new posts, saves the raw JSON responses to `update/raw/`, runs `python3 update/refresh.py update/raw/*.json`, and commits and pushes `data/`. The host redeploys.

**Path B (optional): GitHub Actions + X API.** Add the repo secret `X_BEARER_TOKEN` (an X API key with recent-search access, paid tier). The workflow runs every 6 hours: it fetches the last 7 days, merges, and commits. Without the secret it logs a message and does nothing.

`refresh.py` behavior: existing posts keep their scores and get their interaction and view counts refreshed (they never decrease). New posts must mention Anthropic plus an IPO/S-1 term, must not be spam or reposts, and are scored with the same keyword rules used in the research (method = `keyword`). Re-running on the same files is safe because posts are deduplicated by ID.
