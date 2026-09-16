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

**Service area restrictions.** The website limits ordering to the Askari X
neighbourhood: it asks for your location, checks it against the delivery zone,
and explains things rather than letting you fill in a whole checkout only to
be refused.

The app cannot do this yet because the endpoint the website calls
(`GET /service-area`) does not exist in the backend repository, and neither
does the handling for the coordinates an order would send with it. The one
piece that could be taken early has been: the app now reads structured error
codes from the backend, so when the zone check does arrive its refusals will
read properly instead of as `[object Object]`.

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

## Where the app is ahead

Worth knowing before "fixing" these to match:

- **Availability** — the app's weekly opening-hours editor uses the phone's
  native time pickers, and shows bulk shortcuts and a week summary. (The
  website caught up on validation in August 2026, so the two are now close.)
- **Notifications** — the app syncs the icon badge, routes taps to the right
  screen, handles a notification that arrives while it is closed, and asks
  permission gently before triggering the system prompt.
- **Offline chefs** — the app re-checks whether a chef is still open when you
  return to your cart, and blocks checkout with the time they next open.
- **Saving a single chef field** no longer wipes the others. The app's profile
  save was corrected to send only what changed; sending a partial kitchen
  profile used to blank the chef's specialities, cuisines and food-safety
  documents.
