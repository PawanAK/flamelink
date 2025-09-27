'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { decryptSecret, parseSecretUrl, xorShares } from '../../lib/crypto'
import { retrieveSecret, burnSecret } from '../../lib/walrus'
import SecretView from '../../components/SecretView'

type ViewState = 'ready' | 'retrieving' | 'decrypting' | 'success' | 'burned' | 'error'

export default function SecretPage() {
  const params = useParams()
  const [state, setState] = useState<ViewState>('ready')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [parsed, setParsed] = useState<{
    blobId: string;
    key?: ArrayBuffer;
    iv: Uint8Array;
    keyShare1?: Uint8Array;
    claimId?: string;
    token?: string;
  } | null>(null)

  useEffect(() => {
    try {
      const currentUrl = window.location.href
      const parsedUrl = parseSecretUrl(currentUrl)
      
      if (!parsedUrl) {
        setError('Invalid secret link format')
        setState('error')
        return
      }

      if (parsedUrl.blobId !== params.blobId) {
        setError('Mismatched secret parameters')
        setState('error')
        return
      }

      setParsed(parsedUrl)
      setState('ready')
    } catch (err) {
      setError('Invalid link')
      setState('error')
    }
  }, [params.blobId])

  const handleReveal = async () => {
    if (!parsed) return
    try {
      setState('retrieving')
      setProgress('Connecting to Walrus network...')

      const encryptedData = await retrieveSecret(parsed.blobId)

      setState('decrypting')
      setProgress('Decrypting secret...')

      const storedIv = new Uint8Array(encryptedData.slice(0, 12))
      const ciphertext = encryptedData.slice(12)

      if (storedIv.length !== parsed.iv.length || !storedIv.every((val, i) => val === parsed.iv[i])) {
        setError('Invalid encryption parameters')
        setState('error')
        return
      }

      let fullKey: ArrayBuffer
      if (parsed.key) {
        fullKey = parsed.key
      } else {
        // Claim the second key share once
        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId: parsed.claimId, token: parsed.token })
        })
        if (!res.ok) {
          throw new Error(await res.text().catch(() => 'Claim failed'))
        }
        const { share2B64Url } = await res.json()
        const share2 = new Uint8Array(await (await fetch(`data:;base64,${share2B64Url}`)).arrayBuffer())
        const combined = xorShares(parsed.keyShare1 as Uint8Array, share2)
        fullKey = combined.buffer
      }

      const decryptedSecret = await decryptSecret(ciphertext, fullKey, parsed.iv)

      setProgress('Burning secret from storage...')
      await burnSecret(parsed.blobId)

      setSecret(decryptedSecret)
      setState('success')
    } catch (err) {
      console.error('Failed to reveal secret:', err)
      if (err instanceof Error) {
        if (err.message.includes('burned') || err.message.includes('BURNED')) {
          setState('burned')
        } else if (err.message.includes('not found')) {
          setError('Secret not found or has expired')
          setState('error')
        } else {
          setError(err.message)
          setState('error')
        }
      } else {
        setError('Failed to retrieve secret')
        setState('error')
      }
    }
  }

  const handleNewSecret = () => {
    window.location.href = '/'
  }

  if (state === 'retrieving' || state === 'decrypting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4">
              <span className="text-orange-500">🔥</span> FlameLink
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Decentralized One-Time Secrets
            </p>
          </div>

          {/* Loading State */}
          <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4 animate-spin">🔄</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              {state === 'retrieving' ? 'Retrieving Secret...' : 'Decrypting Secret...'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {progress}
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                style={{ 
                  width: state === 'retrieving' ? '30%' : '80%' 
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              🛡️ Processing securely in your browser
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4">
              <span className="text-orange-500">🔥</span> FlameLink
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Decentralized One-Time Secrets
            </p>
          </div>

          <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">👁️</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Click to Reveal Secret
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The secret is encrypted and stored on Walrus. It will be retrieved and decrypted only after you click reveal, and then burned.
            </p>
            <button
              onClick={handleReveal}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Reveal Secret
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              ⚠️ If this link was shared with multiple people, the first to reveal will see the secret.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4">
              <span className="text-orange-500">🔥</span> FlameLink
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Decentralized One-Time Secrets
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <SecretView secret={secret} onNewSecret={handleNewSecret} />
          </div>
        </div>
      </div>
    )
  }

  if (state === 'burned') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4">
              <span className="text-orange-500">🔥</span> FlameLink
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Decentralized One-Time Secrets
            </p>
          </div>

          <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🔥</div>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Secret Already Burned
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This secret has already been accessed and permanently destroyed.
              Even the original sender cannot recover it.
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
              <p className="text-red-600 dark:text-red-400 text-sm">
                🔥 This is the security guarantee of FlameLink - once burned, secrets are cryptographically impossible to recover.
              </p>
            </div>
            <button
              onClick={handleNewSecret}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create Your Own Secret
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">
            <span className="text-orange-500">🔥</span> FlameLink
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Decentralized One-Time Secrets
          </p>
        </div>

        <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Error Loading Secret
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error || 'An unexpected error occurred while retrieving the secret.'}
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              💡 Common causes: Invalid link, network issues, or secret has already been accessed.
            </p>
          </div>
          <button
            onClick={handleNewSecret}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}
