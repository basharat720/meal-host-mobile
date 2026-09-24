# Location & Address Privacy

## When the app asks for your location

The app asks for your location **only when you have asked it to do something
that needs it** — tapping **Locate me** on an address field is the one place a
permission prompt appears.

Everywhere else that benefits from knowing where you are, the app checks
whether you have *already* granted permission and quietly does without if you
have not:

| Where | What it uses your location for | If permission is not granted |
| --- | --- | --- |
| Find Chefs | Puts the nearest kitchens first and shows each one's distance | Kitchens are still listed, without distances |
| The dish feed | Limits dishes to a chosen radius | Searches without a radius |
| Checkout | Shows how far away the chef is, and checks you are inside the ordering zone | The area is still shown, without a distance; a card asks you to confirm where you are |

This matters most at checkout. A system permission dialog appearing in the
middle of paying for food is the kind of interruption that loses an order, so
the app never does it there.

Checkout is also the one place where the app cannot simply do without a
location, because ordering is restricted to one neighbourhood. It still does
not prompt: it uses permission you have already granted, and otherwise asks
with a card you can answer by tapping a button or by entering an address. See
[The Ordering Zone in the App](07-ordering-zone-in-the-app.md).

## How a chef's address is protected

**A chef's exact address is never shown before an order is confirmed.** Home
chefs cook from where they live, so their street address is their home
address.

Before confirmation, a customer sees the *area* instead: the most specific
locality the app can identify, the postal code, and roughly how far away it is
— for example **"Askari X (54000) • ~2.4km away"**. Underneath, the app says
plainly that the exact address will be shared once the order is confirmed.

Working out the area is deliberately careful. It picks the most specific real
place name in the address and discards everything that is either too vague to
be useful or too precise to be safe:

- **Too vague:** provinces and countries — "Punjab", "Pakistan".
- **Too precise:** house, plot, flat and shop numbers.
- **Not a place:** generic street words on their own — "Road", "Street",
  "Boulevard".

Well-known neighbourhood names are recognised directly, so DHA phases,
Gulberg, Gulshan-e-Iqbal, Model Town, Johar Town and numbered sectors such as
F-7/2 are reported by name. Anything else falls back to reading the address
from most specific to most general and taking the first part that actually
looks like a place.

The real address is still sent to the backend with the order — the chef needs
it, and so does the customer once it is confirmed. Only what is displayed
beforehand is reduced.

> **Known gap:** a chef's full address is still shown on their profile screen.
> The website has the same gap, so this is not something the app introduced,
> but it is worth fixing in both.
