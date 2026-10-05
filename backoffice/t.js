/* CyberBalise — mesure d'audience interne, sans cookie, sans service tiers. */
(function () {
  try {
    var d = document, w = window, n = navigator, s = d.currentScript;
    if (!s || w.__crT) return; w.__crT = 1;
    if (s.getAttribute('data-dnt') === '1' && (n.doNotTrack === '1' || w.doNotTrack === '1')) return;
    var ep = s.src.replace(/t\.js(\?.*)?$/, 'collect.php');
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var vis = 0, since = d.visibilityState === 'visible' ? Date.now() : 0;
    function send(o) {
      o.id = id; o.p = location.pathname;
      var b = JSON.stringify(o);
      if (n.sendBeacon) n.sendBeacon(ep, new Blob([b], { type: 'text/plain' }));
      else { var x = new XMLHttpRequest(); x.open('POST', ep, true); x.setRequestHeader('Content-Type', 'text/plain'); x.send(b); }
    }
    send({ t: 'pv', r: d.referrer, q: location.search, l: n.language || '', sw: screen.width, sh: screen.height });
    function tick() { if (since) { vis += Date.now() - since; since = 0; } }
    d.addEventListener('visibilitychange', function () {
      if (d.visibilityState === 'hidden') { tick(); send({ t: 'd', s: Math.round(vis / 1000) }); }
      else since = Date.now();
    });
    /* Événements automatiques : téléchargements et liens sortants. Manuel : data-cr-event="nom" */
    d.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a,[data-cr-event]') : null;
      if (!a) return;
      var ev = a.getAttribute('data-cr-event');
      if (ev) return send({ t: 'ev', n: ev, v: a.getAttribute('data-cr-value') || (a.textContent || '').trim().slice(0, 80) });
      var h = a.href || '';
      if (/\.(pdf|csv|zip|xlsx?|docx?)(\?|$)/i.test(h)) send({ t: 'ev', n: 'Téléchargement', v: h.split('/').pop().split('?')[0] });
      else if (a.host && a.host !== location.host && /^https?:/.test(h)) send({ t: 'ev', n: 'Lien sortant', v: a.host });
    }, true);
    w.crTrack = function (name, value) { send({ t: 'ev', n: String(name), v: String(value || '') }); };
  } catch (e) {}
})();
