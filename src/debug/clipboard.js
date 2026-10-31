/*
 * VR.clipboard: copy text from a click handler, working from file:// in Chrome and Firefox.
 *
 *   VR.clipboard.copy(text) -> Promise<boolean>   true when the text reached the clipboard
 *
 * Tries the async Clipboard API first, then the legacy execCommand('copy') on a hidden textarea (needed
 * when the page is not treated as a secure context). Callers should still show the text so it can be
 * copied by hand if both fail.
 */
(function (VR) {
  'use strict';

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  VR.clipboard = {
    copy: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(
          function () { return true; },
          function () { return legacyCopy(text); });
      }
      return Promise.resolve(legacyCopy(text));
    }
  };
})(window.VR = window.VR || {});
