# Deleting Your Account

## Where it is

**Profile → Delete Account**, at the very bottom of the screen, below Sign Out
and set apart from it. It is the last thing on the page on purpose: nobody
should reach it while looking for something else.

The same entry appears whether you are using the app as a customer or as a
chef. There is one account behind both, so there is one way to close it.

## What the screen tells you before you decide

Tapping **Delete Account** opens a separate screen rather than a pop-up. A
pop-up has room for a sentence; this decision needs a page.

The screen says plainly what goes and what stays:

**Gone for good**

- Your name, email, phone number and saved addresses
- Your saved chefs and dishes
- If you cook: your kitchen, your dishes and your opening hours — removed from
  the app the moment you confirm

**Kept, without your name on it**

- Past orders and what was paid, because they are also the other side's
  receipt
- Reviews you have written, shown from "Deleted User"

It also says the two things people most often assume wrongly: that this cannot
be undone, and that signing up again later starts an empty account — your
order history does not come back, and a chef has to be approved again.

## Confirming

The button stays disabled until you type **DELETE** into a field. It is a
deliberate speed bump: an accidental double-tap cannot close your account, and
a child or a pocket cannot either.

There is no password re-entry. You are already signed in on this phone, and
asking again adds friction without adding safety.

## What happens when you confirm

The app closes the account, signs you out and drops you back on the public
**Find Chefs** tab — the same place Sign Out leaves you, so the app is still
browsable and does not look broken. A short message confirms the account was
deleted.

Your sign-in stops working immediately. Not at the end of the day, and not
whenever the app next happens to check — the moment you confirm.

## When it will not let you

If you have an order still on its way — one you placed, or one your kitchen
accepted — deletion is refused and the screen explains why, naming how many
orders are outstanding. Food or money is still owed in one direction, and
erasing one side of a live order would leave the other stranded.

This is temporary. Once those orders are delivered or cancelled, come back and
the deletion goes through. Nothing else blocks it.

## Why the app has this at all

Apple requires any app that lets you create an account to let you delete it
from inside the app, without emailing anyone (App Store Review Guideline
5.1.1(v)). The website shares the same backend and the same rules, so closing
an account from either place does exactly the same thing.

The server side — what is erased, what is kept, and why — is described in the
`meal-host` repo, `feature-docs/18-account-deletion.md`.
