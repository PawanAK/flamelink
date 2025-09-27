import { NextRequest, NextResponse } from 'next/server'

const store = globalThis as unknown as {
  __fl_claims?: Map<string, { share2: string; tokenHash: string; expiresAt: number; maxUses: number; usesRemaining: number }>
}

function fromBase64Url(b64url: string): string {
  const pad = b64url.length % 4 === 2 ? '==' : b64url.length % 4 === 3 ? '=' : ''
  return b64url.replace(/-/g, '+').replace(/_/g, '/') + pad
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const b64 = Buffer.from(new Uint8Array(digest)).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { claimId, token } = await req.json()
    if (!claimId || !token) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (!store.__fl_claims) return NextResponse.json({ error: 'Not initialized' }, { status: 500 })

    const entry = store.__fl_claims.get(claimId)
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (entry.usesRemaining <= 0) return NextResponse.json({ error: 'All uses exhausted' }, { status: 409 })
    if (Date.now() > entry.expiresAt) {
      store.__fl_claims.delete(claimId)
      return NextResponse.json({ error: 'Expired' }, { status: 410 })
    }

    const tokenHash = await sha256Base64Url(token)
    if (tokenHash !== entry.tokenHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Decrement uses remaining
    entry.usesRemaining = entry.usesRemaining - 1
    
    // Clean up if no uses remaining
    if (entry.usesRemaining <= 0) {
      store.__fl_claims.delete(claimId)
    } else {
      store.__fl_claims.set(claimId, entry)
    }

    return NextResponse.json({ 
      share2B64Url: entry.share2,
      usesRemaining: entry.usesRemaining,
      maxUses: entry.maxUses
    })
  } catch (e) {
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}


