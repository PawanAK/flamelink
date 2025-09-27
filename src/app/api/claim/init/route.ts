import { NextRequest, NextResponse } from 'next/server'

// In-memory store for dev. Replace with KV/Redis in prod.
const store = globalThis as unknown as {
  __fl_claims?: Map<string, { share2: string; tokenHash: string; expiresAt: number; maxUses: number; usesRemaining: number }>
}
if (!store.__fl_claims) store.__fl_claims = new Map()

function randomId(len = 22): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const b64 = Buffer.from(new Uint8Array(digest)).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { share2B64Url, ttlSeconds, maxUses = 1 } = await req.json()
    if (!share2B64Url || typeof share2B64Url !== 'string') {
      return NextResponse.json({ error: 'share2B64Url required' }, { status: 400 })
    }
    
    // Validate maxUses (1-5 recipients)
    const validMaxUses = typeof maxUses === 'number' && maxUses >= 1 && maxUses <= 5 ? maxUses : 1
    const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : 3600
    const claimId = randomId()
    const token = randomId(24)
    const tokenHash = await sha256Base64Url(token)
    const expiresAt = Date.now() + ttl * 1000

    store.__fl_claims!.set(claimId, { 
      share2: share2B64Url, 
      tokenHash, 
      expiresAt, 
      maxUses: validMaxUses,
      usesRemaining: validMaxUses
    })

    return NextResponse.json({ claimId, token })
  } catch (e) {
    return NextResponse.json({ error: 'Init failed' }, { status: 500 })
  }
}


