# The FoodPal Look in the App

The app is being re-skinned to **FoodPal** — the same brand the website has
already moved to. Nothing about how the app *works* changes here: the same
screens, the same taps, the same orders. What changes is what all of it looks
like. The brand itself, and the reasoning behind the palette, live in the
website's `feature-docs/` in the `meal-host-frontend` repo and in the project's
`FOODPAL_REBRAND_PLAN_2026-09-17.md`. **What is different in the app** is below.

> **What changed.** The app was deep green and gold. It becomes blue, orange
> and cream, on the website's exact palette, so that someone who orders on
> their phone and then opens the site on a laptop sees one product rather than
> two.

## The new colours

| Colour | Where it is used |
| --- | --- |
| **FoodPal Blue** | Every primary button, active tab, link and selected state. The colour that means "tap this." |
| **FoodPal Orange** | Accents only — badges, highlights, small flourishes. Never a plain background behind small text. |
| **Cream** | The page behind everything. Cards sit on top of it in white, so a card now reads as a card. |

The app used to put white cards on a white background and lean on borders to
separate them. On cream, cards separate themselves.

**Orange is deliberately not the button colour.** White text on the brand
orange is too faint to read comfortably — it falls below the accessibility
standard the rest of the app meets. Blue is the action colour everywhere, and
where a solid orange surface does need to carry text, a slightly deeper orange
is used instead. This is the same rule the website follows.

The app is full of small orange labels — cuisine tags, dietary chips, the
numbered steps in checkout, a chef's initials where they have no photo, the
highlighted row when you pick an address. Those are not solid orange. They sit
on a pale orange tint with deep orange lettering, which is both easier to read
and quieter on a busy screen. Drawn in full-strength orange they would be
unreadable: the blue lettering they previously carried scores 3.0 against it,
where the tint scores 6.8.

## Buttons are pills

Buttons are now fully rounded at every size, matching the website and the
brand's "round edges everywhere" rule. There are four treatments: blue with
white text, white with blue text and a blue outline, and the same pair in
orange for the rarer accent cases.

## Order status colours are not brand colours

An order's status — pending, being cooked, ready, completed, cancelled — gets
its own colour, and none of them is brand blue. A status badge should never be
mistaken for something to press. Each status keeps a colour distinct enough
from its neighbours that a customer scanning their order list can tell them
apart at a glance, and each one matches the colour the same order shows on the
website. A chef looking at the same order on both never sees it change colour.

The customer's order list, the chef's order list and the chef's earnings screen
each used to decide status colours for themselves, and they disagreed: an order
the chef had just confirmed showed one way to the customer and another to the
chef, and a delivered order was grey on one screen and green on another. All
three now read the same list, so a customer and a chef looking at the same
order describe it the same way. On the earnings screen a confirmed order also
used to be drawn in brand blue, which made a status look like a button; it no
longer is.

Payment success stays green and errors stay red. Those meanings are older than
the brand and are not worth re-teaching.

## The app's type changes

Headings and body text move to the same typeface the website now uses. The app
previously used a different one, so the two products read slightly differently
even when they said the same words. Text sizes and spacing are unchanged — only
the shape of the letters.

## Dark mode

**The app does not have dark mode, and this work does not add it.** The app
asks the phone for light appearance and gets it, whatever the phone is set to.
This is worth stating plainly because the website *does* have a dark mode, so
the two are not at parity here — see
[Where the App Differs from the Website](05-parity-with-the-website.md).

A dark version of the new palette is nevertheless written down alongside the
light one, copied from the website's, with brand blue lightened so it stays
readable on a dark screen. Nothing reads it yet. It is there so that turning
dark mode on later is a switch rather than a second round of colour work.

## What is not changing in this work

- **Every screen's layout.** Nothing moves, nothing is added, nothing is
  removed.
- **Anything a chef or customer can do.** No new behaviour, no removed
  behaviour.

The app's name, icon, splash and logo were a separate step, and have since been
done — see [Becoming FoodPal](09-becoming-foodpal.md).

## Checks that run against this

Two checks protect the palette, and both can be run on demand:

- One fails if any screen spells out its own colour instead of taking one from
  the shared set.
- One measures every text-on-background pair in the palette against the
  accessibility standard and fails if any falls short.

The second one found two real problems while this work was being done, both
inherited from the website: the green used for "open" badges and success
toasts, and the strong orange in the unused dark palette, each carried white
text below the readable threshold. Both are a shade darker in the app than on
the website as a result. **The website still has both and should take the same
correction.**

## Why it should not drift back

Colours in the app now come from one place. A screen that hard-codes its own
colour is what left green and gold scattered through the app the last time the
brand moved, and that is what makes a re-skin expensive. Every screen reads
from the shared set of colours instead, so the next change is one edit.
