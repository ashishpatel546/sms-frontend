/**
 * Device identity via Web Crypto API + IndexedDB.
 *
 * Generates a non-extractable ECDSA P-256 key pair once per browser profile and
 * persists it in IndexedDB. The private key never leaves the browser; only the
 * SPKI-encoded public key (base64) is sent to the server.
 *
 * Flow:
 *  1. getOrCreateDeviceKeyPair() — returns { publicKeySpki, privateKey }
 *  2. Send publicKeySpki to register-options — server checks for cross-user conflicts.
 *  3. Sign the WebAuthn challenge with signChallenge() — proves key ownership.
 *  4. Send publicKeySpki + deviceSignature to register-verify — server verifies & stores.
 *
 * If a user deliberately clears IndexedDB, they lose their device identity and
 * must obtain a new HR registration permit (physical visit to HR).
 */

const DB_NAME = 'sms_device_crypto';
const STORE_NAME = 'device_keys';
const KEY_ID = 'primary';

interface DeviceKeyRecord {
  id: string;
  publicKeySpki: string; // base64-encoded SubjectPublicKeyInfo
  privateKey: CryptoKey; // non-extractable — stored by the browser's key store
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(
  db: IDBDatabase,
  id: string,
): Promise<DeviceKeyRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as DeviceKeyRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, record: DeviceKeyRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Returns the existing device key pair from IndexedDB, or generates a new one
 * (non-extractable ECDSA P-256) and persists it if none exists.
 */
export async function getOrCreateDeviceKeyPair(): Promise<{
  publicKeySpki: string;
  privateKey: CryptoKey;
}> {
  const db = await openDB();
  const existing = await idbGet(db, KEY_ID);
  if (existing) {
    return {
      publicKeySpki: existing.publicKeySpki,
      privateKey: existing.privateKey,
    };
  }

  // Generate a new non-extractable ECDSA P-256 key pair.
  // extractable: false means the private key bytes can never be read back —
  // it can only be used to sign, and only from within this browser context.
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // private key is non-extractable
    ['sign', 'verify'],
  );

  // Export the public key as SPKI (SubjectPublicKeyInfo, DER-encoded).
  // This is a deterministic binary format — same key always produces the same bytes.
  const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeySpki = btoa(
    String.fromCharCode(...new Uint8Array(spkiBuffer)),
  );

  await idbPut(db, {
    id: KEY_ID,
    publicKeySpki,
    privateKey: keyPair.privateKey,
  });

  return { publicKeySpki, privateKey: keyPair.privateKey };
}

/**
 * Returns only the public key (SPKI base64) without modifying anything.
 * Returns null if no key pair exists in IndexedDB yet.
 */
export async function getDevicePublicKey(): Promise<string | null> {
  const db = await openDB();
  const record = await idbGet(db, KEY_ID);
  return record?.publicKeySpki ?? null;
}

/**
 * Signs an arbitrary string (e.g. the WebAuthn registration challenge) using the
 * device's ECDSA private key. Returns the signature as a base64 string.
 *
 * The same string is sent to the server and verified with the stored public key.
 * This proves the client possesses the private key at registration time.
 */
export async function signChallenge(
  challenge: string,
  privateKey: CryptoKey,
): Promise<string> {
  const data = new TextEncoder().encode(challenge);
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    data,
  );
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
}

/**
 * Deletes the device key pair from IndexedDB.
 * Called when the user deliberately removes their registered device so the local
 * identity is wiped and cannot be mistakenly reused after re-registration.
 */
export async function clearDeviceKeyPair(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
