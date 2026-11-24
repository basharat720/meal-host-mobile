# Vouchers & Offers in the App

## What this feature is

FoodPal runs offers, such as **Biryani Friday: 20% off biryani, up to Rs 300**.
The app's checkout lets you apply one offer to your order, exactly as the
website does: type a code, or pick an offer from the list.

Some offers cover your whole basket. Others cover only certain dishes, so a
biryani offer discounts the biryani and leaves the burger at full price.
FoodPal pays for the discount, and the chef earns the full price.

## At checkout

An **Offers & vouchers** card sits above the order summary.

- Type a code and tap **Apply**. If it can't be used, a short note says why,
  for example *This offer is for biryani dishes*, *Fridays only* or *Add Rs
  200 more to use this offer*.
- **Available offers** shows the **top 3** offers for your basket (usable
  ones first, biggest saving first). Tap **Apply** on one you can use. Offers
  you can't use yet are greyed out with the reason.
- When there are more, **View all N offers** opens the **Offers & vouchers**
  screen with every offer and the code box. Applying an offer there takes you
  straight back to checkout with it on; the back arrow returns without
  changing anything.
- An applied offer shows as a chip with **Remove**. One offer per order.

The order summary gains a **Discount** line, and the total, the **Place
Order** button and the PayFast amount all use the discounted price. Dishes the
offer covers are marked **Offer applied**.

If the basket changes and the offer no longer fits, it's removed with a note.
If it stops being usable just as you order, the order isn't placed and the
app tells you why, so you never pay a different amount from the one shown.

The discount never applies to the delivery fee.

### Offers applied for you

Some offers **apply automatically**, for example a first-order offer for new
customers. When one fits the basket, checkout applies it as it opens and shows
a highlighted banner at the top of the Offers & vouchers card: *First order
offer applied: 50% off biryani. You save Rs 450.* The discount line, total and
PayFast amount update as usual.

- If several automatic offers fit, the biggest saving wins.
- If one doesn't fit yet, a banner shows it with what's missing: *Don't miss
  your offer: Biryani Friday*, its one-line rule, and for example *This offer
  is for biryani dishes*. The offer goes on as soon as the basket fits.
- **Remove** takes it off, and checkout doesn't put it back until you leave
  checkout and come back. Applying another code works the same way.

A **first order** offer is only for people who have never ordered on FoodPal,
in the app or on the website (cancelled orders don't count). Customers who
have ordered before don't see it, and typing its code says *This offer is for
your first FoodPal order.*

## Orders

Customer order cards and details show the discount. Chef order cards show a
note that the customer used a FoodPal offer and the chef still earns the full
price.

## Older app versions

An app installed before this update doesn't show offers, and its orders
simply never carry a voucher.

App versions from before automatic offers (1.1.4 and earlier) show an
automatic offer as an ordinary offer in the list, and the customer taps
**Apply** themselves.

## Behind the scenes

See the `meal-host` repo, feature-docs/27-vouchers.md.
