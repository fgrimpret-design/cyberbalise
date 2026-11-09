const addBitdefenderCard = panel => {
  if (panel.id !== 'panel-antivirus') return;
  const grid = panel.querySelector('.best-sellers-grid');
  const affiliateUrl = 'https://bitdefender.f9tmep.net/c/7824654/827481/4466';
  if (!grid || [...grid.querySelectorAll('.best-seller-card')].some(card => card.href === affiliateUrl)) return;

  const card = document.createElement('a');
  card.href = affiliateUrl;
  card.target = '_blank';
  card.rel = 'sponsored noopener';
  card.className = 'best-seller-card';

  const header = document.createElement('div');
  header.className = 'seller-card-header';
  const label = document.createElement('span');
  label.className = 'product-label';
  label.textContent = 'Antivirus';
  const logo = document.createElement('img');
  logo.className = 'seller-card-brand-logo';
  logo.src = '/assets/img/provider-logos/bitdefender.png';
  logo.width = 190;
  logo.height = 28;
  logo.loading = 'lazy';
  logo.decoding = 'async';
  logo.alt = 'Bitdefender';
  header.append(label, logo);
  card.append(header);

  const feature = document.createElement('p');
  feature.className = 'seller-feature';
  feature.textContent = '-50 % sur les formules';
  card.append(feature);

  const features = document.createElement('ul');
  features.className = 'seller-features';
  [
    'Dès 25 € la première année (3 appareils)',
    'Jusqu’à 5 appareils · Windows, macOS, Android et iOS',
    'VPN illimité avec Premium Security'
  ].forEach(text => {
    const item = document.createElement('li');
    item.textContent = text;
    features.append(item);
  });
  card.append(features);

  const cta = document.createElement('span');
  cta.className = 'seller-card-cta';
  cta.textContent = 'En savoir plus →';
  card.append(cta);
  grid.append(card);
};

document.querySelectorAll('.best-sellers-section').forEach(section => {
  const tabs = [...section.querySelectorAll('.home-category-tab')];
  const panels = [...section.querySelectorAll('.home-category-panel')];

  panels.forEach(panel => {
    addBitdefenderCard(panel);
    const grid = panel.querySelector('.best-sellers-grid');
    const cards = [...panel.querySelectorAll('.best-seller-card')];
    if (!grid || cards.length <= 3) return;

    if (!grid.id) grid.id = `${panel.id}-results`;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'best-sellers-toggle';
    toggle.setAttribute('aria-controls', grid.id);

    const setExpanded = expanded => {
      cards.slice(3).forEach(card => { card.hidden = !expanded; });
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded
        ? 'R\u00e9duire la liste'
        : `Voir tous les r\u00e9sultats (${cards.length})`;
    };

    setExpanded(false);
    toggle.addEventListener('click', () => {
      setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });
    grid.after(toggle);
  });

  const selectCategory = (tab, focus = false) => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = panels.find(candidate => candidate.id === item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  };

  const requestedCategory = section.dataset.defaultCategory;
  const initialTab = tabs.find(tab => tab.id === `tab-${requestedCategory}`)
    || tabs.find(tab => tab.getAttribute('aria-selected') === 'true')
    || tabs[0];

  if (initialTab) {
    selectCategory(initialTab);
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectCategory(tab));
      tab.addEventListener('keydown', event => {
        let nextIndex;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        selectCategory(tabs[nextIndex], true);
      });
    });
  }

});
