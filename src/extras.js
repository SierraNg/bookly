  /* ---------- Phone app extras: backup, install prompt, Android back button, offline cache ---------- */
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var PLUG = (window.Capacitor && window.Capacitor.Plugins) || {};
  var STANDALONE = NATIVE || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var installEvt = null, installHidden = false;
  try { installHidden = localStorage.getItem("bookly-install-hidden") === "1"; } catch (e) {}
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; if (S.tab === "today") render(); });
  window.addEventListener("appinstalled", function () { installEvt = null; installHidden = true; render(); });

  function installBanner() {
    if (STANDALONE || installHidden || (!IOS && !installEvt)) return "";
    var how = IOS ? "In Safari, tap the Share button, then <b>Add to Home Screen</b>. Bookly then opens full screen and works offline." : "Install it to open Bookly from your home screen, full screen and offline.";
    var apk = "", gh = location.hostname.match(/^([^.]+)\.github\.io$/), repo = location.pathname.split("/")[1];
    if (/android/i.test(navigator.userAgent) && gh && repo) apk = '<a class="small" style="color:var(--soft);font-weight:600;text-align:center" href="https://github.com/' + gh[1] + "/" + repo + '/releases/latest/download/Bookly.apk">Or download the Android app (APK)</a>';
    return '<section class="glass" style="gap:10px;padding:14px 16px"><div class="row" style="align-items:flex-start"><img src="icons/icon-192.png" alt="" width="40" height="40" style="border-radius:10px"><div class="grow small" style="color:var(--fg-warm)"><b style="font-size:15px">Put Bookly on your home screen</b><br>' + how + '</div><button class="iconbtn" data-act="hideinstall" aria-label="Hide">' + ICON.close + "</button></div>" +
      (installEvt ? '<button class="btn-soft" data-act="install">Install Bookly</button>' : "") + apk + "</section>";
  }
  function backupPanel() {
    return '<section class="panel"><div class="row" style="gap:12px;flex-wrap:wrap"><span class="grow" style="display:flex;flex-direction:column;gap:2px;min-width:160px"><span class="small" style="font-weight:600">Backup</span><span class="small muted" style="font-size:12px">Your progress lives on this phone. Save a copy now and then.</span></span>' +
      '<span class="row" style="gap:8px"><button class="btn btn-outline" data-act="backup" style="min-height:44px">Save</button><button class="btn btn-outline" data-act="restore" style="min-height:44px">Restore</button></span></div></section>';
  }
  function backupData() { return { name: "bookly-backup-" + dayKey(Date.now()) + ".json", text: JSON.stringify({ app: "bookly", at: Date.now(), docs: S.db.dump() }) }; }
  function saveBackup() {
    if (!S.db) return;
    var b = backupData();
    if (NATIVE && PLUG.Filesystem && PLUG.Share) {
      return PLUG.Filesystem.writeFile({ path: b.name, data: b.text, directory: "CACHE", encoding: "utf8" })
        .then(function (r) { return PLUG.Share.share({ title: "Bookly backup", url: r.uri, dialogTitle: "Save your Bookly backup" }); })
        .catch(function (e) { if (!/cancel/i.test(String(e && e.message))) toast("Couldn't save the backup."); });
    }
    var file = null; try { file = new File([b.text], b.name, { type: "application/json" }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: "Bookly backup" }).catch(function () {});
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([b.text], { type: "application/json" })); a.download = b.name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast("Backup saved to your downloads");
  }
  function pickRestore() {
    var i = document.createElement("input"); i.type = "file"; i.accept = "application/json,.json";
    i.onchange = function () {
      var f = i.files && i.files[0]; if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t); if (!j || j.app !== "bookly" || !j.docs) throw 0;
        if (!confirm("Replace everything in Bookly with this backup from " + new Date(j.at).toLocaleDateString("en-GB") + "?")) return;
        return S.db.restore(j.docs).then(function () { toast("Backup restored"); });
      }).catch(function () { toast("That file isn't a Bookly backup"); });
    };
    i.click();
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var a = t.dataset.act;
    if (a === "backup") saveBackup();
    else if (a === "restore") pickRestore();
    else if (a === "install" && installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }); }
    else if (a === "hideinstall") { installHidden = true; try { localStorage.setItem("bookly-install-hidden", "1"); } catch (e) {} render(); }
  });
  if (NATIVE && PLUG.App) {
    PLUG.App.addListener("backButton", function () {
      if (document.getElementById("sheet")) return closeSheet();
      if (session) return closeSession();
      if (S.openBook) { S.openBook = null; return render(); }
      if (S.tab !== "today") { S.tab = "today"; render(); return window.scrollTo(0, 0); }
      PLUG.App.exitApp();
    });
  }
  if (!NATIVE && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

