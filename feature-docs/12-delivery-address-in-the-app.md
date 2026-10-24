# Choosing Your Delivery Address in the App

## What this feature is

The app now works the way the website does since October 2026: there is **one
delivery location** for the whole app, chosen once and used everywhere — the
dish feed, Find Chefs, the cart and checkout. Signed-in customers can save
addresses (Home, Work, or a name of their own) with the details a rider needs,
and switch between them in one tap.

What a saved address holds, and the rules for deleting one, are the same as on
the website — see `meal-host-frontend/feature-docs/21-choosing-your-delivery-address.md`.
This page covers what is different about the app.

## Where you choose it

In the header of the **Home** and **Find Chefs** tabs, under the logo, a
**Deliver to** line shows the address in use — its label ("Home", with the
address underneath) or the first part of the address — or **Set your
location** if nothing is chosen yet. Tapping it opens a sheet with:

- a **search box** with Google suggestions (Pakistan only, nearest to the
  ordering zone first),
- **Locate me**,
- your **saved addresses**, the one in use ticked, each with Edit and Delete,
- **Add new address**.

Signed-out visitors get the search box and Locate me, and a prompt to sign in
to save addresses.

## Pinning it on a map

Picking a suggestion, Locate me, Add new address and Edit all open a full-screen
map. The pin stays in the centre, labelled **We'll deliver here**; you move the
map underneath it. The address is looked up only when you tap the button, so
dragging around costs nothing.

- **Signed out:** the button says **Find chefs** and simply sets the location.
- **Signed in:** **Confirm location** moves on to the details step — house /
  flat number (required), street (filled in from the map where possible),
  building / floor and a note to the rider (both optional), and a Home / Work /
  Other label. **Save address** saves it and makes it the one in use.

On iPhone the map is Apple Maps; on Android it is Google Maps. The address
lookup is Google on both, falling back to OpenStreetMap.

If Locate me can only find you approximately, the map still opens there and
asks you to move the pin onto your door. On Android the map needs the Google
Maps key in the build; without it the map area says so and Locate me or search
still work.

## What the app remembers

The chosen location is kept on the phone, together with the account it was
chosen under, so a saved address never follows the next person to sign in. If
nothing has been chosen, the app uses the address on your profile. The app
never asks for your location on its own — only when you tap Locate me.

If location permission is blocked in the phone's settings, Locate me says so
and offers **Open Settings**, which goes straight to FoodPal's settings page.

A location chosen in an older version of the app at checkout carries over as a
pin, so nobody has to pick again after updating. A pin the address lookup could
not name at the time is named quietly the next time the app opens.

## What changed on each screen

| Screen | Before | Now |
| --- | --- | --- |
| Home and Find Chefs | A "search area" switch in the filter sheet (my location / profile address / custom), and Home asked for location permission on opening | The **Deliver to** line in the header; the filter sheet shows the location in use with **Change**, and keeps the distance slider. Neither screen asks for permission |
| Checkout | A free-text delivery address box | A card showing the address in use, its rider note, and **Change**; or **Set your delivery address** |
| Cart | Read its own stored location for the ordering-zone note | Reads the shared location |
| Signup and Profile | Picking a suggestion filled the address straight away | Picking a suggestion, Locate me or the map button opens the map; **Use this location** confirms it. This never changes your delivery location or saved addresses |

The order still carries the address as text, with the rider note appended
("… — Note: ring the bell twice").
