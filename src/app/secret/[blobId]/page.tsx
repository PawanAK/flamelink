'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Shield, Eye, AlertTriangle, Copy, Check, ArrowLeft, Flame } from 'lucide-react'
import { decryptSecret, parseSecretUrl, xorShares, base64UrlToArrayBuffer } from '../../lib/crypto'
import { retrieveSecret, burnSecret } from '../../lib/walrus'

type ViewState = 'ready' | 'retrieving' | 'decrypting' | 'success' | 'burned' | 'error'

export default function SecretPage() {
  const params = useParams()
  const [state, setState] = useState<ViewState>('ready')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [copied, setCopied] = useState(false)
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
        const share2 = new Uint8Array(base64UrlToArrayBuffer(share2B64Url))
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

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading state
  if (state === 'retrieving' || state === 'decrypting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md mx-auto"
        >
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-2">
            {state === 'retrieving' ? 'Retrieving Secret' : 'Decrypting Secret'}
          </h2>
          <p className="text-muted-foreground mb-4">{progress}</p>
          <div className="w-full bg-muted rounded-full h-2">
            <motion.div 
              className="bg-primary h-2 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: state === 'retrieving' ? '30%' : '80%' }}
              transition={{ duration: 1 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            🛡️ Processing securely in your browser
          </p>
        </motion.div>
      </div>
    )
  }

  // Ready state
  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
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
              <Card className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Eye className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-4">One-Time Secret</h1>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                  This secret is encrypted and stored securely. It will be permanently destroyed after you reveal it.
                </p>
                
                <Button onClick={handleReveal} size="lg" className="px-12 py-6 text-lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Reveal Secret
                </Button>

                <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ Warning: This link works only once. If multiple people have access, the first person to click will see the secret.
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
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
                  <h1 className="text-3xl font-bold mb-2">Secret Revealed</h1>
                  <p className="text-muted-foreground">
                    The secret has been successfully retrieved and permanently destroyed from storage.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your Secret</label>
                    <div className="relative">
                      <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap break-all min-h-[100px]">
                        {secret}
                      </div>
                      <Button 
                        onClick={copySecret} 
                        size="sm" 
                        className="absolute top-2 right-2"
                        variant="secondary"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {copied && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ Copied to clipboard</p>
                    )}
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <h3 className="font-semibold text-red-800 dark:text-red-200">Secret Burned Forever</h3>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      This secret has been permanently destroyed. Even the original sender cannot recover it. 
                      Make sure to save it now if needed.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Link href="/create" className="flex-1">
                      <Button className="w-full">
                        Create Your Own Secret
                      </Button>
                    </Link>
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

  // Burned state
  if (state === 'burned') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
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
              <Card className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Flame className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4 text-red-600 dark:text-red-400">
                  Secret Already Burned
                </h1>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                  This secret has already been accessed and permanently destroyed. 
                  Even the original sender cannot recover it.
                </p>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-8">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    🔥 This is the security guarantee of FlameLink - once burned, secrets are cryptographically impossible to recover.
                  </p>
                </div>

                <div className="flex gap-4 justify-center">
                  <Link href="/create">
                    <Button>
                      Create Your Own Secret
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
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
            <Card className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-3xl font-bold mb-4 text-red-600 dark:text-red-400">
                Error Loading Secret
              </h1>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                {error || 'An unexpected error occurred while retrieving the secret.'}
              </p>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-8">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  💡 Common causes: Invalid link, network issues, or secret has already been accessed.
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <Link href="/create">
                  <Button>
                    Create New Secret
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
