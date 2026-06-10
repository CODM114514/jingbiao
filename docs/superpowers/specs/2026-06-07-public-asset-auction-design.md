# Public Asset Auction Design

## Goal

Build a small invite-only web site for renting one idle asset through public ascending bidding among familiar participants.

## First Version Scope

- Internal use through a shared invite link.
- Participants register with name and phone number before bidding.
- No SMS verification in the first version.
- Public page shows current highest bid and bid history.
- Public bid history shows phone last four digits, amount, and time.
- Admin page shows full name, full phone number, all bids, and the winner.
- Bids are locked after the deadline.
- Highest price wins; if two bids have the same amount, the earlier bid wins.

## Rules

- Each bid must be at least the current highest bid plus the configured minimum increment.
- The first bid must be at least the starting price.
- Phone numbers must be 11 digits.
- A participant may bid many times before the deadline.
- The public page never exposes full phone numbers.
- The admin page is protected by a simple password.

## Architecture

Use a dependency-light Node.js app so the site can run locally or on a small server without a heavy framework. Core auction rules live in a pure module with automated tests. The HTTP server stores data in a JSON file and serves two static pages: participant auction page and admin page.

## Pages

- `public/index.html`: participant auction page.
- `public/admin.html`: admin dashboard.

## Data

The JSON store contains one auction, participants keyed by phone number, and a chronological bid list.

## Verification

- Node unit tests cover auction rules.
- API tests cover registration, bidding, deadline rejection, public masking, and admin visibility.
- Browser verification confirms the local UI loads and renders visible auction controls.
