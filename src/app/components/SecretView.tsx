'use client'

import { useState, useEffect } from 'react'

interface SecretViewProps {
  secret: string
  onNewSecret: () => void
}

export default function SecretView({ secret, onNewSecret }: SecretViewProps) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = secret
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4 animate-pulse">🔥</div>
        <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">
          Secret Retrieved Successfully
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          This secret has now been permanently destroyed from Walrus storage.
          Save it now - it cannot be recovered.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🔓 Decrypted Secret
          </label>
          <div className={`text-sm font-mono px-2 py-1 rounded ${
            timeLeft > 10 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 animate-pulse'
          }`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
        <div className="relative">
          <textarea
            value={secret}
            readOnly
            className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none font-mono text-sm"
          />
          <button
            onClick={copySecret}
            className={`absolute top-2 right-2 px-3 py-1 rounded text-sm font-medium transition-colors ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {copied ? '✅' : '📋'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Copy this secret immediately. It will not be shown again.
        </p>
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
        <div className="flex items-start space-x-2">
          <span className="text-red-500 text-xl">🔥</span>
          <div>
            <h3 className="text-red-700 dark:text-red-300 font-medium text-sm mb-2">
              This Secret Has Been Permanently Destroyed
            </h3>
            <ul className="text-red-600 dark:text-red-400 text-xs space-y-1">
              <li>• The original data has been overwritten on Walrus</li>
              <li>• The link that brought you here is now permanently dead</li>
              <li>• Even the original sender cannot recover this secret</li>
              <li>• This is guaranteed by cryptography, not promises</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">✅</div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            Decrypted client-side
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 text-center">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">🔥</div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            Burned from Walrus
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onNewSecret}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-md font-medium transition-colors"
        >
          🔄 Create Your Own Secret
        </button>
      </div>

      <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Thanks for using FlameLink!</p>
        <p className="mt-1">🔐 Zero-knowledge • 🌐 Decentralized • 🔥 Trustless</p>
      </div>
    </div>
  )
}
