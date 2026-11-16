/* Quiz « en 1 clic » et barre d'action mobile des landings de comparatifs (.lp) */
(function () {
  var buttons = document.querySelectorAll('.lp-q-options button');
  var result = document.getElementById('lp-q-result');
  var link = document.getElementById('lp-q-link');
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      buttons.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
      document.getElementById('lp-q-name').textContent = button.dataset.name;
      document.getElementById('lp-q-text').textContent = button.dataset.text;
      link.href = button.dataset.url;
      if (button.hasAttribute('data-internal')) {
        link.removeAttribute('target');
        link.rel = '';
        link.textContent = 'Lire la fiche →';
      } else {
        link.target = '_blank';
        link.rel = 'sponsored noopener';
        link.textContent = 'Voir l’offre →';
      }
      result.classList.add('show');
    });
  });

  var bar = document.getElementById('lp-sticky');
  var article = document.querySelector('article.page');
  if (!bar || !article) return;
  function sync() {
    bar.classList.toggle('on', window.scrollY > 600 && article.getBoundingClientRect().top > window.innerHeight * 0.6);
  }
  window.addEventListener('scroll', sync, { passive: true });
  sync();
})();
