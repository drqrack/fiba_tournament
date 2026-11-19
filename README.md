# FIRE 3x3 FIBA Tournament — Team Registration Site

A single-file, mobile-first registration website for the **FIRE 3x3 FIBA Tournament**.
No backend server needed — submissions are saved to a **Google Sheet** via a
**Google Apps Script** web app. Host the page free on **GitHub Pages** or **Netlify**.

```
index.html       ← the whole website (HTML + CSS + JS in one file)
apps-script.gs   ← paste into your Google Sheet (Extensions > Apps Script)
README.md        ← this file
```

---

## 1. Set up the Google Sheet + Apps Script (the "backend")

1. Create a new Google Sheet (go to [sheets.new](https://sheets.new)). Name it e.g. *FIRE 3x3 Registrations*.
2. In the Sheet menu, open **Extensions → Apps Script**.
3. Delete any starter code, then **paste the entire contents of `apps-script.gs`**.
4. Click **Save** (💾).
5. Click **Deploy → New deployment**.
   - Click the gear ⚙️ next to *Select type* → choose **Web app**.
   - **Description:** anything, e.g. "FIRE registration".
   - **Execute as:** **Me** (your account).
   - **Who has access:** **Anyone**  ← *important, so the public form can post to it.*
   - Click **Deploy**.
6. **Authorize** when prompted (choose your Google account → *Advanced* → *Go to project (unsafe)* → *Allow*). This is normal for your own script.
7. Copy the **Web app URL** — it ends in `/exec`. You'll paste it into the website next.

> The `Registrations` tab and its column headers are created automatically the first time a team registers (or the first time you load the GET URL).

### If you change `apps-script.gs` later
Re-deploy so the live URL uses the new code: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** (This keeps the same `/exec` URL.)

---

## 2. Point the website at your script

Open `index.html` and edit the **`CONFIG`** block near the bottom (inside `<script>`):

```js
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec", // paste your /exec URL
  MOMO_NUMBER:       "024 123 4567",
  MOMO_NETWORK:      "MTN",
  MOMO_ACCOUNT_NAME: "Kwame Mensah",
  ORGANIZER_WHATSAPP: "233241234567", // full intl format, digits only, no +
  DEADLINE_DATE: "Sunday, December 6th",
  REGISTRATION_FEE: "GH₵200",
  REGISTRATION_CLOSED: false
};
```

**WhatsApp number format:** drop the leading `0`, add Ghana's code `233`.
`024 123 4567` → `233241234567`.

**Logo:** replace the placeholder in the header. Find:
```html
<div class="logo-slot" id="logoSlot">LOGO<br>HERE</div>
```
and swap it for your image (put `logo.png` next to `index.html`):
```html
<div class="logo-slot"><img src="logo.png" alt="FIRE logo"></div>
```

---

## 3. Host it (free)

### Option A — GitHub Pages
1. Create a GitHub repo and upload `index.html` (and `logo.png` if you have one).
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/root`, **Save**.
3. Your site goes live at `https://<username>.github.io/<repo>/` in a minute or two.

### Option B — Netlify (drag & drop)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the folder containing `index.html` onto the page. Done — you get a live URL instantly.

Then put that URL behind your **QR code** and share it in **WhatsApp**.

---

## 4. Verifying payments (your admin workflow)

No dashboard needed. Open the Google Sheet and:
1. For each new row, find the **Transaction ID** in your MoMo statement/SMS.
2. If it matches a real GH₵200 payment, change **Status** from `Pending` to `Verified`.
3. If not, set it to `Rejected` and add a note in the **Notes** column.

The script already blocks duplicate transaction IDs and assigns each team a code
(`FIRE-M-0001`, `FIRE-W-0001`, …) counting up separately per division.

---

## 5. Closing registration

Two independent switches (use either or both):
- **Website:** set `REGISTRATION_CLOSED: true` in `CONFIG` and re-upload `index.html`. The form is hidden and a "Registration Closed" message shows.
- **Server:** set `const REGISTRATION_CLOSED = true;` at the top of `apps-script.gs` and re-deploy. Any late POST is refused even if someone has the old page open.

---

## How it works (quick reference)

- **Submit flow:** validate inline → **"Check your details"** review step → POST JSON to the script → success screen with the registration code, summary, *Pending payment verification* status, a **Share on WhatsApp** button, and a screenshot reminder.
- **Duplicate txn ID:** the script returns `{ duplicate: true }` and the page shows *"This transaction ID has already been used. Contact the organizers on WhatsApp."*
- **Counter:** the header fetches `?action=count` and shows Men's / Women's / total teams.
- **No preflight/CORS headaches:** the page POSTs as `text/plain`, which keeps it a "simple" cross-origin request that Apps Script answers directly.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Counter shows `–` and submit fails | `SCRIPT_URL` is still the placeholder, or the deployment isn't **Anyone**-accessible. Re-check steps 1.5 and 1.7. |
| "Could not reach the server" | You edited the script but didn't **re-deploy a new version** (section 1). |
| Rows not appearing | Make sure you deployed the **web app** (not just saved) and authorized it. |
| Changed the script, nothing changed | Deploy → Manage deployments → Edit → **New version**. |
| Want to test locally | Just open `index.html` in a browser. (Set `SCRIPT_URL` first to actually submit.) |
