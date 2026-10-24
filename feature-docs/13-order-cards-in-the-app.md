# Order Cards in the App

## What this feature is

The order lists on both sides of the app — **My Orders** for customers and
**Orders** for chefs — use the same card design as the website since October
2026: the important things are visible without opening the card, and Pal the
mascot shows at a glance where each order stands. What each status means is
described in `meal-host-frontend/feature-docs/04-customer-orders.md` and
`06-chef-dashboard.md`; this page notes how the app presents it.

## Customer cards

- **Top:** dish photo, dish name (or "Karahi +2 more"), kitchen · order # ·
  when placed, and on the right the total and item count.
- **Status strip:** a tinted band in plain words — "Waiting for Ali's Kitchen
  to confirm", "Ali's Kitchen is cooking your order", "On its way to you" — with
  Pal in a matching pose and, while the order is active, a four-step progress
  bar (Placed → Preparing → Ready / Out for delivery → Received).
- **Rating on the card:** once you have received an order, five stars sit on
  the strip. Tapping one opens a comment box and Submit.
- **Bottom row:** Pickup / Delivery and Cash / Card tags, then Chat (with an
  unread count), **I received my order**, **Order again** (opens the dish), and
  Details.
- **Details** shows where to pick up or deliver, with **Directions** (opens
  Maps) and **Call** buttons, and the full line-by-line order with notes.
- Cancelled orders show the reason on the strip and the price struck through.
- Four tabs — **Upcoming, In transit, Completed, Cancelled** — and a search box
  over order numbers and dish names that searches all tabs at once. The count
  on each tab shows how many of its orders match.

## Chef cards

- Three queues — **Needs action** (oldest first), **Waiting** and **History**
  — with counts, and a search box over order number, dish, customer phone and
  the custom request's title or brief.
- **Top:** dish photo, order # and Pickup / Delivery tag, and the cooking list
  ("2 × Chicken Karahi · 4 × Naan"); on the right the total and Cash / Card.
- **Status strip** with Pal: "New order — placed 20 min ago", "Cooking — due by
  8:10 PM · in 35 min" (or "20 min overdue"), "Ready — waiting for the customer
  to collect", and so on.
- **Action row** on the closed card: the next step, Reject or Cancel, Chat, and
  Details.
- **Details:** special instructions highlighted first, then where the order is
  handed over and a slim progress bar.
- The **customer's phone number is no longer shown** on the card, matching the
  website — chat is the way to reach a customer.
- **Confirm order** now pre-fills "Ready in" with the chef's usual prep time.

## Small differences from the website

These are on purpose, or follow from how the app loads orders:

- **Search covers the orders already loaded.** The app loads orders 20 at a
  time with a **Load More** button at the bottom; the website loads up to 100
  at once. An older order appears in search once its page has been loaded.
- **Directions** opens Apple Maps on an iPhone and Google Maps on Android.
  As on the website, it is offered for pickup orders only — for a delivery the
  address is your own.
- **Rating** happens on the card itself. The pop-up review window the app used
  to show has gone.
- **"Chat opens once the chef confirms"** shows on every phone. The website
  hides that line on narrow screens.
- **Needs action order.** The chef's queue leads with new orders, then
  cooking, ready, and received ones, and within each the order that has waited
  longest comes first — as the website's chef dashboard document describes.
  (The website's code currently lists that queue newest first.)
- **"Ready in"** is pre-filled from the chef's usual prep time as saved on
  their profile. A chef who has never set one sees the box empty, and leaving
  it empty keeps the estimate the customer was shown.
- A customer's phone number can still be **searched** on the chef side, but
  it is never shown on the card.
