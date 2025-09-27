'use client'

import { useState } from 'react'
import { encryptSecret, splitKeyXor, arrayBufferToBase64Url, generateSecretUrlKeySplit } from '../lib/crypto'
import { storeSecret } from '../lib/walrus'

interface SecretInputProps {
  onSecretGenerated: (link: string) => void
}

export default function SecretInput({ onSecretGenerated }: SecretInputProps) {
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!secret.trim()) {
      setError('Please enter a secret to share')
      return
    }

    if (secret.length > 10000) {
      setError('Secret is too long. Please keep it under 10,000 characters.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Step 1: Encrypt the secret client-side
      const encrypted = await encryptSecret(secret)
      
      // Step 2: Combine encrypted data with IV for storage
      const combinedData = new Uint8Array(encrypted.iv.length + encrypted.ciphertext.byteLength)
      combinedData.set(encrypted.iv, 0)
      combinedData.set(new Uint8Array(encrypted.ciphertext), encrypted.iv.length)
      
      // Step 3: Store on Walrus
      const { blobId } = await storeSecret(combinedData.buffer)
      
      // Step 4: Split key and initialize one-time claim gate
      const { share1, share2 } = splitKeyXor(encrypted.key)

      const initRes = await fetch('/api/claim/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share2B64Url: arrayBufferToBase64Url(share2), ttlSeconds: 3600 })
      })
      if (!initRes.ok) {
        const msg = await initRes.text().catch(() => 'Failed to initialize claim gate')
        throw new Error(msg)
      }
      const { claimId, token } = await initRes.json()

      // Step 5: Generate shareable URL with key share and claim info
      const secretUrl = generateSecretUrlKeySplit(blobId, share1, encrypted.iv, claimId, token)
      
      // Clear the input
      setSecret('')
      
      // Pass the link back to parent
      onSecretGenerated(secretUrl)
      
    } catch (err) {
      console.error('Failed to create secret:', err)
      setError(err instanceof Error ? err.message : 'Failed to create secret. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          🔐 Create One-Time Secret
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Enter your sensitive information. It will be encrypted and stored securely on Walrus.
          The link will work only once - after someone opens it, the secret is permanently destroyed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="secret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Secret
          </label>
          <textarea
            id="secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter password, API key, private message, or any sensitive information..."
            className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100 resize-none"
            disabled={isLoading}
          />
          <div className="mt-1 flex justify-between items-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ⚠️ Make sure you trust the person you're sharing this with
            </p>
            <span className={`text-xs ${secret.length > 9000 ? 'text-red-500' : 'text-gray-400'}`}>
              {secret.length}/10,000
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !secret.trim()}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Encrypting & Storing...</span>
            </>
          ) : (
            <>
              <span>🔥</span>
              <span>Generate One-Time Link</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
          🛡️ Security Features
        </h3>
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <li>✅ Client-side encryption (AES-256-GCM)</li>
          <li>✅ Key never leaves your browser</li>
          <li>✅ Stored on decentralized Walrus network</li>
          <li>✅ Auto-destruct after first access</li>
          <li>✅ Zero-knowledge architecture</li>
        </ul>
      </div>
    </div>
  )
}
