# Violema SEO GAO Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Violema crawlable, citable, and topically focused for "AI agents for founders" across Google, Bing, and AI answer surfaces.

**Architecture:** Keep the React product app intact. Add static public SEO pages and machine-readable resource files under `frontend/public` so crawlers receive full HTML without waiting for client-side rendering. Add a small IndexNow submit script and a campaign operating doc so publishing and measurement can improve over time.

**Tech Stack:** Vite public assets, static HTML, shared CSS, JSON-LD, XML sitemap, robots.txt, llms.txt, Node 20 fetch for IndexNow.

---

## File Structure

- Create `frontend/public/robots.txt`: crawler permissions and sitemap discovery.
- Create `frontend/public/sitemap.xml`: canonical URL inventory for core public pages and SEO content.
- Create `frontend/public/llms.txt`: concise AI-readable product and source map for LLM crawlers that choose to use it.
- Create `frontend/public/33bbbde5b8700c2c95901a438260d51d.txt`: public IndexNow ownership key file.
- Create `frontend/public/seo/seo.css`: shared static-page styling.
- Create `frontend/public/ai-agents-for-founders/index.html`: primary ranking page.
- Create `frontend/public/blog/index.html`: static resource hub.
- Create `frontend/public/blog/what-should-founders-automate-first-with-ai-agents/index.html`: first educational post.
- Create `frontend/public/blog/ai-agent-vs-workflow-automation/index.html`: comparison post.
- Create `frontend/public/blog/weekly-founder-update-ai-agent/index.html`: use-case post.
- Create `frontend/public/blog/human-in-the-loop-ai-agents-for-founders/index.html`: trust and approval post.
- Create `docs/seo/violema-organic-ai-search-campaign.md`: ongoing campaign playbook for content, answer sites, measurement, and refresh loops.
- Create `scripts/seo/submit-indexnow.mjs`: post-deploy URL submission helper.
- Modify `package.json`: add a dry-run and live IndexNow script.
- Modify `frontend/src/content/homepage.ts`: point public Resources nav to the static blog hub.
- Modify `frontend/src/components/Navbar.tsx`: allow static SEO URLs to load as normal documents.
- Modify `frontend/src/components/Footer.tsx`: add static SEO resource links without React routing.

## Task 1: Technical Crawl Surface

**Files:**
- Create: `frontend/public/robots.txt`
- Create: `frontend/public/sitemap.xml`
- Create: `frontend/public/llms.txt`
- Create: `frontend/public/33bbbde5b8700c2c95901a438260d51d.txt`

- [ ] **Step 1: Add robots.txt**

Create:

```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /settings
Disallow: /settings/

Sitemap: https://violema.com/sitemap.xml
Host: https://violema.com
```

- [ ] **Step 2: Add sitemap.xml**

Create an XML sitemap with these canonical URLs and `lastmod` set to `2026-06-15`:

```txt
https://violema.com/
https://violema.com/ai-agents-for-founders/
https://violema.com/blog/
https://violema.com/blog/what-should-founders-automate-first-with-ai-agents/
https://violema.com/blog/ai-agent-vs-workflow-automation/
https://violema.com/blog/weekly-founder-update-ai-agent/
https://violema.com/blog/human-in-the-loop-ai-agents-for-founders/
https://violema.com/integrations
https://violema.com/faq
https://violema.com/plans
https://violema.com/privacy
https://violema.com/terms
```

- [ ] **Step 3: Add llms.txt**

Create a concise text file explaining Violema, the canonical positioning phrase "AI agents for founder work", the priority URLs, and the current freshness date. State that Google does not require `llms.txt`, but the file exists for agents and research systems that voluntarily read it.

- [ ] **Step 4: Add IndexNow key file**

Create `frontend/public/33bbbde5b8700c2c95901a438260d51d.txt` containing exactly:

```txt
33bbbde5b8700c2c95901a438260d51d
```

- [ ] **Step 5: Verify public files appear in build**

Run:

```bash
npm run build
test -f frontend/dist/robots.txt
test -f frontend/dist/sitemap.xml
test -f frontend/dist/llms.txt
test -f frontend/dist/33bbbde5b8700c2c95901a438260d51d.txt
```

Expected: build succeeds and every `test -f` exits with status 0.

## Task 2: Static SEO Page System

**Files:**
- Create: `frontend/public/seo/seo.css`
- Create: `frontend/public/ai-agents-for-founders/index.html`
- Create: `frontend/public/blog/index.html`

- [ ] **Step 1: Add shared SEO CSS**

Create a dark, readable, responsive stylesheet using existing Violema brand assets and stable layout primitives. Include accessible focus states, non-overlapping grids, readable line lengths, and print-friendly article content.

- [ ] **Step 2: Add primary ranking page**

Create `frontend/public/ai-agents-for-founders/index.html` with:

- `<title>AI Agents for Founders | Violema</title>`
- meta description focused on reviewable AI agents for recurring founder workflows
- canonical URL `https://violema.com/ai-agents-for-founders/`
- Open Graph and Twitter metadata
- visible H1 `AI agents for founders`
- direct answer section
- use-case section for founder update, revenue check, customer risk, market monitor, and follow-up queue
- comparison section for ChatGPT, workflow builders, and Violema
- selection framework for what founders should automate first
- internal links to all blog cluster pages
- JSON-LD `@graph` containing `Organization`, `SoftwareApplication`, `WebPage`, `BreadcrumbList`, and `ItemList`

- [ ] **Step 3: Add blog hub**

Create `frontend/public/blog/index.html` with:

- `<title>Founder AI Agent Guides | Violema</title>`
- canonical URL `https://violema.com/blog/`
- summary of the content cluster
- cards linking to the four posts
- JSON-LD `CollectionPage`, `ItemList`, and `BreadcrumbList`

- [ ] **Step 4: Verify static pages are crawlable**

Run:

```bash
npm run build
grep -R "AI agents for founders" frontend/dist/ai-agents-for-founders/index.html
grep -R "Founder AI Agent Guides" frontend/dist/blog/index.html
```

Expected: both `grep` commands find text in static HTML.

## Task 3: First Blog Cluster

**Files:**
- Create: `frontend/public/blog/what-should-founders-automate-first-with-ai-agents/index.html`
- Create: `frontend/public/blog/ai-agent-vs-workflow-automation/index.html`
- Create: `frontend/public/blog/weekly-founder-update-ai-agent/index.html`
- Create: `frontend/public/blog/human-in-the-loop-ai-agents-for-founders/index.html`

- [ ] **Step 1: Add automation-priority post**

Create a post that answers "What should founders automate first with AI agents?" with a direct answer, a five-part readiness test, examples, and internal links.

- [ ] **Step 2: Add agent-vs-workflow post**

Create a post that explains when a founder needs a workflow, when an agent is justified, and why Violema focuses on reviewable recurring work.

- [ ] **Step 3: Add weekly founder update post**

Create a post that describes an AI-agent weekly founder update workflow: inputs, steps, approvals, output, and what to measure.

- [ ] **Step 4: Add human-in-the-loop post**

Create a post about approvals, evidence, escalation, and audit trails for founder-led teams using AI agents.

- [ ] **Step 5: Verify all posts are static and internally linked**

Run:

```bash
npm run build
grep -R "canonical" frontend/dist/blog/*/index.html
grep -R "ai-agents-for-founders" frontend/dist/blog/*/index.html
```

Expected: every post has a canonical tag and a link back to the primary page.

## Task 4: Discovery Links In The App

**Files:**
- Modify: `frontend/src/content/homepage.ts`
- Modify: `frontend/src/components/Navbar.tsx`
- Modify: `frontend/src/components/Footer.tsx`

- [ ] **Step 1: Point Resources nav to the static blog hub**

Change the Resources nav item from `/faq` to `/blog/`.

- [ ] **Step 2: Allow static SEO URLs to bypass React navigation**

In `Navbar.tsx`, make `handleNavClick` return without `event.preventDefault()` for `/blog/` and `/ai-agents-for-founders/` URLs.

- [ ] **Step 3: Add footer resource links**

Add a Resources footer column with links to:

```txt
/ai-agents-for-founders/
/blog/
/blog/what-should-founders-automate-first-with-ai-agents/
/blog/ai-agent-vs-workflow-automation/
```

Treat those paths as normal anchors in `FooterLink`, not `react-router-dom` `Link`.

- [ ] **Step 4: Verify TypeScript build**

Run:

```bash
npm run build
```

Expected: backend and frontend build successfully.

## Task 5: Ongoing Campaign Operations

**Files:**
- Create: `docs/seo/violema-organic-ai-search-campaign.md`
- Create: `scripts/seo/submit-indexnow.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add campaign playbook**

Create a playbook with:

- current technical baseline
- target query map
- weekly publish and refresh cadence
- answer-site rules for Reddit, Indie Hackers, Hacker News, Quora-style Q&A, and founder communities
- measurement plan for Google Search Console, Bing Webmaster Tools AI Performance, sitemap coverage, and live AI citation checks
- a monthly self-improvement loop using cited pages, grounding queries, impressions, clicks, and answer-site engagement

- [ ] **Step 2: Add IndexNow submit helper**

Create a Node script that submits the sitemap URL list to `https://api.indexnow.org/IndexNow`, supports `--dry-run`, and prints the HTTP status plus response body.

- [ ] **Step 3: Add package scripts**

Add:

```json
"seo:indexnow:dry-run": "node scripts/seo/submit-indexnow.mjs --dry-run",
"seo:indexnow": "node scripts/seo/submit-indexnow.mjs"
```

- [ ] **Step 4: Verify IndexNow dry run**

Run:

```bash
npm run seo:indexnow:dry-run
```

Expected: script prints the JSON payload with host `violema.com`, key location `https://violema.com/33bbbde5b8700c2c95901a438260d51d.txt`, and the campaign URL list.

## Task 6: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: backend and frontend builds pass.

- [ ] **Step 2: Inspect static artifacts**

Run:

```bash
grep -R "<h1" frontend/dist/ai-agents-for-founders/index.html
grep -R "application/ld+json" frontend/dist/ai-agents-for-founders/index.html frontend/dist/blog/*/index.html
grep -R "Sitemap: https://violema.com/sitemap.xml" frontend/dist/robots.txt
```

Expected: all commands find the expected crawlable content.

- [ ] **Step 3: Preview smoke test**

Run:

```bash
cd frontend && npm run preview -- --host 127.0.0.1 --port 4173
```

Then check:

```bash
curl -I http://127.0.0.1:4173/robots.txt
curl -I http://127.0.0.1:4173/sitemap.xml
curl -I http://127.0.0.1:4173/ai-agents-for-founders/
curl -I http://127.0.0.1:4173/blog/
```

Expected: every URL returns HTTP 200.

## Self-Review

- Spec coverage: technical crawl files, primary ranking page, first content cluster, answer-site campaign, IndexNow readiness, and validation are covered.
- Placeholder scan: no TBD or TODO markers are intentionally left in the plan.
- Type consistency: static public paths are consistent across sitemap, links, `llms.txt`, and IndexNow payload.
