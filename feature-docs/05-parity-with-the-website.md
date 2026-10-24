# Where the App Differs from the Website

The app and the website share one backend and are meant to offer the same
thing. They drifted apart between June and September 2026, when work continued
on the website while the app stood still. Most of that gap has since been
closed; this is what is honestly still open.

Kept current so it does not have to be rediscovered by reading both codebases.

## Not in the app, and not planned

**The admin portal.** Chef approvals, customer management, order oversight and
refunds are website-only, on purpose. Roughly 2,900 lines of the website has
no app equivalent and is not intended to get one.

## Waiting on the backend

**Online card payment.** The website takes payment through PayFast: a payment
method choice at checkout, a branded handover screen, and success and failure
screens it returns to. The app offers cash only. (An order paid by card on the
website still shows a **Card** tag on its order card in the app.)

This is not simply unported. The website calls payment endpoints
(`payments/payfast/…`) that do not exist in the backend repository, so the
website is ahead of the shared backend here, not just ahead of the app. The
app should follow once the backend side is real.

## Waiting on credentials or configuration

**Social sign-in.** Google sign-in has never worked in any build of the app —
the button always failed — so it is hidden. Turning it on needs Google OAuth
client IDs and a new native build. Facebook sign-in, which the website has,
has not been built.

**Email links opening the app.** Order emails link to a specific order but
open the website. Fixing this needs two verification files hosted on
pakwanhus.com. See
[Notifications & Opening a Link](03-notifications-and-links.md).

## Waiting on translation

**Norwegian.** The app can store a language preference and has a translation
system, but there is no language switcher and no screen uses it — everything
reads in English.

This is not a small wiring job. There are roughly 450 pieces of text on screen
and about 312 translation entries, and those were written for the website's
screens, so the app's chef order, earnings and availability screens have no
entries at all. The six legal and information screens — Privacy, Terms, Refund
Policy, FAQ, How It Works, Contact — are thousands of words with no Norwegian
anywhere. Wiring it up without that copy would show Norwegian users English
with no sign that it is untranslated, which for legal text is worse than
nothing.

## Kept website-only on purpose

**The "ordering is paused" switch.** The website has a launch switch that
turns ordering off and shows a "coming soon" banner in its place. The app has
no equivalent and is not meant to get one — the app is only released once
ordering is live, so it would only ever be a way to break checkout by
accident.

## Smaller open items

- **Adding a role to an existing account.** You can switch between roles your
  account already has, but not gain a new one. The website appears to offer
  this, but its version does not actually work — the backend's update endpoint
  does not accept the role fields it sends, so the call silently changes
  nothing. Doing it properly needs a backend endpoint first.
- **Website-only pages** with no app equivalent: the Coming Soon pages
  (pricing, guidelines, success stories), the footer, and a custom
  page-not-found screen. Privacy, Terms, Refund Policy, FAQ, How It Works and
  Contact all exist in the app.
- **A chef's full address on their profile screen** is not masked. The website
  has the same gap.

## Recently brought level with the website

- **Order cards** (October 2026) — My Orders and the chef's Orders screen now
  use the website's card design: plain-language status strip with Pal,
  progress bar, rating on the card, Upcoming / In transit / Completed /
  Cancelled tabs and Needs action / Waiting / History queues with search. See
  [Order Cards in the App](13-order-cards-in-the-app.md).
- **Contact form** — the Contact screen now has the website's message form
  (name, email, subject, message), which works signed out and pre-fills from
  your account when signed in, alongside the phone, email, hours and office
  address (with a Google Maps link).
- **Privacy Policy text** — the app carries the website's paragraph on
  delivery riders' location, and "Delete your account" links to the app's
  Delete Account screen.

## Where the app is ahead

Worth knowing before "fixing" these to match:

- **Availability** — the app's weekly opening-hours editor uses the phone's
  native time pickers, and shows bulk shortcuts and a week summary. (The
  website caught up on validation in August 2026, so the two are now close.)
- **Notifications** — the app syncs the icon badge, routes taps to the right
  screen, handles a notification that arrives while it is closed, and asks
  permission gently before triggering the system prompt.
- **Confirming your location** — the app never interrupts checkout with a
  permission prompt, and when a phone setting is what is blocking it, it opens
  the right Settings screen for you. The website can only describe where its
  browser's permission menu is. See
  [The Ordering Zone in the App](07-ordering-zone-in-the-app.md).
- **Offline chefs** — the app re-checks whether a chef is still open when you
  return to your cart, and blocks checkout with the time they next open.
- **Saving a single chef field** no longer wipes the others. The app's profile
  save was corrected to send only what changed; sending a partial kitchen
  profile used to blank the chef's specialities, cuisines and food-safety
  documents.
