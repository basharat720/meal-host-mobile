# Delivery & Pickup in the App

PakwanHus runs its own delivery riders in one neighbourhood at a time —
currently **Askari X, Lahore**. Delivery is offered only when both the customer
and the kitchen sit inside that zone; in every other case the order is
**pickup-only**. What the zone is, how wide it is and why it exists are
described in the website's `feature-docs/` in the `meal-host-frontend` repo, and
the rule itself belongs to the backend (`meal-host`,
`feature-docs/13-service-area-and-ordering-zone.md`), which re-checks every
delivery order regardless of what any app says. **What is different in the app**
is below.

> **What changed.** Ordering used to be blocked outright for anyone outside the
> zone: **Place Order** was disabled and the order was refused. That is gone.
> Location now decides *how* an order is fulfilled, never *whether* it can be
> placed. Pickup is available to everyone, everywhere, and a customer who never
> shares their location can still order.

Browsing is not affected anywhere. Anyone, in any city, can open the app, search
kitchens and dishes, read reviews, fill a cart, post a food request — and place
a pickup order.

## The app does not interrupt checkout with a permission prompt

This is the main difference from the website, and it is deliberate. The website
asks the browser for a position the moment checkout opens. The app does not: a
system permission dialog appearing in the middle of paying for food is the kind
of interruption that loses an order, and this is the same rule the app already
follows everywhere else
(see [Location & Address Privacy](04-location-and-address-privacy.md)).

Instead, when checkout opens the app checks whether location permission has
**already** been granted:

- **Already granted** — the app reads the position quietly and asks the server
  whether delivery can be offered. A customer inside Askari X ordering from a
  kitchen inside Askari X sees both options and carries on as before.
- **Not granted** — no prompt appears. Checkout simply opens as a pickup order,
  with the Delivery option dimmed and a **Share my location** button beside it.
  The system prompt is raised only if the customer taps that button. Nothing is
  asked that the customer did not ask for, and nothing is lost by ignoring it.

## What the customer sees at checkout

The Pickup / Delivery pair is unchanged in layout. Pickup is selected by
default and is always tappable.

**Delivery available.** Both options are live, and choosing Delivery reveals the
delivery address field as before.

**Delivery unavailable.** The Delivery option is dimmed and untappable, with a
line underneath saying why in the customer's own terms:

| Why | What the app says |
| --- | --- |
| The customer is outside the zone | "We only deliver within Askari X. You can still place this order for pickup." |
| The kitchen is outside the zone | "This kitchen is outside our Askari X delivery zone. You can still place this order for pickup." |
| The kitchen has no pickup address set | "This kitchen hasn't set a pickup address, so we can't arrange delivery." |
| The app doesn't know where the customer is | "We couldn't confirm your location, so we can't arrange delivery." — with a **Share my location** button |

Only the last two rows about the *customer's* end come with a button, because
only those can be fixed by the customer. Offering "share your location" when the
kitchen is the one out of range would send them down a dead end.

**Place Order stays enabled throughout.** There is no state in which checkout
cannot be completed.

## Why the app cannot answer this on its own

The website and the app both know where the customer is, but neither knows where
the kitchen is: a chef's exact coordinates are deliberately never published, and
checkout shows only a masked address until an order is placed
(see [Location & Address Privacy](04-location-and-address-privacy.md)).

So the app asks the server instead, sending the dishes in the cart and the
position it has. The server runs exactly the check the order endpoint will run,
and answers yes or no with a reason. If that call fails — a flaky connection —
the app **hides** the delivery option rather than offering it, because the
server would refuse the order anyway and a refusal after payment details are
filled in is exactly what asking up front is meant to avoid. Pickup is
unaffected, so nobody is stuck.

## Confirming a location

The confirm-location card offers the same two routes the website's dialog does,
and either is a complete answer:

- **Share my location** — raises the permission prompt, or reads the position
  straight away if permission is already there.
- **Enter your address** — the same address field with live suggestions used at
  signup and in the profile. Picking a suggestion pins an exact spot, and that
  spot is checked the same way a device position is.

Only an address chosen from the suggestion list counts. Free-typed text that was
never matched to a real place cannot be checked against anything, so it is not
accepted.

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
whereas the app can put them on the right screen. It only appears when a setting
is genuinely what is standing in the way.

A position that comes back wildly imprecise is treated as no position at all. A
fix good to within a kilometre or worse could place an Askari X resident in
another part of the city, and being wrongly told "we can't deliver to you" is
worse than being asked for an address.

Declining all of this costs the delivery option and nothing else.

## Where the customer finds out

- **In the cart** — if the app *already* knows the customer is outside the zone,
  a short note says the order will be for pickup, so the news does not arrive at
  the last step. It is a note, not a warning: nothing is blocked. The cart never
  asks for a location itself and never raises a prompt; it only reports what is
  already known.
- **At checkout** — where the Pickup/Delivery choice is made, and the only place
  the zone has any visible effect.

Nothing is shown on the home feed, on Find Chefs, or on dish and chef screens.

## The delivery address is checked too

For a delivery order there are two customer-side places involved: where the
customer is standing, and where the food is going. Both have to be in the zone.
The delivery address is pinned from the suggestion list, and if it falls outside
the zone the field says so directly, even when the customer themselves is
inside.

## What is sent with the order

The confirmed position travels with the order, so the server judges the same
place the app did rather than falling back to the address saved on the profile.

Accepting a chef's offer on a food request creates a real order, but such an
order has no dish and therefore no kitchen address, so it is always a **pickup**
order. It is never refused on location grounds; the app still sends a position
with it, and the server now ignores it.

If the app cannot load the zone at all, it still lets the customer order — as it
always could. A failed config fetch has never been a reason to refuse an order,
and now there is nothing to refuse.

## Related

- [Location & Address Privacy](04-location-and-address-privacy.md) — everywhere
  else the app uses your location, and how a chef's address is protected
- [Where the App Differs from the Website](05-parity-with-the-website.md)
- The server-side rule and the APIs that report it are documented in the
  `meal-host` repo at `feature-docs/13-service-area-and-ordering-zone.md`.
