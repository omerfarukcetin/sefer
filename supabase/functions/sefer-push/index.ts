// SEFER bildirim gönderici (Supabase Edge Function).
// Her dakika çalışır (pg_cron), sefer_push tablosundaki cihazlardan saati gelmiş bildirimleri gönderir.
// Gerekli gizli değer: SEFER_VAPID_PRIVATE (Edge Functions → Secrets). SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından hazır verilir.
// "Verify JWT" kapalı olmalı; işlev yalnızca zamanı gelmiş bildirimleri bir kez gönderdiği için fazladan çağrılması zararsızdır.
const VAPID_PUBLIC = "BHIZgXXhrdEgjFS9DfodHE-mAVaV1gT_daLvt827EpiszY8M4GkiopSDjjgaaB-5vPACGFM89gYd3QLqSlmCZag";
const SUBJECT = "https://omerfarukcetin.github.io/sefer/";

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
// RFC 8291 (aes128gcm) ile şifreli içerik
export async function encryptPayload(p256dh: string, auth: string, payload: string) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(enc.encode(payload), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}
let signKey: CryptoKey | null = null;
export async function vapidJWT(aud: string, priv: string) {
  if (!signKey) { const raw = unb64u(VAPID_PUBLIC);
    signKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: priv, x: b64u(raw.slice(1, 33)), y: b64u(raw.slice(33)), ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); }
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const b = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, enc.encode(h + "." + b)));
  return h + "." + b + "." + b64u(sig);
}
async function send(sub: any, data: unknown, priv: string) {
  const u = new URL(sub.endpoint);
  const body = await encryptPayload(sub.keys.p256dh, sub.keys.auth, JSON.stringify(data));
  return await fetch(sub.endpoint, { method: "POST", body, headers: {
    authorization: `vapid t=${await vapidJWT(u.origin, priv)}, k=${VAPID_PUBLIC}`,
    "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "3600", urgency: "normal" } });
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve(async () => {
  const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, PRIV = Deno.env.get("SEFER_VAPID_PRIVATE");
  if (!PRIV) return new Response("SEFER_VAPID_PRIVATE tanımlı değil", { status: 500 });
  const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
  const r = await fetch(`${URL_}/rest/v1/sefer_push?select=endpoint,sub,queue`, { headers: H });
  if (!r.ok) return new Response("Tablo okunamadı: " + await r.text(), { status: 500 });
  const rows = await r.json(), now = Date.now(); let sent = 0, gone = 0, fail = 0;
  for (const row of rows) {
    const q: any[] = Array.isArray(row.queue) ? row.queue : [];
    const due = q.filter(x => Date.parse(x.at) <= now && Date.parse(x.at) > now - 30 * 60e3);
    const keep = q.filter(x => Date.parse(x.at) > now);
    if (!due.length && keep.length === q.length) continue;
    let dead = false;
    for (const x of due) {
      try { const res = await send(row.sub, { title: x.title, body: x.body, tag: x.tag }, PRIV);
        if (res.status === 404 || res.status === 410) { dead = true; break; } if (res.ok) sent++; else { fail++; console.log(res.status, await res.text()); } }
      catch (e) { fail++; console.log(String(e)); }
    }
    const q2 = `${URL_}/rest/v1/sefer_push?endpoint=eq.${encodeURIComponent(row.endpoint)}`;
    if (dead) { gone++; await fetch(q2, { method: "DELETE", headers: H }); }
    else await fetch(q2, { method: "PATCH", headers: H, body: JSON.stringify({ queue: keep }) });
  }
  return new Response(JSON.stringify({ sent, gone, fail, devices: rows.length }), { headers: { "content-type": "application/json" } });
});
