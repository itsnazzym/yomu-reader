/** Inline HTML for Cloudflare Turnstile or hCaptcha inside WebView (Android / iOS). */

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function buildCaptchaHtml(siteKey: string, providerRaw: string): string {
  const key = escapeAttr(siteKey);
  const p = (providerRaw || "").toLowerCase();
  const bridge = `
    function send(token){
      try {
        var msg = JSON.stringify({ type: 'nh-captcha', token: token || '' });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
        if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'nh-captcha', token: token || '' }, '*');
      } catch(e) {}
    }
    function sendError(err){
      try {
        var msg = JSON.stringify({ type: 'nh-captcha-error', error: String(err || '') });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      } catch(e) {}
    }
    function sendReady(){
      try {
        var msg = JSON.stringify({ type: 'nh-captcha-ready' });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      } catch(e) {}
    }
  `;

  if (p.includes("hcaptcha")) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }
  .captcha-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 75px;
  }
  #hc-root, .h-captcha {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 300px;
    min-height: 75px;
  }
</style>
<script>${bridge}
window.onHcaptchaSuccess = function(t){ send(t); };
window.onHcaptchaError = function(e){ sendError(e); send(''); };
window.onHcaptchaExpired = function(){ send(''); };
window.onloadHcaptchaCallback = function(){
  sendReady();
  try {
    var root = document.getElementById('hc-root');
    if (window.hcaptcha && typeof window.hcaptcha.render === 'function' && root && !root.hasChildNodes()) {
      window.hcaptcha.render(root, {
        sitekey: '${key}',
        theme: 'dark',
        size: 'normal',
        callback: window.onHcaptchaSuccess,
        'expired-callback': window.onHcaptchaExpired,
        'error-callback': window.onHcaptchaError
      });
    }
  } catch(e){}
};
</script>
<script src="https://js.hcaptcha.com/1/api.js?onload=onloadHcaptchaCallback&render=explicit" async defer></script>
</head><body>
<div class="captcha-wrapper">
  <div id="hc-root" class="h-captcha" data-sitekey="${key}" data-theme="dark" data-size="normal" data-callback="onHcaptchaSuccess" data-error-callback="onHcaptchaError" data-expired-callback="onHcaptchaExpired"></div>
</div>
</body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }
  .captcha-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 70px;
  }
  #cf-root, .cf-turnstile {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 300px;
    min-height: 65px;
  }
</style>
<script>${bridge}
window.onTurnstileSuccess = function(t){ send(t); };
window.onTurnstileError = function(e){ sendError(e); send(''); };
window.onTurnstileExpired = function(){ send(''); };
window.onloadTurnstileCallback = function(){
  sendReady();
  try {
    var root = document.getElementById('cf-root');
    if (window.turnstile && typeof window.turnstile.render === 'function' && root && !root.hasChildNodes()) {
      window.turnstile.render(root, {
        sitekey: '${key}',
        theme: 'dark',
        size: 'normal',
        callback: window.onTurnstileSuccess,
        'expired-callback': window.onTurnstileExpired,
        'error-callback': window.onTurnstileError
      });
    }
  } catch(e){}
};
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback" async defer></script>
</head><body>
<div class="captcha-wrapper">
  <div id="cf-root" class="cf-turnstile" data-sitekey="${key}" data-theme="dark" data-size="normal" data-callback="onTurnstileSuccess" data-error-callback="onTurnstileError" data-expired-callback="onTurnstileExpired"></div>
</div>
</body></html>`;
}
