// Web Push (RFC 8291, aes128gcm content encoding) + VAPID (RFC 8292)
// implemented purely on WebCrypto — runs on Cloudflare Workers and Node.js 20+.

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
  return new Uint8Array(Buffer.from(b, "base64"));
}

function bytesToB64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(arr)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    data as BufferSource,
  );
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
  const t = await hmacSha256(prk, concat(info, new Uint8Array([0x01])));
  return t.slice(0, length);
}

function buildVapidPrivateJwk(
  privateKeyRaw: Uint8Array,
  publicKeyRaw: Uint8Array,
) {
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
  const key = await globalThis.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(signingInput) as BufferSource,
  );
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

async function encryptPushPayload(
  plaintext: Uint8Array,
  uaPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array }> {
  const as = (await globalThis.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublicRaw = new Uint8Array(
    (await globalThis.crypto.subtle.exportKey("raw", as.publicKey)) as ArrayBuffer,
  );
  const uaPublicKey = await globalThis.crypto.subtle.importKey(
    "raw",
    uaPublicRaw as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const sharedBits = await globalThis.crypto.subtle.deriveBits(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: "ECDH", public: uaPublicKey } as any,
    as.privateKey,
    256,
  );
  const shared = new Uint8Array(sharedBits);

  const enc = new TextEncoder();
  const prkKey = await hkdfExtract(authSecret, shared);
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublicRaw,
    asPublicRaw,
  );
  const ikm = await hkdfExpandOne(prkKey, keyInfo, 32);

  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
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

  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 0x02;

  const aesKey = await globalThis.crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
    aesKey,
    padded as BufferSource,
  );
  const ciphertext = new Uint8Array(cipherBuf);

  const recordSize = ciphertext.length;
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, recordSize, false);
  const idlen = new Uint8Array([asPublicRaw.length]);

  const header = concat(salt, rs, idlen, asPublicRaw);
  const body = concat(header, ciphertext);
  return { body };
}

export async function sendWebPush(
  sub: PushSubscription,
  payload: string | Uint8Array,
  vapid: {
    publicKey: string;
    privateKey: string;
    subject: string;
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
      typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
    const { body } = await encryptPushPayload(plaintext, uaPublic, auth);

    const resp = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: body as unknown as BodyInit,
    });
    const gone = resp.status === 404 || resp.status === 410;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        gone,
        error: text.slice(0, 300),
      };
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
