# Delivery Fee in the App

## What this feature is

A delivery by a FoodPal rider has a price: a **base fee plus a charge for
every kilometre** between the kitchen and you. Today that is **Rs 100, plus
Rs 15 per km**.

**Delivery is free for now.** The app's checkout shows what delivery would
cost, crossed out, with a note saying it's free for now, exactly as the website
does. When FoodPal starts charging, the line stops being crossed out and the
fee is added to your total.

## What you see at checkout

Choose **Delivery** at checkout. Above the delivery address, a **Free delivery
for now** note explains that a FoodPal rider brings the order to your door,
what delivery normally costs, and that you won't be charged for it. It
replaces the old "Transportation cost on customer" note. Once charging is on,
it becomes a **Delivery fee** note saying the fee is added to your total.

The order summary then shows:

- **Subtotal**: your dishes.
- **Delivery fee** and the distance, for example *Delivery fee (2.3 km)*. While
  delivery is free, the amount is crossed out with **Free** beside it.
- **Total**: while delivery is free, the total with delivery is crossed out
  next to the total you actually pay.
- **Delivery is free for now.**

Choose **Pickup** and the delivery line disappears.

The fee depends on where you are and where the kitchen is, so it updates when
you change your delivery location.

## When delivery is charged

Once an admin switches charging on, the fee is a normal line, it's included in
the total, and the checkout button shows the full amount. Cash at the door and
PayFast both use that amount.

There's nothing to set in the app. Prices and the on/off choice are managed by
admins on the website's admin portal (**Settings → Delivery fee**), and reach
the app without an update.

## Behind the scenes

The fee is worked out by the server. See the `meal-host` repo,
feature-docs/25-delivery-fee.md, and for the website's checkout the
`meal-host-frontend` repo, feature-docs/23-delivery-fee.md.
