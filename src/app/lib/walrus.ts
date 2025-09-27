/**
 * FlameLink Walrus Integration
 * Interfaces with Walrus decentralized storage network
 */

// Walrus Testnet endpoints
const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space'
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space'

export interface WalrusStoreResponse {
  newlyCreated?: {
    blobObject: {
      id: string
      blobId: string
      size: number
      encodingType: string
      certifiedEpoch: number
    }
  }
  alreadyCertified?: {
    blobId: string
  }
}

export interface StoredSecret {
  blobId: string
  size: number
}

const BURNED_MARKER = 'FLAMELINK_BURNED'

/**
 * Store encrypted data on Walrus
 */
export async function storeSecret(encryptedData: ArrayBuffer): Promise<StoredSecret> {
  const url = `${WALRUS_PUBLISHER}/v1/blobs?deletable=true&epochs=1`
  console.log('🔄 Storing secret on Walrus:', {
    url,
    dataSize: encryptedData.byteLength,
    timestamp: new Date().toISOString()
  })

  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: encryptedData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    })

    console.log('📡 Walrus response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response')
      console.error('❌ Walrus storage failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Walrus storage failed: ${response.status} ${response.statusText}. ${errorText}`)
    }

    const result: WalrusStoreResponse = await response.json()
    console.log('✅ Walrus storage success:', result)
    
    let blobId: string
    let size: number

    if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId
      size = result.newlyCreated.blobObject.size
    } else if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId
      size = encryptedData.byteLength
    } else {
      console.error('❌ Unexpected Walrus response format:', result)
      throw new Error('Unexpected Walrus response format')
    }

    console.log('🎉 Secret stored successfully:', { blobId, size })
    return { blobId, size }
  } catch (error) {
    console.error('💥 Failed to store secret on Walrus:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to store secret. Please try again.')
  }
}

/**
 * Retrieve data from Walrus
 */
export async function retrieveSecret(blobId: string): Promise<ArrayBuffer> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`
  console.log('📥 Retrieving secret from Walrus:', { blobId, url })

  try {
    const response = await fetch(url)

    console.log('📡 Retrieval response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log('❌ Secret not found (404) - likely burned or invalid')
        throw new Error('Secret not found or has been burned')
      }
      console.error('❌ Failed to retrieve secret:', {
        status: response.status,
        statusText: response.statusText
      })
      throw new Error(`Failed to retrieve secret: ${response.status} ${response.statusText}`)
    }

    const data = await response.arrayBuffer()
    console.log('📦 Retrieved data size:', data.byteLength)
    
    // Check if the secret has been burned
    const text = new TextDecoder().decode(data)
    if (text === BURNED_MARKER) {
      console.log('🔥 Secret was already burned')
      throw new Error('Secret has been burned')
    }

    console.log('✅ Secret retrieved successfully')
    return data
  } catch (error) {
    console.error('💥 Failed to retrieve secret:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to retrieve secret')
  }
}

/**
 * Mark a secret as burned by overwriting it
 */
export async function burnSecret(blobId: string): Promise<void> {
  const url = `${WALRUS_PUBLISHER}/v1/blobs?deletable=true&epochs=1`
  console.log('🔥 Burning secret:', { blobId, url })

  try {
    const burnData = new TextEncoder().encode(BURNED_MARKER)
    
    const response = await fetch(url, {
      method: 'PUT',
      body: burnData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    })

    if (!response.ok) {
      console.warn('⚠️ Failed to burn secret, but this is not critical:', {
        status: response.status,
        statusText: response.statusText
      })
      // Don't throw error - secret was already retrieved successfully
    } else {
      console.log('✅ Secret burned successfully')
    }
  } catch (error) {
    console.warn('⚠️ Failed to burn secret marker:', error)
    // Don't throw error - burning is best-effort
  }
}

/**
 * Check if Walrus services are available
 */
export async function checkWalrusHealth(): Promise<boolean> {
  try {
    const [publisherResponse, aggregatorResponse] = await Promise.allSettled([
      fetch(`${WALRUS_PUBLISHER}/v1/api`, { method: 'HEAD' }),
      fetch(`${WALRUS_AGGREGATOR}/v1/api`, { method: 'HEAD' })
    ])

    return (
      publisherResponse.status === 'fulfilled' &&
      aggregatorResponse.status === 'fulfilled' &&
      publisherResponse.value.ok &&
      aggregatorResponse.value.ok
    )
  } catch {
    return false
  }
}
