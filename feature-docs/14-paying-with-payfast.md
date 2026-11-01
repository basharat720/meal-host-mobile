# Paying with PayFast in the App

## What this feature is

The app can take payment online through **PayFast**, the same way the website
does: card, bank account or mobile wallet, on PayFast's own secure page. Cash
stays available exactly as before.

It is **switched off in the app for now.** An admin turns it on from the
website's admin portal (**Settings → PayFast in the mobile app**), and it then
appears in the app within about a minute, with no app update. While it is off,
the app's checkout looks exactly as it does today: cash only.

## Two switches, both needed

| Switch | What it does |
| --- | --- |
| **PayFast online payment** | PayFast on or off everywhere, website and app. The server enforces it. |
| **PayFast in the mobile app** | Whether the app offers PayFast. Starts **off**. |

The app shows PayFast only when **both** are on. Turning the second one on
doesn't touch the website; turning the first one off hides PayFast in both.

## Paying with PayFast

1. At checkout, under **Payment**, choose **Pay Online** instead of
   **Cash on Pickup**. The button at the bottom changes to
   **Pay — Rs …**.
2. Tapping it places the order, then opens **PayFast's payment page inside the
   app**, with a short "Connecting to PayFast…" screen while it loads.
3. You pay on PayFast's page. FoodPal never sees your card or wallet details.
4. When PayFast finishes, the app takes over again, confirms the payment with
   FoodPal, and shows the usual **order placed** screen. Your cart is emptied
   then, not before.

The kitchen is only told about the order once the payment has gone through,
and your receipt email arrives at the same point. An order you abandon on
PayFast's page never reaches the kitchen.

## If something goes wrong

- **The payment fails or is declined:** you see **Payment didn't go through**
  with PayFast's reason. Your cart is still there, so **Try again** takes you
  back to checkout. Nothing was charged.
- **You close the PayFast page:** the app asks whether you want to leave the
  payment. If you do, you're back at checkout with your cart intact.
- **The payment went through but the app couldn't confirm it** (for example,
  the connection dropped): the app says so and points you to **My Orders**.
  PayFast tells FoodPal directly as well, so the order still updates.
- **PayFast is switched off while you're at checkout:** the order is refused
  with "Online payment isn't available right now", and the choice goes back to
  cash.

## Requests and offers

Accepting a chef's offer goes through the same checkout, so it can be paid with
PayFast too, the same as on the website.

## Behind the scenes

The app uses the same server steps as the website: it places the order, asks
FoodPal for the PayFast form, sends it to PayFast inside an in-app browser
view, and spots PayFast returning to FoodPal's success or failure address. It
then confirms with FoodPal before showing success. See the `meal-host` repo,
feature-docs/23-feature-flags.md, for the switches, and
feature-docs/06-payments-fees-and-payouts.md for payments.

The in-app browser view is a new native part of the app, so this needs a new
app build. Until the switch is turned on, that build behaves exactly like the
current one.
