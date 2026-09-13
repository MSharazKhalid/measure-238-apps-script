# Measure 238 Recognizer

Google Apps Script that flags MIPS Measure 238 high-risk medications in a Google
Sheet - firing only when two or more orders from the same drug class appear.

![Apps Script](https://img.shields.io/badge/Google_Apps_Script-4285F4?logo=googleappsscript&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-2ea44f)

## What it does

CMS Measure 238 concerns high-risk medication use in older adults. A single order
is not the signal - **two or more from the same drug class** is. So this script
groups hits by class and flags a row for review only when that threshold is met,
rather than surfacing every match and leaving a reviewer to sort it out.

Runs inside Google Sheets against the sheet it is attached to. No Python, no
dependencies, nothing to install.

## Setup

1. Open your Google Sheet
2. **Extensions → Apps Script**
3. Paste the contents of `Measure_238.gs`
4. Save, then run it from the sheet's menu

## Configure

Nothing to configure - it reads the sheet it is bound to.

## Notes on data

This repository contains **no client or patient data**, and the script reads only
the sheet you attach it to. Nothing leaves your Google account.

## License

MIT © Muhammad Sharaz Khalid - see [LICENSE](LICENSE).
