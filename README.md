# Measure 238 Recognizer (Google Apps Script)

Google Apps Script that scans a Google Sheet for MIPS measure 238
high-risk medications, groups hits by drug class, and flags a row for
review only when 2+ orders from the same class are found.

This is not Python. It runs inside Google Sheets.

## Setup

No Python packages needed.

## Run

1. Open your Google Sheet
2. Extensions -> Apps Script
3. Paste the contents of `Measure_238.gs`
4. Save, then run it from the sheet's menu

## What to edit before running

Nothing - it reads the sheet it is attached to.

## Never commit

Patient or client data (`.xlsx`, `.pdf`, `.csv`), `service_account.json`,
and chromedriver binaries. All are covered by `.gitignore`.
