/* Bookly local database: an IndexedDB store with the same small API the app used in claude.ai
   (doc(path).set / delete / onSnapshot, collection(name).onSnapshot). Everything lives on the phone. */
(function () {
  "use strict";
  var DB_NAME = "bookly", STORE = "docs", SEED_KEY = "_local/seed";
  var mem = {}, colSubs = {}, docSubs = {}, pendingCols = {}, pendingDocs = {}, flushTimer = null, idb = null;

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function openIDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function readAll(db) {
    return new Promise(function (res, rej) {
      var out = {}, tx = db.transaction(STORE, "readonly"), req = tx.objectStore(STORE).openCursor();
      req.onsuccess = function () { var c = req.result; if (c) { out[c.key] = c.value; c.continue(); } };
      tx.oncomplete = function () { res(out); };
      tx.onerror = function () { rej(tx.error); };
    });
  }
  function writeMany(entries) {
    return new Promise(function (res, rej) {
      var tx = idb.transaction(STORE, "readwrite"), st = tx.objectStore(STORE);
      entries.forEach(function (e) { if (e[1] === undefined) st.delete(e[0]); else st.put(e[1], e[0]); });
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error || { code: "unavailable" }); };
      tx.onabort = function () { var e = tx.error; rej({ code: e && e.name === "QuotaExceededError" ? "quota_exceeded" : "unavailable" }); };
    });
  }
  function colOf(path) { return path.split("/")[0]; }
  function colSnap(col) {
    var pre = col + "/", docs = [];
    Object.keys(mem).forEach(function (p) { if (p.indexOf(pre) === 0) { var v = mem[p]; docs.push({ id: p.slice(pre.length), exists: true, data: function () { return clone(v); } }); } });
    return { docs: docs };
  }
  function docSnap(path) { var v = mem[path]; return { id: path.split("/").pop(), exists: v !== undefined, data: function () { return clone(v); } }; }
  function schedule(path) {
    pendingCols[colOf(path)] = 1; pendingDocs[path] = 1;
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  }
  function flush() {
    var cols = pendingCols, docs = pendingDocs; pendingCols = {}; pendingDocs = {}; flushTimer = null;
    Object.keys(cols).forEach(function (c) { (colSubs[c] || []).forEach(function (f) { f(colSnap(c)); }); });
    Object.keys(docs).forEach(function (p) { (docSubs[p] || []).forEach(function (f) { f(docSnap(p)); }); });
  }

  var api = {
    doc: function (path) {
      return {
        set: function (data) { mem[path] = clone(data); schedule(path); return writeMany([[path, mem[path]]]); },
        delete: function () { delete mem[path]; schedule(path); return writeMany([[path, undefined]]); },
        onSnapshot: function (fn) { (docSubs[path] = docSubs[path] || []).push(fn); setTimeout(function () { fn(docSnap(path)); }, 0); return function () {}; }
      };
    },
    collection: function (col) {
      return { onSnapshot: function (fn) { (colSubs[col] = colSubs[col] || []).push(fn); setTimeout(function () { fn(colSnap(col)); }, 0); return function () {}; } };
    },
    /* Every saved document, for backups. */
    dump: function () { var out = {}; Object.keys(mem).forEach(function (p) { if (p.indexOf("_local/") !== 0) out[p] = clone(mem[p]); }); return out; },
    /* Replace everything with a backup. */
    restore: function (docs) {
      var entries = [];
      Object.keys(mem).forEach(function (p) { if (p.indexOf("_local/") !== 0 && !(p in docs)) { entries.push([p, undefined]); delete mem[p]; schedule(p); } });
      Object.keys(docs).forEach(function (p) { if (!/^(books|cards|progress|meta)\/[^/]+$/.test(p)) return; mem[p] = clone(docs[p]); entries.push([p, mem[p]]); schedule(p); });
      return writeMany(entries);
    }
  };

  /* Seed the library on first launch. A newer bundled library only adds books and cards you don't have yet. */
  function seed(all) {
    return fetch("seed.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("seed"); return r.json(); }).then(function (s) {
      var have = all[SEED_KEY], first = !have, entries = [];
      if (have && have.version === s.version && have.resetId === s.resetId) return;
      /* A one-time fresh start: clears review progress and old trackers, keeps books, cards and your edits. */
      if (!first && s.resetId && have.resetId !== s.resetId) {
        Object.keys(all).forEach(function (p) { if (/^(progress|meta)\//.test(p)) { delete all[p]; entries.push([p, undefined]); } });
      }
      ["books", "cards", "progress", "meta"].forEach(function (col) {
        if (!first && (col === "progress" || col === "meta")) return;
        Object.keys(s[col] || {}).forEach(function (id) { var p = col + "/" + id; if (first || !(p in all)) { all[p] = s[col][id]; entries.push([p, s[col][id]]); } });
      });
      entries.push([SEED_KEY, { version: s.version, resetId: s.resetId || null, at: Date.now() }]);
      return writeMany(entries);
    }).catch(function () { if (!Object.keys(all).length) throw new Error("no library"); });
  }

  window.BooklyDB = openIDB().then(function (db) { idb = db; return readAll(db); }).then(function (all) {
    return seed(all).then(function () { Object.keys(all).forEach(function (k) { if (k.indexOf("_local/") !== 0) mem[k] = all[k]; }); return api; });
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
})();
