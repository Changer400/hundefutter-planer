// Web Push (RFC 8291, aes128gcm content encoding) + VAPID (RFC 8292) for Cloudflare Workers.
// Pure WebCrypto implementation, no external dependencies.

export type PushSubscription = {
  endpoint: string;
  p256dh: string; // base64url of 65-byte uncompressed P-256 public key
  auth: string; // base64url of 16-byte auth secret
};

export type WebPushResult = {
  ok: boolean;
  status: number;
  gone?: boolean; // 404/410 -> subscription should be removed
  error?: string;
};

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

async function hmacSha256(
  keyBytes: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data as BufferSource);
  return new Uint8Array(sig);
}

async function hkdfExtract(
  salt: Uint8Array,
  ikm: Uint8Array,
): Promise<Uint8Array> {
  return hmacSha256(salt, ikm);
}

async function hkdfExpandOne(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Assumes length <= 32 (single block of SHA-256 output).
  const t = await hmacSha256(prk, concat(info, new Uint8Array([0x01])));
  return t.slice(0, length);
}

function buildVapidPrivateJwk(
  privateKeyRaw: Uint8Array,
  publicKeyRaw: Uint8Array,
) {
  // publicKeyRaw is 65 bytes: 0x04 || X (32) || Y (32)
  if (publicKeyRaw.length !== 65 || publicKeyRaw[0] !== 0x04) {
    throw new Error("VAPID public key must be 65-byte uncompressed P-256");
  }
  return {
    kty: "EC",
    crv: "P-256",
    d: bytesToB64url(privateKeyRaw),
    x: bytesToB64url(publicKeyRaw.slice(1, 33)),
    y: bytesToB64url(publicKeyRaw.slice(33, 65)),
    ext: true,
  };
}

async function signVapidJwt(
  audience: string,
  subject: string,
  vapidPublic: Uint8Array,
  vapidPrivate: Uint8Array,
  ttlSeconds: number = 12 * 3600,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + ttlSeconds, sub: subject };
  const enc = new TextEncoder();
  const headerB = bytesToB64url(enc.encode(JSON.stringify(header)));
  const payloadB = bytesToB64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB}.${payloadB}`;
  const jwk = buildVapidPrivateJwk(vapidPrivate, vapidPublic);
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(signingInput) as BufferSource,
  );
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

async function encryptPushPayload(
  plaintext: Uint8Array,
  uaPublicRaw: Uint8Array, // 65 bytes
  authSecret: Uint8Array, // 16 bytes
): Promise<{ body: Uint8Array }> {
  // Generate ephemeral ECDH P-256 keypair
  const as = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", as.publicKey)) as ArrayBuffer,
  );
  // Import UA public key
  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublicRaw as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: "ECDH", public: uaPublicKey } as any,
    as.privateKey,
    256,
  );
  const shared = new Uint8Array(sharedBits);

  // RFC 8291:
  // PRK_key = HMAC-SHA256(auth_secret, shared)
  // IKM = HKDF-Expand(PRK_key, "WebPush: info\0" || ua_public || as_public || 0x01, 32)
  // salt: 16 random bytes
  // PRK = HMAC-SHA256(salt, IKM)
  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0" || 0x01, 16)
  // NONCE = HKDF-Expand(PRK, "Content-Encoding: nonce\0" || 0x01, 12)
  const enc = new TextEncoder();
  const prkKey = await hkdfExtract(authSecret, shared);
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublicRaw,
    asPublicRaw,
  );
  const ikm = await hkdfExpandOne(prkKey, keyInfo, 32);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpandOne(
    prk,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpandOne(
    prk,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );

  // Pad plaintext: plaintext || 0x02 (final record delimiter), no extra padding.
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 0x02;

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
    aesKey,
    padded as BufferSource,
  );
  const ciphertext = new Uint8Array(cipherBuf);

  // Record size: length of the single record (padded plaintext + 16-byte tag).
  // Minimum allowed by spec is 18; we set it to ciphertext.length to fit exactly.
  const recordSize = ciphertext.length;
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, recordSize, false);
  const idlen = new Uint8Array([asPublicRaw.length]);

  // Header: salt (16) || rs (4) || idlen (1) || keyid (asPublicRaw 65)
  const header = concat(salt, rs, idlen, asPublicRaw);
  const body = concat(header, ciphertext);
  return { body };
}

export async function sendWebPush(
  sub: PushSubscription,
  payload: string | Uint8Array,
  vapid: {
    publicKey: string; // base64url
    privateKey: string; // base64url
    subject: string; // "mailto:..." or "https://..."
  },
  ttlSeconds: number = 60,
): Promise<WebPushResult> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidPublic = b64urlToBytes(vapid.publicKey);
    const vapidPrivate = b64urlToBytes(vapid.privateKey);
    if (vapidPublic.length !== 65 || vapidPublic[0] !== 0x04) {
      return {
        ok: false,
        status: 0,
        error: "VAPID public key must be uncompressed P-256 (65 bytes).",
      };
    }
    const jwt = await signVapidJwt(
      audience,
      vapid.subject,
      vapidPublic,
      vapidPrivate,
      ttlSeconds < 3600 ? 12 * 3600 : ttlSeconds,
    );

    const uaPublic = b64urlToBytes(sub.p256dh);
    const auth = b64urlToBytes(sub.auth);
    const plaintext =
      typeof payload === "string"
        ? new TextEncoder().encode(payload)
        : payload;
    const { body } = await encryptPushPayload(plaintext, uaPublic, auth);

    const resp = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body,
    });
    const gone = resp.status === 404 || resp.status === 410;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, status: resp.status, gone, error: text.slice(0, 300) };
    }
    return { ok: true, status: resp.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
