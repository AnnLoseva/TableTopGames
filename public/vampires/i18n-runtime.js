// Shared language runtime for the legacy character-sheet app. Must load after
// i18n-dictionary.js and before vtm-health.js/main.js/creation-wizard.js, so
// window.VTM_LANG and window.t exist before any string-producing code runs.
(function () {
  var STORAGE_KEY = 'vtm-lang';

  function readLang() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === 'en' || stored === 'ru' ? stored : 'ru';
    } catch (err) {
      return 'ru';
    }
  }

  window.VTM_LANG = readLang();

  window.setVtmLang = function (lang) {
    if (lang !== 'en' && lang !== 'ru') return;
    window.VTM_LANG = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      /* ignore */
    }
    document.documentElement.lang = lang;
    applyDataI18n();
  };

  // Looks up `ru` in the dictionary when VTM_LANG is 'en'; otherwise returns it unchanged.
  // Falls back to the Russian source if the key is missing.
  window.t = function (ru) {
    if (window.VTM_LANG !== 'en' || ru == null) return ru;
    var dict = window.VTM_I18N || {};
    var key = String(ru).trim();
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : ru;
  };

  // Same as t(), but substitutes {placeholder} tokens after translation.
  window.tf = function (ru, vars) {
    var translated = window.t(ru);
    if (!vars) return translated;
    return Object.keys(vars).reduce(function (acc, key) {
      return acc.split('{' + key + '}').join(String(vars[key]));
    }, translated);
  };

  var ATTR_MAP = {
    'data-i18n': 'textContent',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-title': 'title',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-value': 'value',
    'data-i18n-tooltip': 'data-tooltip',
    'data-i18n-alt': 'alt',
  };

  function applyDataI18n() {
    Object.keys(ATTR_MAP).forEach(function (attr) {
      var prop = ATTR_MAP[attr];
      var nodes = document.querySelectorAll('[' + attr + ']');
      nodes.forEach(function (el) {
        var source = el.getAttribute(attr) || el.textContent;
        var translated = window.t(source);
        if (prop === 'textContent') {
          el.textContent = translated;
        } else if (prop === 'aria-label' || prop === 'data-tooltip') {
          el.setAttribute(prop, translated);
        } else {
          el[prop] = translated;
        }
      });
    });
  }

  window.applyVtmI18n = applyDataI18n;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDataI18n);
  } else {
    applyDataI18n();
  }
})();
