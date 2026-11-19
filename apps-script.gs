/*************************************************************************
 * FIRE 3x3 FIBA TOURNAMENT — Google Apps Script backend
 * -----------------------------------------------------------------------
 * Paste this into your Google Sheet:  Extensions > Apps Script
 * It saves one row per team, rejects duplicate transaction IDs, and
 * generates a sequential registration code per division
 * (FIRE-M-0001 for Men's, FIRE-W-0001 for Women's).
 *
 * Endpoints:
 *   POST  (JSON body)        -> register a team, returns { success, code }
 *   GET   ?action=count      -> returns team counts { men, women, total }
 *
 * See the README for step-by-step deployment instructions.
 *************************************************************************/

/* ======================= SETTINGS ======================= */
// Name of the sheet (tab) used to store registrations.
const SHEET_NAME = 'Registrations';

// Flip to true to refuse new registrations from the server side too.
// (The website also has its own REGISTRATION_CLOSED flag.)
const REGISTRATION_CLOSED = false;

// Column headers, created automatically on first run. Order matters.
const HEADERS = [
  'Timestamp', 'Registration Code', 'Team Name', 'Division',
  'Captain Name', 'Captain Phone', 'WhatsApp', 'Email',
  'Player 1 Name', 'Player 1 Phone', 'Player 1 Jersey',
  'Player 2 Name', 'Player 2 Phone', 'Player 2 Jersey',
  'Player 3 Name', 'Player 3 Phone', 'Player 3 Jersey',
  'Player 4 Name', 'Player 4 Phone', 'Player 4 Jersey',
  'Payer MoMo Number', 'Payer Name', 'Network', 'Transaction ID',
  'Payment Date', 'Status', 'Notes'
];

// Column index (1-based) of the Transaction ID and Division, used for
// duplicate checks and per-division counting. Keep in sync with HEADERS.
const COL_DIVISION = 4;
const COL_TXN_ID   = 24;


/* ======================= HELPERS ======================= */

// Return the registrations sheet, creating it (with headers) if missing.
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Ensure the header row exists.
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

// Standard JSON response with the right content type.
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Trim + stringify a value safely.
function clean_(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
}

// Normalise a transaction ID for comparison (trim + uppercase, strip spaces).
function normTxn_(v) {
  return clean_(v).toUpperCase().replace(/\s+/g, '');
}

// Count existing teams per division. Returns { men, women, total }.
function countTeams_(sheet) {
  const last = sheet.getLastRow();
  let men = 0, women = 0;
  if (last > 1) {
    const divisions = sheet.getRange(2, COL_DIVISION, last - 1, 1).getValues();
    divisions.forEach(function (r) {
      const d = clean_(r[0]).toLowerCase();
      if (d.indexOf('men') === 0 || d === "men's") men++;      // "Men's"
      else if (d.indexOf('women') === 0) women++;              // "Women's"
    });
  }
  return { men: men, women: women, total: men + women };
}

// Generate the next sequential code for a division, e.g. FIRE-M-0012.
function nextCode_(sheet, division) {
  const counts = countTeams_(sheet);
  // "Women's" -> W, anything else (Men's) -> M.
  const d = clean_(division).toLowerCase();
  const letter = (d.indexOf('women') === 0) ? 'W' : 'M';
  const nextNum = ((letter === 'M') ? counts.men : counts.women) + 1;
  const padded = ('0000' + nextNum).slice(-4);
  return 'FIRE-' + letter + '-' + padded;
}


/* ======================= POST = register a team ======================= */
function doPost(e) {
  // A lock prevents two simultaneous submissions from getting the same
  // registration code or both slipping a duplicate transaction ID through.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // wait up to 20s for other writes to finish
  } catch (err) {
    return jsonOut_({ success: false, error: 'Server busy, please try again.' });
  }

  try {
    if (REGISTRATION_CLOSED) {
      return jsonOut_({ success: false, closed: true, error: 'Registration is closed.' });
    }

    // Parse the incoming JSON body.
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonOut_({ success: false, error: 'Invalid data received.' });
    }

    // --- Basic server-side validation of required fields ---
    const required = ['teamName', 'division', 'captainName', 'captainPhone',
                      'payerPhone', 'payerName', 'network', 'txnId', 'payDate'];
    for (let i = 0; i < required.length; i++) {
      if (!clean_(data[required[i]])) {
        return jsonOut_({ success: false, error: 'Missing required field: ' + required[i] });
      }
    }

    const sheet = getSheet_();

    // --- Duplicate transaction ID check ---
    const incomingTxn = normTxn_(data.txnId);
    const last = sheet.getLastRow();
    if (last > 1) {
      const existing = sheet.getRange(2, COL_TXN_ID, last - 1, 1).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (normTxn_(existing[i][0]) === incomingTxn) {
          return jsonOut_({
            success: false,
            duplicate: true,
            error: 'This transaction ID has already been used.'
          });
        }
      }
    }

    // --- Generate the sequential registration code ---
    const code = nextCode_(sheet, data.division);

    // --- Build the row (must match HEADERS order) ---
    const players = Array.isArray(data.players) ? data.players : [];
    const p = function (i, key) {
      return (players[i] && players[i][key]) ? clean_(players[i][key]) : '';
    };

    const row = [
      new Date(),                        // Timestamp
      code,                              // Registration Code
      clean_(data.teamName),             // Team Name
      clean_(data.division),             // Division
      clean_(data.captainName),          // Captain Name
      clean_(data.captainPhone),         // Captain Phone
      clean_(data.whatsapp),             // WhatsApp
      clean_(data.email),                // Email
      p(0, 'name'), p(0, 'phone'), p(0, 'jersey'),   // Player 1
      p(1, 'name'), p(1, 'phone'), p(1, 'jersey'),   // Player 2
      p(2, 'name'), p(2, 'phone'), p(2, 'jersey'),   // Player 3
      p(3, 'name'), p(3, 'phone'), p(3, 'jersey'),   // Player 4
      clean_(data.payerPhone),           // Payer MoMo Number
      clean_(data.payerName),            // Payer Name
      clean_(data.network),              // Network
      clean_(data.txnId),                // Transaction ID
      clean_(data.payDate),              // Payment Date
      'Pending',                         // Status (default)
      ''                                 // Notes
    ];

    sheet.appendRow(row);

    return jsonOut_({ success: true, code: code });

  } catch (err) {
    return jsonOut_({ success: false, error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}


/* ======================= GET = team counter ======================= */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const sheet = getSheet_();

    if (action === 'count') {
      const counts = countTeams_(sheet);
      return jsonOut_({ success: true, men: counts.men, women: counts.women, total: counts.total });
    }

    // Default response (useful to confirm the web app is live).
    return jsonOut_({ success: true, message: 'FIRE 3x3 registration endpoint is running.' });

  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}
