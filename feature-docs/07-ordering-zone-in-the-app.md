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

## Where the customer's position comes from

Since October 2026 the position is the **one delivery location** chosen with
the location pill at the top of Home and Find Chefs — a saved address, or a pin
placed on the map — exactly as on the website. See
[Choosing Your Delivery Address in the App](12-delivery-address-in-the-app.md).
With nothing chosen, a signed-in customer's profile address is used.

Checkout never reads the phone's position and never raises a permission
prompt: a system dialog appearing in the middle of paying for food is the kind
of interruption that loses an order
(see [Location & Address Privacy](04-location-and-address-privacy.md)). The
prompt only ever follows a tap on **Locate me**.

- **A location is chosen** — the app asks the server whether delivery can be
  offered for it. A customer inside Askari X ordering from a kitchen inside
  Askari X sees both options and carries on as before.
- **Nothing is chosen** — checkout simply opens as a pickup order, with the
  Delivery option dimmed and a **Share my location** button that opens the
  location sheet. Nothing is lost by ignoring it.

## What the customer sees at checkout

The Pickup / Delivery pair is unchanged in layout. Pickup is selected by
default and is always tappable.

**Delivery available.** Both options are live, and choosing Delivery shows the
delivery address: a card with the chosen location's name, its full address and
its note to the rider, and **Change**, which opens the location sheet.

**Delivery unavailable.** The Delivery option is dimmed and untappable, with a
line underneath saying why in the customer's own terms:

| Why | What the app says |
| --- | --- |
| The customer is outside the zone | "We only deliver within Askari X. You can still place this order for pickup." |
| The kitchen is outside the zone | "This kitchen is outside our Askari X delivery zone. You can still place this order for pickup." |
| The kitchen has no pickup address set | "This kitchen hasn't set a pickup address, so we can't arrange delivery." |
| The app doesn't know where the customer is | "We couldn't confirm your location, so we can't arrange delivery." — with a **Share my location** button |

When delivery is unavailable a card at the top of checkout also says **This
order is for pickup**. If the reason is on the *customer's* end — outside the
zone, or no location — it carries a button (**Change location** or **Share my
location**) that opens the location sheet, because only those can be fixed by
the customer. Offering "share your location" when the
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

## Setting or changing the location

Every "Share my location", "Change location" and "Change" button at checkout
opens the same location sheet the pill opens: search with suggestions, **Locate
me**, the saved addresses, and **Add new address**. Whatever is chosen there
becomes the location for the whole app, so the cart, checkout, Home and Find
Chefs all agree. It is remembered on the phone until the customer picks another.

If location permission was refused for good, Locate me says so and offers
**Open Settings**, which goes straight to FoodPal's page in the phone's
Settings — the website can only describe where the browser's menu is. A fix too
vague to trust (worse than a kilometre) still opens the map there, with a note
asking the customer to move the pin onto their door.

Declining all of this costs the delivery option and nothing else.

## Where the customer finds out

- **In the cart** — if the chosen delivery location is outside the zone, a
  short note says the order will be for pickup, so the news does not arrive at
  the last step. It is a note, not a warning: nothing is blocked. The cart never
  asks for a location itself and never raises a prompt.
- **At checkout** — where the Pickup/Delivery choice is made, and the only place
  the zone has any visible effect.

Nothing is shown on the home feed, on Find Chefs, or on dish and chef screens.

## The delivery address is the checked position

The delivery address is no longer typed at checkout: it *is* the chosen
delivery location, so where the food goes and the point the zone rule judges
are always the same place. If it falls outside the zone the address card says
so directly. The order carries it as text, with the rider note appended
("… — Note: ring the bell twice").

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
