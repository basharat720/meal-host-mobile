# PakwanHus — Mobile App Feature Documentation

PakwanHus is an online marketplace for **home-cooked food**. This folder
explains **what the mobile app does**, written for anyone — no technical
background needed.

The app and the website share one backend and offer the same features, so this
folder does not restate them. For what a feature *does*, read the website's
own `feature-docs/` in the `meal-host-frontend` repo, or the backend's in
`meal-host`. **What lives here is what is different about the app**: how it is
navigated, what the phone can do that a browser cannot, and where the app is
currently behind the website.

## The two kinds of people who use the app

| Who | What they do |
| --- | --- |
| **Customer** | Browses kitchens and dishes, orders food, posts requests for dishes they want, reviews chefs |
| **Chef** | Publishes a menu, sets opening hours, accepts and fulfils orders, bids on customer requests, tracks earnings |

Admins are not part of the app — the admin portal is website-only, and
deliberately so.

One person can be both a customer and a chef on the same account and switch
between the two.

## Documents

| Document | What it covers |
| --- | --- |
| [Getting Around the App](01-getting-around-the-app.md) | The tab bars, which tab opens first, and the two separate areas for chefs and customers |
| [Accounts & Signing In](02-accounts-and-signing-in.md) | What signup asks for, email verification, and why there are no social sign-in buttons |
| [Notifications & Opening a Link](03-notifications-and-links.md) | Push notifications, the badge on the app icon, and what happens when a link points at the app |
| [Location & Address Privacy](04-location-and-address-privacy.md) | When the app asks for your location, and how a chef's address is protected |
| [Where the App Differs from the Website](05-parity-with-the-website.md) | A current, honest list of what the website does that the app does not yet |
