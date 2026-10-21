# Chef Launch Details in the App

## What this feature is

Chefs can now fill in everything on FoodPal's launch checklist from the
**Profile** tab in the app: CNIC first and last name, kitchen name, email and
phone, home address, bank account details and NTN status (filer or
non-filer). The website's Profile page has the same fields and rules. Details
saved on one show up on the other.

## What changes on the Profile tab (chefs only)

- **Full Name** becomes two boxes: **First name (as per CNIC)** and **Last
  name (as per CNIC)**. They start with the names given at signup.
- A new **Bank & Tax Details** section adds **Bank name**, **Account title**,
  **Account number**, **IBAN** and an **NTN status** choice of **Filer** or
  **Non-filer**.

Customers see no change.

## Saving

Every checklist item is required for a chef. Tapping Save with something
missing or malformed shows an alert listing what to fix, and nothing is
saved. The rules match the website: both names filled in, a valid phone
number, a kitchen name of at least 3 characters, an account number of 8–20
digits, a valid Pakistani IBAN (24 characters starting with `PK`) and a
filer/non-filer choice.

Chef signup in the app now also keeps the CNIC first and last name as
separate fields rather than only joining them into one name.

Bank details and NTN status are never shown to customers. Admins read them on
the website's admin portal.
