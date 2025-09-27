/**
 * FlameLink Cryptography Module
 * Client-side encryption using Web Crypto API with AES-GCM
 */

export interface EncryptedData {
  ciphertext: ArrayBuffer
  iv: Uint8Array
  key: ArrayBuffer
}

export interface EncryptedFile {
  ciphertext: ArrayBuffer
  iv: Uint8Array
  key: ArrayBuffer
  filename: string
  type: string
  size: number
}

export interface SecretPackage {
  blobId: string
  key: string // base64 encoded key
  iv: string  // base64 encoded IV
}

/**
 * Encrypt a secret using AES-GCM
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedData> {
  // Generate a random AES-GCM key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  )

  // Generate a random IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Convert plaintext to bytes
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  )

  // Export the key for storage/transmission
  const exportedKey = await crypto.subtle.exportKey("raw", key)

  return {
    ciphertext,
    iv,
    key: exportedKey
  }
}

/**
 * Decrypt a secret using AES-GCM
 */
export async function decryptSecret(
  ciphertext: ArrayBuffer,
  keyData: ArrayBuffer,
  iv: Uint8Array
): Promise<string> {
  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false, // not extractable
    ["decrypt"]
  )

  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )

  // Convert bytes back to string
  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
}

/**
 * Encode binary data to base64 for URL transmission
 */
export function arrayBufferToBase64(buffer: ArrayBufferLike | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary)
}

/**
 * Decode base64 to binary data
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// URL-safe Base64 helpers
export function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function fromBase64Url(b64url: string): string {
  const pad = b64url.length % 4 === 2 ? '==' : b64url.length % 4 === 3 ? '=' : ''
  return b64url.replace(/-/g, '+').replace(/_/g, '/') + pad
}

export function arrayBufferToBase64Url(buffer: ArrayBufferLike | Uint8Array): string {
  return toBase64Url(arrayBufferToBase64(buffer))
}

export function base64UrlToArrayBuffer(b64url: string): ArrayBuffer {
  return base64ToArrayBuffer(fromBase64Url(b64url))
}

// Key splitting: choose random share1, share2 = key XOR share1
export function splitKeyXor(keyRaw: ArrayBuffer): { share1: Uint8Array; share2: Uint8Array } {
  const keyBytes = new Uint8Array(keyRaw)
  const share1 = crypto.getRandomValues(new Uint8Array(keyBytes.length))
  const share2 = new Uint8Array(keyBytes.length)
  for (let i = 0; i < keyBytes.length; i++) {
    share2[i] = keyBytes[i] ^ share1[i]
  }
  return { share1, share2 }
}

export function xorShares(share1: Uint8Array, share2: Uint8Array): Uint8Array {
  if (share1.length !== share2.length) throw new Error('Mismatched key share lengths')
  const out = new Uint8Array(share1.length)
  for (let i = 0; i < share1.length; i++) out[i] = share1[i] ^ share2[i]
  return out
}

export function bytesToHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64Url(digest)
}

/**
 * Generate a FlameLink URL with embedded encryption parameters
 */
export function generateSecretUrlKeySplit(
  blobId: string,
  keyShare1: Uint8Array,
  iv: Uint8Array,
  claimId: string,
  token: string
): string {
  const k1 = arrayBufferToBase64Url(keyShare1)
  const ivB64 = arrayBufferToBase64Url(iv)
  const tok = toBase64Url(btoa(token))
  const params = `${k1}.${ivB64}.${claimId}.${tok}`
  return `${window.location.origin}/secret/${blobId}#${params}`
}

/**
 * Parse encryption parameters from URL
 */
export function parseSecretUrl(url: string): {
  blobId: string;
  key?: ArrayBuffer;
  iv: Uint8Array;
  keyShare1?: Uint8Array;
  claimId?: string;
  token?: string;
} | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const blobId = pathParts[pathParts.length - 1]
    
    if (!urlObj.hash || !blobId) {
      throw new Error('Invalid URL format')
    }

    const params = urlObj.hash.slice(1) // Remove # prefix
    const parts = params.split('.')

    if (parts.length === 2) {
      // Legacy format: key.iv
      const [keyBase64, ivBase64] = parts
      const key = base64ToArrayBuffer(keyBase64)
      const iv = new Uint8Array(base64ToArrayBuffer(ivBase64))
      return { blobId, key, iv }
    }

    if (parts.length === 4) {
      // Key-split format: k1.iv.claimId.token
      const [k1b64url, ivb64url, claimId, tokUrlB64] = parts
      const keyShare1 = new Uint8Array(base64UrlToArrayBuffer(k1b64url))
      const iv = new Uint8Array(base64UrlToArrayBuffer(ivb64url))
      const token = atob(fromBase64Url(tokUrlB64))
      return { blobId, iv, keyShare1, claimId, token }
    }

    throw new Error('Unsupported link format')
  } catch (error) {
    console.error('Failed to parse secret URL:', error)
    return null
  }
}

/**
 * Encrypt a file using AES-GCM
 */
export async function encryptFile(file: File): Promise<EncryptedFile> {
  // Generate a random AES-GCM key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  )

  // Generate a random IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Read file as ArrayBuffer
  const fileData = await file.arrayBuffer()

  // Create metadata header with file info
  const metadata = {
    filename: file.name,
    type: file.type,
    size: file.size,
    timestamp: Date.now()
  }
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata))
  const metadataLength = new Uint8Array(4)
  new DataView(metadataLength.buffer).setUint32(0, metadataBytes.length, true)

  // Combine metadata and file data
  const combinedData = new Uint8Array(4 + metadataBytes.length + fileData.byteLength)
  combinedData.set(metadataLength, 0)
  combinedData.set(metadataBytes, 4)
  combinedData.set(new Uint8Array(fileData as ArrayBuffer), 4 + metadataBytes.length)

  // Encrypt the combined data
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    combinedData
  )

  // Export the key for storage/transmission
  const exportedKey = await crypto.subtle.exportKey("raw", key)

  return {
    ciphertext,
    iv,
    key: exportedKey,
    filename: file.name,
    type: file.type,
    size: file.size
  }
}

/**
 * Decrypt a file using AES-GCM
 */
export async function decryptFile(
  ciphertext: ArrayBuffer,
  keyData: ArrayBuffer,
  iv: Uint8Array
): Promise<{ data: ArrayBuffer; filename: string; type: string; size: number }> {
  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false, // not extractable
    ["decrypt"]
  )

  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext as ArrayBuffer
  )

  // Extract metadata
  const decryptedArray = new Uint8Array(decryptedData)
  const metadataLength = new DataView(decryptedArray.buffer, 0, 4).getUint32(0, true)
  const metadataBytes = decryptedArray.slice(4, 4 + metadataLength)
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))
  
  // Extract file data
  const fileData = decryptedArray.slice(4 + metadataLength)

  return {
    data: fileData.buffer,
    filename: metadata.filename,
    type: metadata.type,
    size: metadata.size
  }
}

/**
 * Check if the encrypted data contains a file (vs text secret)
 */
export function isEncryptedFile(data: ArrayBuffer): boolean {
  if (data.byteLength < 4) return false
  
  try {
    const metadataLength = new DataView(data.slice(0, 4)).getUint32(0, true)
    if (metadataLength > data.byteLength - 4 || metadataLength <= 0) return false
    
    const metadataBytes = new Uint8Array(data.slice(4, 4 + metadataLength))
    const metadataStr = new TextDecoder().decode(metadataBytes)
    const metadata = JSON.parse(metadataStr)
    
    return typeof metadata.filename === 'string' && typeof metadata.type === 'string'
  } catch {
    return false
  }
}
