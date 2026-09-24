# The Ordering Zone in the App

PakwanHus takes orders from one neighbourhood at a time — currently **Askari X,
Lahore**. What the zone is, how wide it is and why it exists are described in
the website's `feature-docs/` in the `meal-host-frontend` repo, and the rule
itself belongs to the backend (`meal-host`,
`feature-docs/13-service-area-and-ordering-zone.md`), which re-checks every
order regardless of what any app says. **What is different in the app** is
below.

Browsing is not affected anywhere. Anyone, in any city, can still open the app,
search kitchens and dishes, read reviews, fill a cart and post a food request.
The zone only matters at the moment an order is placed.

## The app does not interrupt checkout with a permission prompt

This is the main difference from the website, and it is deliberate. The website
asks the browser for a position the moment checkout opens. The app does not: a
system permission dialog appearing in the middle of paying for food is the kind
of interruption that loses an order, and this is the same rule the app already
follows everywhere else
(see [Location & Address Privacy](04-location-and-address-privacy.md)).

Instead, when checkout opens the app checks whether location permission has
**already** been granted:

- **Already granted** — the app reads the position quietly and checks it
  against the zone. A customer inside Askari X sees nothing at all and carries
  on as before.
- **Not granted** — no prompt appears. A **Confirm your location** card appears
  in the checkout form instead, and the system prompt is only raised if the
  customer taps its button. Nothing is asked that the customer did not ask for.

## Confirming a location

The card offers the same two routes the website's dialog does, and either is a
complete answer:

- **Share my location** — raises the permission prompt, or reads the position
  straight away if permission is already there.
- **Enter your address** — the same address field with live suggestions used at
  signup and in the profile. Picking a suggestion pins an exact spot, and that
  spot is checked the same way a device position is.

Only an address chosen from the suggestion list counts. Free-typed text that
was never matched to a real place cannot be checked against anything, so it is
not accepted.

Once a location is set it is remembered, so moving between the cart, checkout
and back does not ask again. It is kept until the app is reinstalled or the
customer sets a different one.

## When the phone will not say where it is

Phones refuse in more than one way, and the card says which one happened rather
than sending the customer to check a setting that was never the problem:

| What happened | What the card says |
| --- | --- |
| The customer declined the prompt | Offers to try again |
| Location was turned off for the app for good | Explains it, and offers a button that opens the phone's Settings directly |
| The position came back too vague to trust | Says it could only find them approximately, and asks for an address instead |
| Location services are off, or the fix timed out | Asks them to check their connection and try again |

The **open Settings** button is an app-only affordance — the website can only
describe where the browser's permission menu is and hope the customer finds it,
whereas the app can put them on the right screen. It only appears when a
setting is genuinely what is standing in the way.

A position that comes back wildly imprecise is treated as no position at all.
A fix good to within a kilometre or worse could place an Askari X resident in
another part of the city, and being wrongly told "we don't deliver to you" is
worse than being asked for an address.

## Where the customer finds out

- **In the cart** — if the app *already* knows the customer is outside the
  zone, a short note appears there, so the news does not arrive at the last
  step. The cart never asks for a location itself and never raises a prompt;
  it only reports what is already known.
- **At checkout** — the only place an order can actually be blocked, and where
  the confirm-location card and the out-of-area message appear. **Place Order**
  stays disabled while either is unresolved.

Nothing is shown on the home feed, on Find Chefs, or on dish and chef screens.

## The delivery address is checked too

For a delivery order there are two places involved: where the customer is
standing, and where the food is going. Both have to be in the zone. The
delivery address is pinned from the suggestion list, and if it falls outside
the zone the field says so directly, even when the customer themselves is
inside.

## What is sent with the order

The confirmed position travels with the order, so the server checks the same
place the app did rather than falling back to the address saved on the
profile. Accepting a chef's offer on a food request creates a real order too,
so it carries the position the same way.

If the app cannot load the zone at all — a flaky connection on startup — it
lets the customer through rather than blocking them. The server still enforces
the rule, and a failed config fetch is not a good reason to refuse an order.

## Related

- [Location & Address Privacy](04-location-and-address-privacy.md) — everywhere
  else the app uses your location, and how a chef's address is protected
- [Where the App Differs from the Website](05-parity-with-the-website.md)
- The server-side rule and the API that reports the zone are documented in the
  `meal-host` repo at `feature-docs/13-service-area-and-ordering-zone.md`.
