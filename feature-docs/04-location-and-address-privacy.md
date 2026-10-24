# Location & Address Privacy

## When the app asks for your location

The app asks for your location **only when you tap Locate me** — in the
location sheet, on the address map, or on an address field at signup and in
Profile. Nothing else in the app reads the phone's position or raises the
permission prompt.

Everything that benefits from knowing where you are reads the **one delivery
location** you chose with the location pill at the top of Home and Find Chefs
— a saved address, or a pin you placed on the map. If you have not chosen one,
the app uses the address on your profile; signed out with nothing chosen, it
does without. See [Choosing Your Delivery Address in the App](12-delivery-address-in-the-app.md).

| Where | What it uses the delivery location for | With no location chosen |
| --- | --- | --- |
| Find Chefs | Puts the nearest kitchens first, shows each one's distance, and limits the search to the distance slider | Kitchens everywhere are listed, without distances |
| The dish feed | Limits dishes to the distance slider | Shows dishes from everywhere |
| Cart | Says up front when the order will be pickup because the location is outside the ordering zone | Says nothing |
| Checkout | Is the delivery address, shows how far away the chef is, and checks you are inside the ordering zone | Pickup works as normal; Delivery asks you to set an address |

This matters most at checkout. A system permission dialog appearing in the
middle of paying for food is the kind of interruption that loses an order, so
the app never does it there. See
[The Ordering Zone in the App](07-ordering-zone-in-the-app.md).

If you blocked location for FoodPal, Locate me says so and offers **Open
Settings**, which goes straight to FoodPal's page in the phone's Settings.

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
