/* Hygiène des liens affiliés : s'applique à toutes les pages qui chargent ce script. */
function cbPageSlug() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '-');
  return (path || 'home').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40).replace(/-+$/, '');
}

function cbRemoveDiscontinuedCards() {
  document.querySelectorAll('a.best-seller-card').forEach(card => {
    if (/privadovpn\.com|stickypassword\.com/.test(card.href)) card.remove();
  });
}

const CB_INTEGO_CLICK_URL = 'https://www.tkqlhce.com/click-101904907-15733644?sid=intego-antivirus';
const CB_AFFILIATE_RULES = [
  { host: 'click.linksynergy.com', test: u => u.searchParams.get('offerid') === '2065364.2', param: 'subid', stale: ['0'] },
  { host: 'grfpr.com', param: 'subid' },
  { host: 'ntzgd.com', param: 'subid' },
  { host: 'plrvq.com', param: 'subid' },
  { host: 'www.dpbolvw.net', param: 'sid', stale: ['comparatif-vpn'], keep: () => location.pathname === '/offres/vpn/' },
  { host: 'www.jdoqocy.com', test: u => /click-101904907-15554461$/.test(u.pathname), param: 'sid' },
  { host: 'bitdefender.f9tmep.net', param: 'subId1' },
  { host: 'wbbsv.com', param: 'subid' }
];

function cbPatchAffiliateLinks() {
  const slug = cbPageSlug();
  document.querySelectorAll('a[href^="http"]').forEach(a => {
    let url;
    try { url = new URL(a.href); } catch (e) { return; }

    if (url.hostname === 'www.intego.com' && url.pathname === '/fr/products/intego-one-mac' && url.searchParams.get('utm_source') === 'CJ') {
      a.href = CB_INTEGO_CLICK_URL;
      return;
    }

    const rule = CB_AFFILIATE_RULES.find(r => r.host === url.hostname && (!r.test || r.test(url)));
    if (!rule) return;
    const current = url.searchParams.get(rule.param);
    const missing = current === null || current === '';
    const stale = rule.stale && rule.stale.includes(current) && !(rule.keep && rule.keep());
    if (missing || stale) {
      url.searchParams.set(rule.param, slug);
      a.href = url.toString();
    }
    ['sponsored', 'noopener'].forEach(token => { if (!a.relList.contains(token)) a.relList.add(token); });
  });
}

cbRemoveDiscontinuedCards();
cbPatchAffiliateLinks();

const CB_PARTNER_CARDS = [
  {
    panel: 'panel-antivirus',
    url: 'https://bitdefender.f9tmep.net/c/7824654/827481/4466',
    param: '?subId1=',
    label: 'Antivirus',
    logo: '/assets/img/provider-logos/bitdefender.png',
    width: 190,
    height: 28,
    name: 'Bitdefender',
    feature: '-50 % sur les formules',
    features: [
      'Dès 25 € la première année (3 appareils)',
      'Jusqu’à 5 appareils · Windows, macOS, Android et iOS',
      'VPN illimité avec Premium Security'
    ]
  },
  {
    panel: 'panel-passwords',
    url: 'https://wbbsv.com/g/0m2otdnpmp7c685e2c99d35fce75bd/?ulp=https%3A%2F%2Fwww.lastpass.com%2Ffr%2Fproducts%2Fpremium-password-manager',
    param: '&subid=',
    label: 'Gestionnaire MDP',
    logo: '/assets/img/provider-logos/lastpass-logo.svg',
    width: 128,
    height: 44,
    name: 'LastPass',
    feature: 'Essai gratuit de 30 jours',
    features: [
      'Premium : 2,90 € par mois, facturé annuellement',
      'Families : 3,90 € par mois pour 6 comptes',
      'Formule Free sur un seul type d’appareil'
    ]
  }
];

const addPartnerCards = panel => {
  CB_PARTNER_CARDS.filter(cfg => cfg.panel === panel.id).forEach(cfg => {
    const grid = panel.querySelector('.best-sellers-grid');
    if (!grid || [...grid.querySelectorAll('.best-seller-card')].some(card => card.href.startsWith(cfg.url))) return;

    const card = document.createElement('a');
    card.href = cfg.url + cfg.param + cbPageSlug();
    card.target = '_blank';
    card.rel = 'sponsored noopener';
    card.className = 'best-seller-card';

    const header = document.createElement('div');
    header.className = 'seller-card-header';
    const label = document.createElement('span');
    label.className = 'product-label';
    label.textContent = cfg.label;
    const logo = document.createElement('img');
    logo.className = 'seller-card-brand-logo';
    logo.src = cfg.logo;
    logo.width = cfg.width;
    logo.height = cfg.height;
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.alt = cfg.name;
    header.append(label, logo);
    card.append(header);

    const feature = document.createElement('p');
    feature.className = 'seller-feature';
    feature.textContent = cfg.feature;
    card.append(feature);

    const features = document.createElement('ul');
    features.className = 'seller-features';
    cfg.features.forEach(text => {
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
  });
};

const CB_CARD_ORDER = { 'panel-antivirus': ['Bitdefender', 'Surfshark', 'Panda', 'Malwarebytes', 'Intego'] };

const sortPanelCards = panel => {
  const order = CB_CARD_ORDER[panel.id];
  const grid = panel.querySelector('.best-sellers-grid');
  if (!order || !grid) return;
  const rank = card => {
    const alt = (card.querySelector('img') || {}).alt || '';
    const index = order.findIndex(name => alt.startsWith(name));
    return index < 0 ? order.length : index;
  };
  [...grid.querySelectorAll('.best-seller-card')].sort((a, b) => rank(a) - rank(b)).forEach(card => grid.append(card));
};

document.querySelectorAll('.best-sellers-section').forEach(section => {
  const tabs = [...section.querySelectorAll('.home-category-tab')];
  const panels = [...section.querySelectorAll('.home-category-panel')];

  panels.forEach(panel => {
    addPartnerCards(panel);
    sortPanelCards(panel);
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
