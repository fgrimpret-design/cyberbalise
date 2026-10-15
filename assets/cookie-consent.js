(function () {
  'use strict';

  var storageKey = 'cyberbalise_cookie_consent_v1';
  var consentLifetime = 180 * 24 * 60 * 60 * 1000;
  var impactUrl = 'https://utt.impactcdn.com/P-A7968179-ba51-44bd-8582-e6f556d001341.js';
  var consent = readConsent();
  var banner = document.createElement('section');
  var analyticsToggle;
  var affiliateToggle;
  var status;
  var settings;

  banner.className = 'cb-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-labelledby', 'cb-cookie-title');
  banner.setAttribute('aria-describedby', 'cb-cookie-description');
  banner.setAttribute('aria-modal', 'false');
  banner.hidden = Boolean(consent);
  banner.innerHTML =
    '<h2 id="cb-cookie-title">Votre choix en matière de cookies</h2>' +
    '<p id="cb-cookie-description">Les outils de mesure d’audience et de suivi des liens affiliés restent désactivés sans votre accord. Vous pouvez tout accepter, tout refuser ou choisir séparément. ' +
    '<a href="/politique-de-confidentialite/#cookies">En savoir plus</a>.</p>' +
    '<div class="cb-cookie-actions">' +
      '<button type="button" class="cb-cookie-accept" data-cookie-action="accept">Tout accepter</button>' +
      '<button type="button" data-cookie-action="reject">Tout refuser</button>' +
      '<button type="button" data-cookie-action="customize" aria-expanded="false" aria-controls="cb-cookie-settings">Personnaliser</button>' +
    '</div>' +
    '<div class="cb-cookie-settings" id="cb-cookie-settings" hidden>' +
      '<label class="cb-cookie-required"><input type="checkbox" checked disabled> <span><strong>Choix nécessaires</strong><br>Enregistrement de vos préférences pour retenir votre décision.</span></label>' +
      '<label><input type="checkbox" data-cookie-toggle="analytics"> <span><strong>Mesure d’audience</strong><br>Outil interne de statistiques, activé uniquement avec votre accord.</span></label>' +
      '<label><input type="checkbox" data-cookie-toggle="affiliate"> <span><strong>Suivi des liens affiliés</strong><br>Script Impact pour transformer les liens partenaires et mesurer les impressions.</span></label>' +
      '<button type="button" data-cookie-action="save">Enregistrer mes choix</button>' +
    '</div>' +
    '<p class="cb-cookie-status" role="status" aria-live="polite" hidden></p>';

  banner.id = 'cb-cookie-banner';
  document.body.appendChild(banner);

  analyticsToggle = banner.querySelector('[data-cookie-toggle="analytics"]');
  affiliateToggle = banner.querySelector('[data-cookie-toggle="affiliate"]');
  status = banner.querySelector('.cb-cookie-status');
  settings = banner.querySelector('.cb-cookie-settings');

  if (consent) {
    analyticsToggle.checked = consent.analytics;
    affiliateToggle.checked = consent.affiliate;
    applyConsent(consent);
  }

  banner.addEventListener('click', function (event) {
    var button = event.target.closest('[data-cookie-action]');
    if (!button) return;

    var action = button.getAttribute('data-cookie-action');
    if (action === 'accept') saveConsent(true, true);
    if (action === 'reject') saveConsent(false, false);
    if (action === 'customize') {
      settings.hidden = !settings.hidden;
      button.setAttribute('aria-expanded', String(!settings.hidden));
      if (!settings.hidden) analyticsToggle.focus();
    }
    if (action === 'save') saveConsent(analyticsToggle.checked, affiliateToggle.checked);
  });

  var policySettingsButton = document.querySelector('[data-cookie-open-settings]');
  if (policySettingsButton) {
    policySettingsButton.addEventListener('click', function () {
      banner.hidden = false;
      settings.hidden = false;
      analyticsToggle.checked = Boolean(consent && consent.analytics);
      affiliateToggle.checked = Boolean(consent && consent.affiliate);
      banner.querySelector('[data-cookie-action="customize"]').setAttribute('aria-expanded', 'true');
      analyticsToggle.focus();
    });
  }

  function readConsent() {
    var raw;
    var saved;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch (error) {
      console.error('CyberBalise: impossible de lire le choix cookies enregistré.', error);
      return null;
    }

    if (!raw) return null;
    try {
      saved = JSON.parse(raw);
    } catch (error) {
      console.error('CyberBalise: le choix cookies enregistré est illisible.', error);
      return null;
    }

    if (!saved || saved.version !== 1 ||
        typeof saved.analytics !== 'boolean' ||
        typeof saved.affiliate !== 'boolean' ||
        typeof saved.expiresAt !== 'number' ||
        saved.expiresAt <= Date.now()) return null;

    return saved;
  }

  function saveConsent(analytics, affiliate) {
    var previous = consent;
    var next = {
      version: 1,
      analytics: analytics,
      affiliate: affiliate,
      expiresAt: Date.now() + consentLifetime
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.error('CyberBalise: impossible d’enregistrer le choix cookies.', error);
      status.textContent = consent
        ? 'Votre choix n’a pas pu être enregistré ; les préférences déjà enregistrées restent appliquées.'
        : 'Votre choix n’a pas pu être enregistré ; aucun outil de suivi facultatif ne sera activé.';
      status.hidden = false;
      return;
    }

    consent = next;
    status.hidden = true;
    banner.hidden = true;

    if (previous && (previous.analytics !== next.analytics || previous.affiliate !== next.affiliate)) {
      window.location.reload();
      return;
    }
    applyConsent(next);
  }

  function applyConsent(saved) {
    if (saved.analytics && !document.querySelector('[data-cb-consent="analytics"]')) {
      var analyticsScript = document.createElement('script');
      analyticsScript.src = '/backoffice/t.js';
      analyticsScript.setAttribute('data-cr-mesure', '');
      analyticsScript.setAttribute('data-dnt', '1');
      analyticsScript.setAttribute('data-cb-consent', 'analytics');
      analyticsScript.onerror = function () {
        console.error('CyberBalise: impossible de charger l’outil interne de mesure d’audience.');
      };
      document.body.appendChild(analyticsScript);
    }

    if (saved.affiliate && !document.querySelector('[data-cb-consent="affiliate"]')) {
      var impactScript = document.createElement('script');
      window.ire_o = 'impactStat';
      window.impactStat = window.impactStat || function () {
        (window.impactStat.a = window.impactStat.a || []).push(arguments);
      };
      impactScript.async = true;
      impactScript.src = impactUrl;
      impactScript.setAttribute('data-cb-consent', 'affiliate');
      impactScript.onerror = function () {
        console.error('CyberBalise: impossible de charger le suivi d’affiliation Impact.');
      };
      document.head.appendChild(impactScript);
      window.impactStat('transformLinks');
      window.impactStat('trackImpression');
    }
  }
})();
