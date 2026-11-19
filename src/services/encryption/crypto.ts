import { scryptAsync } from '@noble/hashes/scrypt.js'
import { sha256 } from '@noble/hashes/sha2.js'

export const BLOCK_SIZE = 4 * 1024 * 1024

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

export async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKeyPair>
}

export async function publicKeyToPem(key: CryptoKey) {
  const encoded = await crypto.subtle.exportKey('spki', key)
  return bytesToBase64(new Uint8Array(encoded))
}

export async function publicKeyFromBase64(value: string) {
  return crypto.subtle.importKey('spki', base64ToBytes(value), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
}

export async function privateKeyToPem(key: CryptoKey) {
  const encoded = await crypto.subtle.exportKey('pkcs8', key)
  return bytesToBase64(new Uint8Array(encoded))
}

export async function encryptPrivateKey(password: string, salt: Uint8Array, privateKey: CryptoKey) {
  const passwordBytes = new TextEncoder().encode(password)
  const derived = await scryptAsync(passwordBytes, salt, { N: 32768, r: 8, p: 1, dkLen: 32 })
  const aesKey = await crypto.subtle.importKey('raw', derived, 'AES-GCM', false, ['encrypt'])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, pkcs8)
  return JSON.stringify({ nonce: bytesToBase64(nonce), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) })
}

export async function decryptPrivateKey(password: string, saltBase64: string, encryptedJson: string) {
  const passwordBytes = new TextEncoder().encode(password)
  const salt = base64ToBytes(saltBase64)
  const derived = await scryptAsync(passwordBytes, salt, { N: 32768, r: 8, p: 1, dkLen: 32 })
  const aesKey = await crypto.subtle.importKey('raw', derived, 'AES-GCM', false, ['decrypt'])
  const { nonce, ciphertext } = JSON.parse(encryptedJson) as { nonce: string; ciphertext: string }
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(nonce) }, aesKey, base64ToBytes(ciphertext))
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])
}

export function createBlockAad(fileId: string, blockNumber: number) {
  return new TextEncoder().encode(JSON.stringify({ fileId, blockNumber }))
}

export async function encryptBlock(fileId: string, blockNumber: number, plaintext: Uint8Array, dek: CryptoKey) {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: createBlockAad(fileId, blockNumber) },
    dek,
    plaintext,
  )
  return { nonce: bytesToBase64(nonce), ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptBlock(fileId: string, blockNumber: number, nonceBase64: string, ciphertext: Uint8Array, dek: CryptoKey) {
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(nonceBase64), additionalData: createBlockAad(fileId, blockNumber) },
    dek,
    ciphertext,
  ))
}

export async function wrapDek(dek: CryptoKey, publicKey: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', dek)
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw)
  return bytesToBase64(new Uint8Array(wrapped))
}

export async function unwrapDek(wrappedBase64: string, privateKey: CryptoKey) {
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(wrappedBase64))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}
