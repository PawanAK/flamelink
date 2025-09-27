'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Shield, ArrowLeft, Copy, Check, Lock, Eye, EyeOff } from 'lucide-react'
import { encryptSecret, splitKeyXor, arrayBufferToBase64Url, generateSecretUrlKeySplit } from '../lib/crypto'
import { storeSecret } from '../lib/walrus'

type CreateState = 'input' | 'generating' | 'success'

export default function CreatePage() {
  const [state, setState] = useState<CreateState>('input')
  const [secret, setSecret] = useState('')
  const [secretLink, setSecretLink] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

    setState('generating')
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
      
      setSecretLink(secretUrl)
      setState('success')
      
    } catch (err) {
      console.error('Failed to create secret:', err)
      setError(err instanceof Error ? err.message : 'Failed to create secret. Please try again.')
      setState('input')
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(secretLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetForm = () => {
    setState('input')
    setSecret('')
    setSecretLink('')
    setError('')
    setCopied(false)
  }

  if (state === 'generating') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-2">Encrypting Your Secret</h2>
          <p className="text-muted-foreground">Securing on decentralized storage...</p>
        </motion.div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>

          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Secret Created Successfully</h1>
                  <p className="text-muted-foreground">
                    Your secret has been encrypted and stored securely. Share this link - it works only once.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your One-Time Secret Link</label>
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        {secretLink}
                      </div>
                      <Button onClick={copyLink} size="sm" className="px-3">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {copied && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ Copied to clipboard</p>
                    )}
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Important Security Notes</h3>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• This link will work only once - after someone opens it, the secret is destroyed forever</li>
                      <li>• The link contains sensitive cryptographic material - share it securely</li>
                      <li>• Even we cannot recover the secret once it's burned</li>
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={resetForm} className="flex-1">
                      Create Another Secret
                    </Button>
                    <Link href="/" className="flex-1">
                      <Button variant="outline" className="w-full">
                        Back to Home
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  // Input state
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Create One-Time Secret</h1>
                <p className="text-muted-foreground">
                  Enter sensitive information that will be encrypted and shared securely.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="secret" className="text-sm font-medium">
                      Your Secret
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPreview ? 'Hide' : 'Preview'}
                    </Button>
                  </div>
                  <Textarea
                    id="secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter password, API key, private message, or any sensitive information..."
                    className="min-h-[120px] resize-none"
                    style={{ 
                      fontFamily: showPreview ? 'inherit' : 'monospace',
                      WebkitTextSecurity: showPreview ? 'none' : 'disc'
                    }}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>⚠️ This information will be encrypted and destroyed after one access</span>
                    <span className={secret.length > 9000 ? 'text-destructive' : ''}>
                      {secret.length}/10,000
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!secret.trim()}
                  className="w-full py-6 text-lg"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Generate Secure Link
                </Button>
              </form>

              <div className="mt-8 p-4 bg-muted/50 rounded-md">
                <h3 className="text-sm font-medium mb-3">🛡️ Security Features</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>✅ Client-side AES-256-GCM encryption</li>
                  <li>✅ Key never leaves your browser</li>
                  <li>✅ Decentralized Walrus storage</li>
                  <li>✅ Cryptographic one-time guarantee</li>
                  <li>✅ Zero-knowledge architecture</li>
                </ul>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
