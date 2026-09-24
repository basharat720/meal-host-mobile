# Order Chat in the App

Chatting with a chef about a confirmed order works the same in the app as on
the website — what it is, when it opens and when it closes is described in the
website's `feature-docs/` in the `meal-host-frontend` repo. **What is different
in the app** is below.

## It is a screen, not a panel

The website opens the conversation in a panel over My Orders. The app pushes a
full **Chat** screen instead, reached from the Chat button on a confirmed order
in the **Orders** tab — the customer's own, and the chef's under Earnings &
Orders — with a back arrow to the list you came from.

The keyboard is handled the way a messaging app should handle it: the message
box rises with the keyboard, the newest message stays in view, and the thread
opens scrolled to the bottom.

## A safety notice before the first message

A conversation that has not started yet opens on a short notice rather than an
empty thread: keep the conversation and every payment on PakwanHus, never share
bank or card details, and use the chat for questions about this order only.
Tapping **Got it, continue** reveals the thread.

It is shown once per order and remembered afterwards, so returning to a
conversation that is already under way goes straight to the messages. A thread
that already has messages in it never shows the notice — it was fronted by it
when it was started.

This matches the website, which added the same notice to its chat panel.

## Notifications open the chat directly

Tapping a new-message push takes you straight into that order's chat screen,
not to the orders list — the same link handling described in
[Notifications & Opening a Link](03-notifications-and-links.md), pointed at the
chat.

The app icon badge counts unread chat messages along with the other
notifications it already counts.

## Going quiet, and coming back

Phones lose signal, and the app gets suspended whenever you switch away from
it. The chat's live connection drops in both cases and reconnects by itself
when the app comes back to the foreground; anything sent while it was away is
loaded in as the screen reopens. A **Reconnecting…** line shows while that is
happening. On a bad connection the app falls back to fetching new messages
every few seconds, so a message still gets through — just a little slower.

Messages you send are posted the same way any other action is, so a send that
fails on a dead connection reports the failure rather than disappearing.

## Not in the app

There is no admin side in the mobile app, so the admin's read-only view of a
conversation is website-only — as with everything else admin, deliberately so.
See [Where the App Differs from the Website](05-parity-with-the-website.md).
