import { describe, expect, it } from 'vitest'
import {
  decryptBlock,
  encryptBlock,
  encryptPrivateKey,
  decryptPrivateKey,
  generateRsaKeyPair,
  sha256Hex,
  unwrapDek,
  wrapDek,
} from '../src/services/encryption/crypto'

describe('SecureCloud cryptography', () => {
  it('protects and restores an RSA private key', async () => {
    const pair = await generateRsaKeyPair()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const saltText = btoa(String.fromCharCode(...salt))
    const protectedKey = await encryptPrivateKey('correct horse battery staple', salt, pair.privateKey)
    const restored = await decryptPrivateKey('correct horse battery staple', saltText, protectedKey)
    expect(restored.type).toBe('private')
  })

  it('rejects an incorrect private-key password', async () => {
    const pair = await generateRsaKeyPair()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const saltText = btoa(String.fromCharCode(...salt))
    const protectedKey = await encryptPrivateKey('correct password', salt, pair.privateKey)
    await expect(decryptPrivateKey('wrong password', saltText, protectedKey)).rejects.toBeDefined()
  })

  it('encrypts and decrypts an empty file block', async () => {
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const encrypted = await encryptBlock('empty-file', 0, new Uint8Array(), dek)
    const plaintext = await decryptBlock('empty-file', 0, encrypted.nonce, encrypted.ciphertext, dek)
    expect(plaintext.length).toBe(0)
  })

  it('detects a modified encrypted block', async () => {
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const encrypted = await encryptBlock('file-id', 0, new Uint8Array([1, 2, 3, 4]), dek)
    const modified = encrypted.ciphertext.slice()
    modified[0] ^= 1
    await expect(decryptBlock('file-id', 0, encrypted.nonce, modified, dek)).rejects.toBeDefined()
  })

  it('detects swapped block numbers through authenticated AAD', async () => {
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const encrypted = await encryptBlock('swap-file', 1, new Uint8Array([9, 8, 7]), dek)
    await expect(decryptBlock('swap-file', 2, encrypted.nonce, encrypted.ciphertext, dek)).rejects.toBeDefined()
  })

  it('wraps and unwraps a file data key', async () => {
    const pair = await generateRsaKeyPair()
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const wrapped = await wrapDek(dek, pair.publicKey)
    const restored = await unwrapDek(wrapped, pair.privateKey)
    expect(restored.algorithm.name).toBe('AES-GCM')
  })

  it('calculates SHA-256 and detects changed content', async () => {
    const original = await sha256Hex(new Uint8Array([1, 2, 3]))
    const changed = await sha256Hex(new Uint8Array([1, 2, 4]))
    expect(original).not.toBe(changed)
  })
})
