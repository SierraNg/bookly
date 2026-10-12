  /* ---------- Sync from Google Sheet (public read link) ---------- */
  var SHEET_ID = "184d7Ct7ttcXYuN9w_sw7TshnArgNc3leu1PJYmCtrgg";
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, ch;
    for (; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(f); f = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += ch;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function readRange(tab, range) {
    var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab) + "&range=" + range + "&t=" + Date.now();
    return fetch(url, { cache: "no-store", credentials: "omit" }).then(function (r) {
      if (!r.ok) throw { code: r.status === 404 ? "not_found" : "private" };
      return r.text();
    }, function () { throw { code: navigator.onLine === false ? "offline" : "private" }; }).then(function (t) {
      if (/^\s*</.test(t)) throw { code: "private" };
      return parseCSV(t);
    });
  }
  function syncError(e) {
    var c = e && e.code;
    if (c === "offline") return "You're offline. Connect to the internet, then try again.";
    if (c === "not_found") return "Couldn't find the Sheet. Check it still exists.";
    if (c === "private") return "Bookly couldn't read your Sheet. In Google Sheets, tap Share, set General access to Anyone with the link (Viewer), then try again.";
    return "Couldn't reach Google Sheets. Try again in a moment.";
  }
