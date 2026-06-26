/*
 * whatsapp.js — WhatsApp number check via whatsapp-web.js (unofficial).
 * Tumhara WhatsApp ek baar QR se login hota hai (session save ho jaata hai).
 * System ka Chrome use karta hai (alag Chromium download nahi).
 *
 * ⚠️ Bulk/fast check pe ban ka risk. UI me 30s–3min random delay + 20 ka cap rakha hai.
 */
const fs = require('fs');
const path = require('path');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];
function findChrome() {
  return CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

module.exports = function createWhatsApp({ dataPath, emit }) {
  emit = emit || (() => {});
  let client = null;
  let state = 'disconnected';   // disconnected | starting | qr | authenticated | ready | error
  let qrDataUrl = null;
  let lastError = null;
  let loadingPct = null;
  let watchdog = null;
  let retried = false;

  function setState(s, extra) {
    state = s;
    emit(getStatus());
    if (extra) emit(Object.assign(getStatus(), extra));
  }
  function getStatus() {
    return { state, qr: qrDataUrl, error: lastError, chrome: !!findChrome(), loading: loadingPct };
  }
  let readyPoll = null;
  function clearWatchdog() { if (watchdog) { clearTimeout(watchdog); watchdog = null; } }
  function clearReadyPoll() { if (readyPoll) { clearInterval(readyPoll); readyPoll = null; } }
  function markReady() { clearWatchdog(); clearReadyPoll(); loadingPct = null; retried = false; setState('ready'); }

  // 'ready' event whatsapp-web.js me reliable nahi — isliye getState() poll karke
  // khud confirm karte hain ki client usable hai (CONNECTED = Store inject ho gaya).
  function beginReadyPoll() {
    if (readyPoll || state === 'ready') return;
    let tries = 0;
    readyPoll = setInterval(async () => {
      tries++;
      if (state === 'ready' || !client) { clearReadyPoll(); return; }
      try {
        const st = await client.getState();   // Store ready na ho to throw karega
        if (st === 'CONNECTED') { markReady(); return; }
      } catch (_) { /* abhi ready nahi, poll chalta rahe */ }
      if (tries >= 25) clearReadyPoll();       // ~100s; watchdog sambhal lega
    }, 4000);
  }

  // authenticated ke baad agar bahut der tak ready na ho, client restart karo (stuck-loading fix)
  function armWatchdog(ms) {
    clearWatchdog();
    watchdog = setTimeout(async () => {
      if (state === 'ready') return;
      if (retried) { clearReadyPoll(); lastError = 'WhatsApp ready nahi hua (sync atak gaya). Phone online hai? Dobara kholo ya Logout karke re-link karo.'; setState('error'); await destroy(); return; }
      retried = true;
      clearReadyPoll();
      try { if (client) await client.destroy(); } catch {}
      client = null;
      setState('starting');
      start();   // ek baar dobara
    }, ms);
  }
  async function destroy() {
    clearWatchdog(); clearReadyPoll();
    try { if (client) await client.destroy(); } catch {}
    client = null;
  }

  async function start() {
    if (client && (state === 'ready' || state === 'authenticated' || state === 'starting' || state === 'qr')) {
      return getStatus();
    }
    const chrome = findChrome();
    if (!chrome) {
      lastError = 'Chrome nahi mila. Google Chrome install karo phir try karo.';
      setState('error');
      return getStatus();
    }
    lastError = null;
    qrDataUrl = null;
    setState('starting');

    let WAWeb, QRCode;
    try {
      WAWeb = require('whatsapp-web.js');
      QRCode = require('qrcode');
    } catch (e) {
      lastError = 'whatsapp-web.js load nahi hua: ' + e.message;
      setState('error');
      return getStatus();
    }
    const { Client, LocalAuth } = WAWeb;

    fs.mkdirSync(dataPath, { recursive: true });
    client = new Client({
      authStrategy: new LocalAuth({ dataPath }),
      takeoverOnConflict: true,      // doosri linked-device session ho to takeover karo (hang na ho)
      takeoverTimeoutMs: 10000,
      puppeteer: {
        headless: true,
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    client.on('qr', async (qr) => {
      clearWatchdog(); clearReadyPoll();
      try { qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 }); }
      catch { qrDataUrl = null; }
      setState('qr');
    });
    client.on('loading_screen', (percent) => {
      loadingPct = Number(percent) || null;
      if (state !== 'ready') setState('authenticated');
      beginReadyPoll();                              // sync chal raha hai → ready check shuru
    });
    client.on('authenticated', () => { qrDataUrl = null; setState('authenticated'); armWatchdog(70000); beginReadyPoll(); });
    client.on('ready', () => markReady());
    client.on('auth_failure', (m) => { clearWatchdog(); clearReadyPoll(); lastError = 'Auth fail: ' + m; setState('error'); });
    client.on('disconnected', (r) => { clearWatchdog(); clearReadyPoll(); lastError = 'Disconnected: ' + r; client = null; setState('disconnected'); });

    // session valid ho to 'authenticated' jaldi aata hai; warna QR. Agar dono na aaye, watchdog.
    armWatchdog(70000);
    client.initialize().catch((e) => {
      clearWatchdog();
      lastError = 'Start fail: ' + e.message;
      client = null;
      setState('error');
    });
    return getStatus();
  }

  // ek number check — { registered: true/false } ya { error }
  async function check(numberIntl) {
    if (!client || state !== 'ready') return { error: 'not_ready' };
    const num = String(numberIntl || '').replace(/\D/g, '');
    if (!num) return { error: 'no_number' };
    try {
      const id = await client.getNumberId(num); // null = WhatsApp nahi
      return { registered: !!id };
    } catch (e) {
      return { error: e.message || 'check_failed' };
    }
  }

  async function logout() {
    clearWatchdog(); retried = false; loadingPct = null;
    try { if (client) await client.logout(); } catch {}
    try { if (client) await client.destroy(); } catch {}
    client = null;
    qrDataUrl = null;
    lastError = null;
    setState('disconnected');
    return getStatus();
  }

  return { start, check, logout, getStatus, destroy };
};
