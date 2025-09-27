'use client'

import { useState } from 'react'
import SecretInput from './components/SecretInput'
import LinkGenerated from './components/LinkGenerated'
import SecretView from './components/SecretView'

type ViewMode = 'input' | 'link' | 'view' | 'burned'

export default function Home() {
  const [mode, setMode] = useState<ViewMode>('input')
  const [secretLink, setSecretLink] = useState('')
  const [decryptedSecret, setDecryptedSecret] = useState('')

  const handleSecretGenerated = (link: string) => {
    setSecretLink(link)
    setMode('link')
  }

  const handleSecretViewed = (secret: string) => {
    setDecryptedSecret(secret)
    setMode('view')
  }

  const handleSecretBurned = () => {
    setMode('burned')
  }

  const resetToInput = () => {
    setMode('input')
    setSecretLink('')
    setDecryptedSecret('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">
            <span className="text-orange-500">🔥</span> FlameLink
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            Decentralized One-Time Secrets
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by Walrus • When it burns, it's gone forever
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {mode === 'input' && (
            <SecretInput onSecretGenerated={handleSecretGenerated} />
          )}
          
          {mode === 'link' && (
            <LinkGenerated 
              link={secretLink} 
              onNewSecret={resetToInput}
            />
          )}
          
          {mode === 'view' && (
            <SecretView 
              secret={decryptedSecret}
              onNewSecret={resetToInput}
            />
          )}
          
          {mode === 'burned' && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">🔥</div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                Secret Already Burned
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                This secret has already been accessed and permanently destroyed.
                Even the original sender cannot recover it.
              </p>
              <button
                onClick={resetToInput}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create New Secret
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-2">
            🛡️ Zero-knowledge • 🌐 Decentralized • 🔐 Client-side encryption
          </p>
          <p>
            Secured by <a href="https://docs.wal.app" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Walrus</a> decentralized storage
          </p>
        </div>
      </div>
    </div>
  )
}
