"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Copy, Check, Lock, Shield } from "lucide-react"
import { encryptSecret, splitKeyXor, arrayBufferToBase64Url, generateSecretUrlKeySplit } from "../lib/crypto"
import { storeSecret } from "../lib/walrus"

type CreateState = "input" | "generating" | "success"

export default function CreatePage() {
  const [state, setState] = useState<CreateState>("input")
  const [secret, setSecret] = useState("")
  const [secretLink, setSecretLink] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!secret.trim()) {
      setError("Please enter a secret to share")
      return
    }

    if (secret.length > 10000) {
      setError("Secret is too long. Please keep it under 10,000 characters.")
      return
    }

    setState("generating")
    setError("")

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

      const initRes = await fetch("/api/claim/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share2B64Url: arrayBufferToBase64Url(share2), ttlSeconds: 3600 }),
      })
      if (!initRes.ok) {
        const msg = await initRes.text().catch(() => "Failed to initialize claim gate")
        throw new Error(msg)
      }
      const { claimId, token } = await initRes.json()

      // Step 5: Generate shareable URL with key share and claim info
      const secretUrl = generateSecretUrlKeySplit(blobId, share1, encrypted.iv, claimId, token)

      setSecretLink(secretUrl)
      setState("success")
    } catch (err) {
      console.error("Failed to create secret:", err)
      setError(err instanceof Error ? err.message : "Failed to create secret. Please try again.")
      setState("input")
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(secretLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetForm = () => {
    setState("input")
    setSecret("")
    setSecretLink("")
    setError("")
    setCopied(false)
  }

  if (state === "generating") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-sm"
        >
          <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-medium mb-4 text-foreground">Creating secure link</h2>
          <p className="text-sm text-muted-foreground">Encrypting and storing your secret...</p>
        </motion.div>
      </div>
    )
  }

  if (state === "success") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-xl">
          <div className="mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-medium mb-2 text-foreground">Link created</h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Your secret is encrypted and ready to share. The link will self-destruct after one use.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-muted/50 rounded-lg font-mono text-xs break-all text-foreground border border-border">
                      {secretLink}
                    </div>
                    <Button onClick={copyLink} size="sm" variant="outline" className="px-3 shrink-0 bg-transparent">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  {copied && <p className="text-xs text-muted-foreground mt-2">Copied to clipboard</p>}
                </div>

                <div className="bg-muted/30 border border-border rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        This link can only be opened once. After viewing, it will be permanently destroyed.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={resetForm} className="flex-1">
                    Create another
                  </Button>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full bg-transparent">
                      Home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Input state
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-medium mb-2 text-foreground">Share a secret</h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Send sensitive information with end-to-end encryption and automatic destruction.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Textarea
                  id="secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter your secret here..."
                  className="min-h-[140px] resize-none border-border focus:border-ring transition-colors bg-background text-sm"
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    Encrypted locally
                  </span>
                  <span className={`${secret.length > 9000 ? "text-destructive" : "text-muted-foreground"}`}>
                    {secret.length}/10,000
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={!secret.trim()} className="w-full">
                Create secure link
              </Button>
            </form>

            <div className="text-center">
              <div className="inline-flex items-center gap-4 text-xs text-muted-foreground">
                <span>End-to-end encrypted</span>
                <span>•</span>
                <span>Self-destructing</span>
                <span>•</span>
                <span>Zero-knowledge</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}