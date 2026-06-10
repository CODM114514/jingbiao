# Public Asset Auction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small invite-only public ascending bidding website for renting one idle asset.

**Architecture:** A dependency-light Node.js HTTP server serves static participant and admin pages, exposes JSON APIs, and persists data to `data/auction.json`. Pure auction rules live in `src/auctionCore.mjs` and are tested independently before the server and UI are wired in.

**Tech Stack:** Node.js built-in `http`, `fs`, `node:test`, HTML, CSS, browser JavaScript.

---

### File Structure

- Create: `package.json` for scripts.
- Create: `src/auctionCore.mjs` for pure validation, masking, bidding, and winner rules.
- Create: `src/store.mjs` for JSON persistence.
- Create: `server.mjs` for HTTP routes and static serving.
- Create: `public/index.html`, `public/admin.html`, `public/styles.css`, `public/app.js`, `public/admin.js` for UI.
- Create: `test/auctionCore.test.mjs` and `test/server.test.mjs` for automated checks.
- Create: `data/.gitkeep` so the data folder exists while runtime JSON stays local.

### Task 1: Core Auction Rules

- [ ] Write failing tests in `test/auctionCore.test.mjs` for phone masking, minimum bid checks, repeated bidding, deadline rejection, and winner tie-breaking.
- [ ] Run `node --test test/auctionCore.test.mjs` and confirm failure because `src/auctionCore.mjs` does not exist.
- [ ] Implement `src/auctionCore.mjs` with exported pure functions.
- [ ] Run `node --test test/auctionCore.test.mjs` and confirm passing output.

### Task 2: HTTP API and Persistence

- [ ] Write failing tests in `test/server.test.mjs` for public state masking, participant registration, bidding, admin state, and closed auctions.
- [ ] Run `node --test test/server.test.mjs` and confirm failure because `server.mjs` does not exist.
- [ ] Implement `src/store.mjs` and `server.mjs`.
- [ ] Run `node --test test/server.test.mjs` and confirm passing output.

### Task 3: Participant and Admin UI

- [ ] Create static HTML, CSS, and browser JavaScript for participant and admin pages.
- [ ] Verify `node --test` still passes.
- [ ] Start the local server and inspect the participant page in the browser.
- [ ] Inspect the admin page in the browser and confirm admin controls render.

### Task 4: Final Verification

- [ ] Run `node --test`.
- [ ] Run a local server smoke check with HTTP requests.
- [ ] Provide the local URL and admin password.
