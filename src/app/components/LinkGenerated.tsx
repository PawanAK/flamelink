'use client'

import { useState } from 'react'

interface LinkGeneratedProps {
  link: string
  onNewSecret: () => void
}

export default function LinkGenerated({ link, onNewSecret }: LinkGeneratedProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const shareViaEmail = () => {
    const subject = 'Secure One-Time Secret'
    const body = `I've sent you a secure one-time secret via FlameLink.

🔗 Link: ${link}

⚠️ IMPORTANT: This link will only work ONCE. After you open it, the secret will be permanently destroyed and cannot be recovered.

Secured by Walrus decentralized storage.`
    
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  const shareViaTwitter = () => {
    const text = "I've created a secure one-time secret using FlameLink 🔥 Powered by @walrus_xyz decentralized storage!"
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
          Secret Link Generated!
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Your secret has been encrypted and stored securely on Walrus.
          Share this link with the intended recipient.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🔗 One-Time Link
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={link}
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-mono"
          />
          <button
            onClick={copyToClipboard}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={shareViaEmail}
          className="flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-md font-medium transition-colors"
        >
          <span>📧</span>
          <span>Share via Email</span>
        </button>
        <button
          onClick={shareViaTwitter}
          className="flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-3 rounded-md font-medium transition-colors"
        >
          <span>🐦</span>
          <span>Tweet About It</span>
        </button>
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
        <div className="flex items-start space-x-2">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <h3 className="text-red-700 dark:text-red-300 font-medium text-sm mb-1">
              Critical Security Notice
            </h3>
            <ul className="text-red-600 dark:text-red-400 text-xs space-y-1">
              <li>• This link works only ONCE</li>
              <li>• After opening, the secret is permanently destroyed</li>
              <li>• Even you cannot recover it after it's been accessed</li>
              <li>• Share only with the intended recipient</li>
              <li>• Verify the recipient before sharing</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onNewSecret}
          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-md font-medium transition-colors"
        >
          🔄 Create Another Secret
        </button>
      </div>

      <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Powered by Walrus decentralized storage</p>
        <p className="mt-1">🌐 Censorship resistant • 🔐 Zero knowledge • ♾️ Permanent network</p>
      </div>
    </div>
  )
}
