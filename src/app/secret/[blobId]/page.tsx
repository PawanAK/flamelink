"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Check, Lock, Shield, AlertTriangle, Download, File, Users } from "lucide-react"
import { isEncryptedFile, parseSecretUrl, xorShares, base64UrlToArrayBuffer } from "../../lib/crypto"
import { retrieveSecret, burnSecret } from "../../lib/walrus"

type ViewState = "ready" | "retrieving" | "decrypting" | "success" | "burned" | "error"
type ContentType = "text" | "file"

export default function SecretPage() {
  const params = useParams()
  const [state, setState] = useState<ViewState>("ready")
  const [secret, setSecret] = useState("")
  const [fileData, setFileData] = useState<{
    data: ArrayBuffer
    filename: string
    type: string
    size: number
  } | null>(null)
  const [contentType, setContentType] = useState<ContentType>("text")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")
  const [copied, setCopied] = useState(false)
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false)
  const [usageInfo, setUsageInfo] = useState<{usesRemaining: number; maxUses: number} | null>(null)
  const [parsed, setParsed] = useState<{
    blobId: string
    key?: ArrayBuffer
    iv: Uint8Array
    keyShare1?: Uint8Array
    claimId?: string
    token?: string
  } | null>(null)

  useEffect(() => {
    try {
      const currentUrl = window.location.href
      const parsedUrl = parseSecretUrl(currentUrl)

      if (!parsedUrl) {
        setError("Invalid secret link format")
        setState("error")
        return
      }

      if (parsedUrl.blobId !== params.blobId) {
        setError("Mismatched secret parameters")
        setState("error")
        return
      }

      setParsed(parsedUrl)
      setState("ready")
    } catch (err) {
      setError("Invalid link")
      setState("error")
    }
  }, [params.blobId])

  const handleReveal = async () => {
    if (!parsed) return
    try {
      setState("retrieving")
      setProgress("Retrieving encrypted content...")

      const encryptedData = await retrieveSecret(parsed.blobId)

      setState("decrypting")
      setProgress("Decrypting content...")

      const storedIv = new Uint8Array(encryptedData.slice(0, 12))
      const ciphertext = encryptedData.slice(12)

      if (storedIv.length !== parsed.iv.length || !storedIv.every((val, i) => val === parsed.iv[i])) {
        setError("Invalid encryption parameters")
        setState("error")
        return
      }

      let fullKey: ArrayBuffer
      if (parsed.key) {
        fullKey = parsed.key
      } else {
        // Claim the second key share once
        const res = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId: parsed.claimId, token: parsed.token }),
        })
        if (!res.ok) {
          const errorText = await res.text().catch(() => "Claim failed")
          let errorMessage = "Claim failed"

          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error) {
              if (errorData.error === "Already claimed" || errorData.error.includes("Already claimed")) {
                errorMessage = "This secret has already been accessed and destroyed"
              } else if (errorData.error === "All uses exhausted" || errorData.error.includes("All uses exhausted")) {
                errorMessage = "All views of this secret have been used and it has been destroyed"
              } else {
                errorMessage = errorData.error
              }
            }
          } catch {
            if (errorText.includes("Already claimed")) {
              errorMessage = "This secret has already been accessed and destroyed"
            } else if (errorText.includes("All uses exhausted")) {
              errorMessage = "All views of this secret have been used and it has been destroyed"
            } else {
              errorMessage = errorText
            }
          }

          throw new Error(errorMessage)
        }
        const { share2B64Url, usesRemaining, maxUses } = await res.json()
        
        // Store usage information
        if (typeof usesRemaining === 'number' && typeof maxUses === 'number') {
          setUsageInfo({ usesRemaining, maxUses })
        }
        
        const share2 = new Uint8Array(base64UrlToArrayBuffer(share2B64Url))
        const combined = xorShares(parsed.keyShare1 as Uint8Array, share2)
        fullKey = combined.buffer as ArrayBuffer
      }

      // Decrypt once, then detect content type from decrypted bytes
      setProgress("Analyzing content...")

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        fullKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      )

      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(parsed.iv) },
        cryptoKey,
        ciphertext as ArrayBuffer
      )

      const looksLikeFile = isEncryptedFile(decryptedData as ArrayBuffer)
      setContentType(looksLikeFile ? "file" : "text")

      if (looksLikeFile) {
        setProgress("Preparing download...")
        const decryptedArray = new Uint8Array(decryptedData)
        const metadataLength = new DataView(decryptedArray.buffer, 0, 4).getUint32(0, true)
        const metadataBytes = decryptedArray.slice(4, 4 + metadataLength)
        const metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as {
          filename: string
          type: string
          size: number
        }
        const fileBytes = decryptedArray.slice(4 + metadataLength)

        const decryptedFileData = {
          data: fileBytes.buffer,
          filename: metadata.filename,
          type: metadata.type,
          size: metadata.size
        }

        setFileData(decryptedFileData)

        // Automatically trigger download for files
        setTimeout(() => {
          const blob = new Blob([decryptedFileData.data], { type: decryptedFileData.type })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = decryptedFileData.filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setAutoDownloadTriggered(true)
        }, 100) // Small delay to ensure UI updates first
      } else {
        // Treat as text secret
        const text = new TextDecoder().decode(decryptedData)
        setSecret(text)
      }

      setProgress("Burning secret from storage...")
      await burnSecret(parsed.blobId)

      setState("success")
    } catch (err) {
      console.error("Failed to reveal secret:", err)
      if (err instanceof Error) {
        if (err.message.includes("burned") || err.message.includes("BURNED")) {
          setState("burned")
        } else if (err.message.includes("already been accessed") || err.message.includes("Already claimed") || err.message.includes("All uses exhausted")) {
          setState("burned")
        } else if (err.message.includes("not found")) {
          setError("Secret not found or has expired")
          setState("error")
        } else {
          setError(err.message)
          setState("error")
        }
      } else {
        setError("Failed to retrieve secret")
        setState("error")
      }
    }
  }

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadFile = () => {
    if (!fileData) return
    
    const blob = new Blob([fileData.data], { type: fileData.type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileData.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.startsWith('video/')) return '🎥'
    if (type.startsWith('audio/')) return '🎵'
    if (type.includes('pdf')) return '📄'
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️'
    if (type.includes('text/') || type.includes('json')) return '📝'
    return '📄'
  }

  if (state === "retrieving" || state === "decrypting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-sm"
        >
          <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-medium mb-4 text-foreground">
            {state === "retrieving" ? "Retrieving content" : "Decrypting content"}
          </h2>
          <p className="text-sm text-muted-foreground">{progress}</p>
        </motion.div>
      </div>
    )
  }

  if (state === "ready") {
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
                <h1 className="text-2xl font-medium mb-2 text-foreground">Reveal content</h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  This link contains encrypted content. After viewing, it will be permanently destroyed.
                </p>
              </div>

              <Button onClick={handleReveal} disabled={!parsed} className="w-full">
                Reveal content
              </Button>
            </div>
          </motion.div>
        </div>
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
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-medium mb-2 text-foreground">
                  {contentType === "file" ? "File ready" : "Secret revealed"}
                </h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {contentType === "file" 
                    ? "Your file has been decrypted and should start downloading automatically. It has been permanently removed from storage."
                    : "The secret has been decrypted and permanently removed from storage."}
                </p>
              </div>

              <div className="space-y-4">
                {contentType === "text" ? (
                  <div>
                    <div className="relative">
                      <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap text-foreground border border-border">
                        {secret}
                      </div>
                      <Button
                        onClick={copySecret}
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 bg-transparent"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {copied && <p className="text-xs text-muted-foreground mt-2">Copied to clipboard</p>}
                  </div>
                ) : fileData ? (
                  <div className="space-y-4">
                    <div className="bg-muted/30 border border-border rounded-lg p-6 text-center">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <File className="w-8 h-8 text-primary" />
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-center gap-2 text-lg font-medium">
                          <span className="text-2xl">{getFileIcon(fileData.type)}</span>
                          <span className="text-foreground">{fileData.filename}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(fileData.size)} • {fileData.type || 'Unknown type'}
                        </p>
                      </div>
                      <Button onClick={downloadFile} className="w-full" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download Again
                      </Button>
                      {autoDownloadTriggered && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          ✓ Download started automatically
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {autoDownloadTriggered ? "Need to download again?" : "Download didn't start? Click the button above."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Usage Information */}
                {usageInfo && usageInfo.maxUses > 1 && (
                  <div className="bg-muted/30 border border-border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {usageInfo.usesRemaining > 0 
                            ? `This secret can be viewed ${usageInfo.usesRemaining} more time${usageInfo.usesRemaining === 1 ? '' : 's'} before it's permanently destroyed.`
                            : "This was the final view of this secret. It has been permanently destroyed."
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {usageInfo.maxUses - usageInfo.usesRemaining} of {usageInfo.maxUses} views used
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Link href="/create" className="flex-1">
                    <Button className="w-full">Create your own secret</Button>
                  </Link>
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

  if (state === "burned") {
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
                <div className="w-10 h-10 bg-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-5 h-5 text-destructive-foreground" />
                </div>
                <h1 className="text-2xl font-medium mb-2 text-foreground">Secret already burned</h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  This secret has already been accessed and permanently destroyed.
                </p>
              </div>

              <div className="flex gap-3">
                <Link href="/create" className="flex-1">
                  <Button className="w-full">Create a secret</Button>
                </Link>
                <Link href="/" className="flex-1">
                  <Button variant="outline" className="w-full bg-transparent">
                    Home
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Error state
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
              <div className="w-10 h-10 bg-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-5 h-5 text-destructive-foreground" />
              </div>
              <h1 className="text-2xl font-medium mb-2 text-foreground">Unable to load secret</h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                {(() => {
                  if (!error) return "An unexpected error occurred while retrieving the secret."

                  try {
                    const parsedError = JSON.parse(error)
                    if (parsedError.error === "Already claimed") {
                      return "This secret has already been accessed and is no longer available."
                    }
                    if (parsedError.error) {
                      return parsedError.error
                    }
                  } catch {
                    if (error.includes("Already claimed")) {
                      return "This secret has already been accessed and is no longer available."
                    }
                    if (error.includes('{"error":')) {
                      const match = error.match(/"error":"([^"]+)"/)
                      if (match && match[1]) {
                        if (match[1] === "Already claimed") {
                          return "This secret has already been accessed and is no longer available."
                        }
                        return match[1]
                      }
                    }
                  }

                  return error
                })()}
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/create" className="flex-1">
                <Button className="w-full">Create a secret</Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}