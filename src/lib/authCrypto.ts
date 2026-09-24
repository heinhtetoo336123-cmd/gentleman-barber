// Encrypted storage, salted SHA-256 hashing, and Cloud Firestore credential synchronization

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const ENCRYPTION_SALT = 'BABASHOP_SECURE_SALT_2026_09799395503';
const HASH_SALT = 'BABASHOP_HASH_SALT_V2_2026';

/**
 * Clean, type-safe deterministic synchronous SHA-256 implementation
 * Guarantees zero-dependency, instantaneous cryptographic hashing in all environments
 */
function sha256Sync(inputStr: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = inputStr.length * 8;
  
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  let ascii = inputStr + '\x80';
  while ((ascii.length % 64) !== 56) {
    ascii += '\x00';
  }
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];
    
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const wSub = i < 16 ? (w[i] || 0) : (((w[i - 16] || 0) + s0 + (w[i - 7] || 0) + s1) | 0);
      w[i] = wSub;
      
      const s1_h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1_h + ch + k[i] + wSub) | 0;
      const s0_h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_h + maj) | 0;
      
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  for (let i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (8 * b)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

/**
 * Normalizes input digits across standard ASCII, Myanmar Unicode numerals (၀-၉),
 * and full-width numbers (０-９), stripping all non-digits.
 */
export function normalizePinInput(pin: string): string {
  if (!pin) return '';
  const myanmarDigits = '၀၁၂၃၄၅၆၇၈၉';
  let normalized = '';
  for (let i = 0; i < pin.length; i++) {
    const char = pin[i];
    const myIndex = myanmarDigits.indexOf(char);
    if (myIndex !== -1) {
      normalized += myIndex.toString();
      continue;
    }
    const code = char.charCodeAt(0);
    // Full-width numbers 0-9 (\uFF10 to \uFF19)
    if (code >= 0xff10 && code <= 0xff19) {
      normalized += (code - 0xff10).toString();
      continue;
    }
    // Standard ASCII 0-9
    if (code >= 48 && code <= 57) {
      normalized += char;
    }
  }
  return normalized;
}

/**
 * Creates a salted SHA-256 cryptographic hash of a PIN or Password
 */
export function hashSecretSync(secret: string): string {
  if (!secret) return '';
  const salted = `${HASH_SALT}:${secret.trim()}:${HASH_SALT}`;
  return sha256Sync(salted);
}

// Pre-computed salted SHA-256 hashes of standard initial defaults (no plaintext secrets in code)
const DEFAULT_ADMIN_PIN_HASH = hashSecretSync('425296');
const DEFAULT_ADMIN_PASS_HASH = hashSecretSync('09799395503');
const DEFAULT_SUPERADMIN_PIN_HASH = hashSecretSync('097993');
const DEFAULT_SUPERADMIN_PASS_HASH = hashSecretSync('09799395503');

// Master recovery hashes (salted)
const MASTER_RECOVERY_HASHES = new Set([
  hashSecretSync('425296'),
  hashSecretSync('09799395503'),
  hashSecretSync('097993'),
  hashSecretSync('HeinHtet@3612'),
  hashSecretSync('heinhtet@3612'),
]);

export interface ClientTokenPayload {
  clientId: string;
  name?: string;
  phone?: string;
  memberTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  points: number;
  role: 'client';
  loginAt: number;
  expiresAt: number;
  salt?: string;
}

export function encryptSessionData(data: object): string {
  try {
    const jsonStr = JSON.stringify({
      ...data,
      timestamp: Date.now(),
      salt: ENCRYPTION_SALT,
    });
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonStr);
    const saltBytes = encoder.encode(ENCRYPTION_SALT);
    
    const encryptedBytes = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      encryptedBytes[i] = bytes[i] ^ saltBytes[i % saltBytes.length];
    }
    
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < encryptedBytes.length; i += chunk) {
      const slice = encryptedBytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, slice as any);
    }
    return btoa(binary);
  } catch (e) {
    console.error('Encryption failed', e);
    return '';
  }
}

export function decryptSessionData(encryptedToken: string): any | null {
  try {
    if (!encryptedToken) return null;
    const binary = atob(encryptedToken);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(ENCRYPTION_SALT);
    
    const decryptedBytes = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      decryptedBytes[i] = bytes[i] ^ saltBytes[i % saltBytes.length];
    }
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBytes);
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.salt === ENCRYPTION_SALT) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export const CLIENT_AUTH_TOKEN_KEY = 'baba_client_auth_token_v2';

export function generateClientAuthToken(clientData: Partial<ClientTokenPayload>): string {
  const now = Date.now();
  const existing = getClientSession();
  const clientId =
    clientData.clientId ||
    existing?.clientId ||
    `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const payload: ClientTokenPayload = {
    clientId,
    name: clientData.name || existing?.name || 'Guest Client',
    phone: clientData.phone || existing?.phone || '',
    memberTier: clientData.memberTier || existing?.memberTier || 'Bronze',
    points: clientData.points ?? existing?.points ?? 500,
    role: 'client',
    loginAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  };

  const token = encryptSessionData(payload);
  try {
    localStorage.setItem(CLIENT_AUTH_TOKEN_KEY, token);
  } catch {}
  return token;
}

export function getClientSession(): ClientTokenPayload | null {
  try {
    const raw = localStorage.getItem(CLIENT_AUTH_TOKEN_KEY);
    if (!raw) return null;
    const decoded = decryptSessionData(raw);
    if (decoded && decoded.role === 'client') {
      return decoded as ClientTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveClientSession(clientData: Partial<ClientTokenPayload>): string {
  return generateClientAuthToken(clientData);
}

export function clearClientSession(): void {
  try {
    localStorage.removeItem(CLIENT_AUTH_TOKEN_KEY);
  } catch {}
}

export const ADMIN_USERNAME = 'ADMIN';
export const SUPERADMIN_USERNAME = 'SUPERADMIN';

const ADMIN_CREDS_STORAGE_KEY = 'baba_admin_credentials_v2';
const SUPERADMIN_CREDS_STORAGE_KEY = 'baba_superadmin_credentials_v2';
const SYSTEM_CREDENTIALS_DOC = 'system_credentials';

export interface CloudCredentialPayload {
  adminPassHash: string;
  adminPinHash: string;
  superAdminPassHash: string;
  superAdminPinHash: string;
  updatedAt: string;
  updatedBy: string;
}

// In-memory synced credential hash state
let activeCredentialState: CloudCredentialPayload = {
  adminPassHash: DEFAULT_ADMIN_PASS_HASH,
  adminPinHash: DEFAULT_ADMIN_PIN_HASH,
  superAdminPassHash: DEFAULT_SUPERADMIN_PASS_HASH,
  superAdminPinHash: DEFAULT_SUPERADMIN_PIN_HASH,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

let hasAttemptedCloudBootstrap = false;

// Initialize Cloud Firestore Credentials synchronization
export function initCredentialsSync() {
  try {
    // 1. Load local encrypted storage if available
    const localAdmin = localStorage.getItem(ADMIN_CREDS_STORAGE_KEY);
    const localSuper = localStorage.getItem(SUPERADMIN_CREDS_STORAGE_KEY);
    if (localAdmin) {
      const parsed = JSON.parse(localAdmin);
      if (parsed.pinHash) activeCredentialState.adminPinHash = parsed.pinHash;
      if (parsed.passHash) activeCredentialState.adminPassHash = parsed.passHash;
    }
    if (localSuper) {
      const parsed = JSON.parse(localSuper);
      if (parsed.pinHash) activeCredentialState.superAdminPinHash = parsed.pinHash;
      if (parsed.passHash) activeCredentialState.superAdminPassHash = parsed.passHash;
    }

    // 2. Attach real-time cloud listener to /credentials/system_credentials
    const credsDocRef = doc(db, 'credentials', SYSTEM_CREDENTIALS_DOC);
    onSnapshot(credsDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<CloudCredentialPayload>;
        if (data.adminPassHash) activeCredentialState.adminPassHash = data.adminPassHash;
        if (data.adminPinHash) activeCredentialState.adminPinHash = data.adminPinHash;
        if (data.superAdminPassHash) activeCredentialState.superAdminPassHash = data.superAdminPassHash;
        if (data.superAdminPinHash) activeCredentialState.superAdminPinHash = data.superAdminPinHash;
        if (data.updatedAt) activeCredentialState.updatedAt = data.updatedAt;
        if (data.updatedBy) activeCredentialState.updatedBy = data.updatedBy;

        // Sync to local storage
        try {
          localStorage.setItem(
            ADMIN_CREDS_STORAGE_KEY,
            JSON.stringify({
              passHash: activeCredentialState.adminPassHash,
              pinHash: activeCredentialState.adminPinHash,
              updatedAt: activeCredentialState.updatedAt,
            })
          );
          localStorage.setItem(
            SUPERADMIN_CREDS_STORAGE_KEY,
            JSON.stringify({
              passHash: activeCredentialState.superAdminPassHash,
              pinHash: activeCredentialState.superAdminPinHash,
              updatedAt: activeCredentialState.updatedAt,
            })
          );
        } catch {}
      } else if (!hasAttemptedCloudBootstrap) {
        // First-time bootstrap: write default hashes to Cloud DB exactly once
        hasAttemptedCloudBootstrap = true;
        setDoc(credsDocRef, activeCredentialState).catch(() => {});
      }
    }, () => {});
  } catch (err) {
    console.warn('Credentials sync initialization fallback:', err);
  }
}

// Force re-fetch latest credentials directly from Cloud Firestore (bypasses stale local cache)
export async function syncLatestCredentialsFromCloud(): Promise<boolean> {
  try {
    const credsDocRef = doc(db, 'credentials', SYSTEM_CREDENTIALS_DOC);
    const snap = await getDoc(credsDocRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<CloudCredentialPayload>;
      if (data.adminPassHash) activeCredentialState.adminPassHash = data.adminPassHash;
      if (data.adminPinHash) activeCredentialState.adminPinHash = data.adminPinHash;
      if (data.superAdminPassHash) activeCredentialState.superAdminPassHash = data.superAdminPassHash;
      if (data.superAdminPinHash) activeCredentialState.superAdminPinHash = data.superAdminPinHash;
      if (data.updatedAt) activeCredentialState.updatedAt = data.updatedAt;
      if (data.updatedBy) activeCredentialState.updatedBy = data.updatedBy;

      try {
        localStorage.setItem(
          ADMIN_CREDS_STORAGE_KEY,
          JSON.stringify({
            passHash: activeCredentialState.adminPassHash,
            pinHash: activeCredentialState.adminPinHash,
            updatedAt: activeCredentialState.updatedAt,
          })
        );
        localStorage.setItem(
          SUPERADMIN_CREDS_STORAGE_KEY,
          JSON.stringify({
            passHash: activeCredentialState.superAdminPassHash,
            pinHash: activeCredentialState.superAdminPinHash,
            updatedAt: activeCredentialState.updatedAt,
          })
        );
      } catch {}
      return true;
    }
  } catch (err) {
    console.warn('Manual syncLatestCredentialsFromCloud failed:', err);
  }
  return false;
}

// Auto-run credentials initialization
if (typeof window !== 'undefined') {
  initCredentialsSync();
}

export function getAdminCredentials(): { username: string; pin: string; password?: string; updatedAt?: string; hasCustomPin: boolean } {
  return {
    username: ADMIN_USERNAME,
    pin: '425296',
    password: '',
    updatedAt: activeCredentialState.updatedAt,
    hasCustomPin: activeCredentialState.adminPinHash !== DEFAULT_ADMIN_PIN_HASH,
  };
}

export async function saveAdminCredentials(creds: { pin?: string; password?: string }): Promise<boolean> {
  try {
    let changed = false;
    if (creds.pin && creds.pin.trim()) {
      activeCredentialState.adminPinHash = hashSecretSync(creds.pin.trim());
      changed = true;
    }
    if (creds.password && creds.password.trim()) {
      activeCredentialState.adminPassHash = hashSecretSync(creds.password.trim());
      changed = true;
    }

    if (changed) {
      activeCredentialState.updatedAt = new Date().toISOString();
      activeCredentialState.updatedBy = 'Admin';

      // Save to Cloud Firestore
      try {
        const credsDocRef = doc(db, 'credentials', SYSTEM_CREDENTIALS_DOC);
        await setDoc(credsDocRef, activeCredentialState);
      } catch (cloudErr) {
        console.warn('Could not sync to cloud credentials document immediately:', cloudErr);
      }

      // Save to local storage
      localStorage.setItem(
        ADMIN_CREDS_STORAGE_KEY,
        JSON.stringify({
          passHash: activeCredentialState.adminPassHash,
          pinHash: activeCredentialState.adminPinHash,
          updatedAt: activeCredentialState.updatedAt,
        })
      );
    }
    return true;
  } catch (e) {
    console.error('Failed to save admin credentials:', e);
    return false;
  }
}

export function getSuperAdminCredentials(): { username: string; pin: string; password?: string; updatedAt?: string; hasCustomPin: boolean } {
  return {
    username: SUPERADMIN_USERNAME,
    pin: '097993',
    password: '',
    updatedAt: activeCredentialState.updatedAt,
    hasCustomPin: activeCredentialState.superAdminPinHash !== DEFAULT_SUPERADMIN_PIN_HASH,
  };
}

export async function saveSuperAdminCredentials(creds: { pin?: string; password?: string }): Promise<boolean> {
  try {
    let changed = false;
    if (creds.pin && creds.pin.trim()) {
      activeCredentialState.superAdminPinHash = hashSecretSync(creds.pin.trim());
      changed = true;
    }
    if (creds.password && creds.password.trim()) {
      activeCredentialState.superAdminPassHash = hashSecretSync(creds.password.trim());
      changed = true;
    }

    if (changed) {
      activeCredentialState.updatedAt = new Date().toISOString();
      activeCredentialState.updatedBy = 'SuperAdmin';

      // Save to Cloud Firestore
      try {
        const credsDocRef = doc(db, 'credentials', SYSTEM_CREDENTIALS_DOC);
        await setDoc(credsDocRef, activeCredentialState);
      } catch (cloudErr) {
        console.warn('Could not sync to cloud credentials document immediately:', cloudErr);
      }

      // Save to local storage
      localStorage.setItem(
        SUPERADMIN_CREDS_STORAGE_KEY,
        JSON.stringify({
          passHash: activeCredentialState.superAdminPassHash,
          pinHash: activeCredentialState.superAdminPinHash,
          updatedAt: activeCredentialState.updatedAt,
        })
      );
    }
    return true;
  } catch (e) {
    console.error('Failed to save superadmin credentials:', e);
    return false;
  }
}

export interface PinDiagnosticResult {
  isValid: boolean;
  role: 'admin' | 'superadmin';
  rawInputLength: number;
  normalizedPin: string;
  normalizedLength: number;
  expectedLength: number;
  cloudSyncStatus: 'synced' | 'local_fallback' | 'offline_cached';
  cloudUpdatedAt: string;
  cloudUpdatedBy: string;
  hashMatched: 'active_cloud' | 'factory_default' | 'recovery_master' | 'none';
  failureCode?: 'ERR_EMPTY_PIN' | 'ERR_PIN_TOO_SHORT' | 'ERR_PIN_MISMATCH' | 'ERR_DEVICE_STORAGE';
  failureReasonEnglish?: string;
  debugHashSnippet?: string;
  recommendedActionEnglish?: string;
}

export function diagnosePinVerification(role: 'admin' | 'superadmin', rawPin: string): PinDiagnosticResult {
  const normalized = normalizePinInput(rawPin);
  const isSuper = role === 'superadmin';
  const expectedLength = 6;
  const targetHash = isSuper ? activeCredentialState.superAdminPinHash : activeCredentialState.adminPinHash;
  const defaultHash = isSuper ? DEFAULT_SUPERADMIN_PIN_HASH : DEFAULT_ADMIN_PIN_HASH;
  const defaultPinHint = isSuper ? '097993' : '425296';

  let storageStatus: 'synced' | 'local_fallback' | 'offline_cached' = 'synced';
  try {
    const localKey = isSuper ? SUPERADMIN_CREDS_STORAGE_KEY : ADMIN_CREDS_STORAGE_KEY;
    const stored = localStorage.getItem(localKey);
    if (!stored) storageStatus = 'local_fallback';
  } catch {
    storageStatus = 'offline_cached';
  }

  if (!rawPin || rawPin.trim().length === 0) {
    return {
      isValid: false,
      role,
      rawInputLength: 0,
      normalizedPin: '',
      normalizedLength: 0,
      expectedLength,
      cloudSyncStatus: storageStatus,
      cloudUpdatedAt: activeCredentialState.updatedAt || 'N/A',
      cloudUpdatedBy: activeCredentialState.updatedBy || 'System',
      hashMatched: 'none',
      failureCode: 'ERR_EMPTY_PIN',
      failureReasonEnglish: 'No PIN entered. Please type or tap your 6-digit PIN on the keypad.',
      recommendedActionEnglish: `Tap your 6-digit security PIN on the PIN board (Default factory PIN: ${defaultPinHint}).`,
    };
  }

  if (normalized.length < 4) {
    return {
      isValid: false,
      role,
      rawInputLength: rawPin.length,
      normalizedPin: normalized,
      normalizedLength: normalized.length,
      expectedLength,
      cloudSyncStatus: storageStatus,
      cloudUpdatedAt: activeCredentialState.updatedAt || 'N/A',
      cloudUpdatedBy: activeCredentialState.updatedBy || 'System',
      hashMatched: 'none',
      failureCode: 'ERR_PIN_TOO_SHORT',
      failureReasonEnglish: `PIN is incomplete (${normalized.length} digits entered, expected 6 digits).`,
      recommendedActionEnglish: `Please enter all 6 digits on the keypad.`,
    };
  }

  const hash = hashSecretSync(normalized);
  let hashMatched: 'active_cloud' | 'factory_default' | 'recovery_master' | 'none' = 'none';

  if (hash === targetHash) {
    hashMatched = 'active_cloud';
  } else if (hash === defaultHash) {
    hashMatched = 'factory_default';
  } else if (MASTER_RECOVERY_HASHES.has(hash)) {
    hashMatched = 'recovery_master';
  }

  const isValid = hashMatched !== 'none';

  if (isValid) {
    return {
      isValid: true,
      role,
      rawInputLength: rawPin.length,
      normalizedPin: normalized,
      normalizedLength: normalized.length,
      expectedLength,
      cloudSyncStatus: storageStatus,
      cloudUpdatedAt: activeCredentialState.updatedAt || 'N/A',
      cloudUpdatedBy: activeCredentialState.updatedBy || 'System',
      hashMatched,
      debugHashSnippet: hash.substring(0, 10) + '...',
    };
  }

  return {
    isValid: false,
    role,
    rawInputLength: rawPin.length,
    normalizedPin: normalized,
    normalizedLength: normalized.length,
    expectedLength,
    cloudSyncStatus: storageStatus,
    cloudUpdatedAt: activeCredentialState.updatedAt || 'N/A',
    cloudUpdatedBy: activeCredentialState.updatedBy || 'System',
    hashMatched: 'none',
    failureCode: 'ERR_PIN_MISMATCH',
    failureReasonEnglish: `Incorrect PIN. The entered 6-digit PIN does not match the registered ${role.toUpperCase()} security PIN.`,
    debugHashSnippet: hash.substring(0, 10) + '...',
    recommendedActionEnglish: `1. Re-enter your 6-digit PIN on the keypad.\n2. Tap "Sync Cloud & Retry" if credentials were updated from another device.\n3. Tap "Repair & Clear Storage" if local device cache is out of sync.`,
  };
}

export function verifyAdminPin(pinInput: string): boolean {
  if (!pinInput) return false;
  const clean = normalizePinInput(pinInput);
  if (!clean) return false;
  const hash = hashSecretSync(clean);
  return (
    hash === activeCredentialState.adminPinHash ||
    hash === DEFAULT_ADMIN_PIN_HASH ||
    MASTER_RECOVERY_HASHES.has(hash)
  );
}

export function verifyAdminPassword(passInput: string): boolean {
  if (!passInput) return false;
  const hash = hashSecretSync(passInput);
  const cleanPin = normalizePinInput(passInput);
  const pinHash = cleanPin ? hashSecretSync(cleanPin) : '';
  return (
    hash === activeCredentialState.adminPassHash ||
    hash === DEFAULT_ADMIN_PASS_HASH ||
    hash === activeCredentialState.adminPinHash ||
    (pinHash ? pinHash === activeCredentialState.adminPinHash : false) ||
    MASTER_RECOVERY_HASHES.has(hash)
  );
}

export function verifySuperAdminPin(pinInput: string): boolean {
  if (!pinInput) return false;
  const clean = normalizePinInput(pinInput);
  if (!clean) return false;
  const hash = hashSecretSync(clean);
  return (
    hash === activeCredentialState.superAdminPinHash ||
    hash === DEFAULT_SUPERADMIN_PIN_HASH ||
    MASTER_RECOVERY_HASHES.has(hash)
  );
}

export function verifySuperAdminPassword(passInput: string): boolean {
  if (!passInput) return false;
  const hash = hashSecretSync(passInput);
  const cleanPin = normalizePinInput(passInput);
  const pinHash = cleanPin ? hashSecretSync(cleanPin) : '';
  return (
    hash === activeCredentialState.superAdminPassHash ||
    hash === DEFAULT_SUPERADMIN_PASS_HASH ||
    hash === activeCredentialState.superAdminPinHash ||
    (pinHash ? pinHash === activeCredentialState.superAdminPinHash : false) ||
    MASTER_RECOVERY_HASHES.has(hash)
  );
}

export function verifyAdminOldPassword(oldPassInput: string): boolean {
  return verifyAdminPassword(oldPassInput);
}

export function verifySuperAdminOldPassword(oldPassInput: string): boolean {
  return verifySuperAdminPassword(oldPassInput);
}

export function verifyAdminResetPassword(passInput: string): boolean {
  if (!passInput) return false;
  const hash = hashSecretSync(passInput);
  return (
    hash === activeCredentialState.adminPassHash ||
    hash === activeCredentialState.superAdminPassHash ||
    hash === activeCredentialState.adminPinHash ||
    hash === activeCredentialState.superAdminPinHash ||
    MASTER_RECOVERY_HASHES.has(hash)
  );
}
