# 🔥 FlameLink — Cryptographically Guaranteed One‑Time Secrets

FlameLink is a decentralized, zero‑knowledge one‑time secret sharing app. It encrypts secrets in the browser, stores only ciphertext on the Walrus network, and releases the missing key share via a one‑time claim gate. Without both key shares, decryption is impossible.

— Built with Next.js 15, React 19, Walrus, and the Web Crypto API.

## ✨ What problem does it solve?

- **Leaking secrets in transit**: Traditional tools send secrets to centralized servers you must trust.
- **Fake one‑time “flags”**: Many services enforce one‑time access with a database flag, not cryptography.
- **Censorship and outages**: Centralized storage can be blocked or taken down.

FlameLink provides mathematical guarantees: client‑side encryption, decentralized storage, and a cryptographic one‑time claim gate.

## 🧠 How it works (high‑level)

```mermaid
graph TB
    A[Create secret] --> B[Encrypt in browser (AES‑256‑GCM)]
    B --> C[Split key: K = K1 ⊕ K2]
    C --> D[Store ciphertext on Walrus]
    C --> E[Store K2 in claim gate]
    D --> F[Generate one‑time link]
    E --> F
    F --> G[Recipient opens link]
    G --> H[Claim K2 once]
    H --> I[Reconstruct key + decrypt client‑side]
    I --> J[Secret burned forever]

    style D fill:#66ccff
    style E fill:#ffcc66
```

### URL format
`/secret/{blobId}#K1_b64url.IV_b64url.claimId.token_b64url`

- `blobId`: Walrus content address for ciphertext
- `K1`, `IV`: client‑only; never sent to server (URL fragment)
- `claimId`, `token`: authenticate one‑time claim for `K2`

## 🔬 Detailed flow

```mermaid
sequenceDiagram
    participant U as Creator
    participant FE as Browser
    participant API as Claim API
    participant W as Walrus
    participant R as Recipient

    U->>FE: Enter secret
    FE->>FE: AES‑256‑GCM encrypt
    FE->>FE: Split key K = K1 ⊕ K2
    FE->>W: PUT [IV|ciphertext]
    W-->>FE: blobId
    FE->>API: POST /api/claim/init {K2, ttl, maxUses}
    API-->>FE: claimId, token
    FE->>U: Share link /secret/{blobId}#K1.IV.claimId.token

    U->>R: Send link
    R->>FE: Open link
    FE->>API: POST /api/claim {claimId, token}
    API-->>FE: K2 (once or up to maxUses)
    FE->>W: GET /v1/blobs/{blobId}
    W-->>FE: [IV|ciphertext]
    FE->>FE: Reconstruct K and decrypt
    FE-->>R: Show secret; display uses remaining
```

## 🧩 Architecture

```mermaid
graph TB
  subgraph App
    UI[React UI]
    CRYPTO[crypto.ts]
    WALRUS[walrus.ts]
    API[/api/claim, /api/claim/init]
  end

  subgraph Walrus Network
    PUB[Publisher]
    AGG[Aggregator]
    STORE[Distributed Storage]
  end

  UI --> CRYPTO
  UI --> WALRUS
  UI --> API
  CRYPTO --> UI
  WALRUS --> PUB
  AGG --> UI

  style API fill:#ffcc66
  style STORE fill:#66ccff
  style CRYPTO fill:#99ff99
```

### Walrus endpoints (currently configured)
- Publisher: `http://walrus-publisher-testnet.haedal.xyz:9001/v1/blobs?deletable=true&epochs=1`
- Aggregator: `https://walrus-testnet.blockscope.net/v1/blobs/{blobId}`

## 🚀 Quickstart

Prereqs: Node 18+ recommended.

```bash
npm install
npm run dev
# open http://localhost:3000
```

Create a link:
1) Go to Create, paste secret or upload file.
2) Choose allowed views (1‑5). 
3) Generate link and share it.

## 🖥️ Usage

- Creator: Generate and share the link.
- Recipient: Open link, click Reveal. If first/allowed use, the secret is decrypted locally and shown. Subsequent attempts show “already burned” or “all uses exhausted.”

## 🔐 Security model

- **Zero‑knowledge**: Server never sees plaintext or full key.
- **Key separation**: K = K1 ⊕ K2; neither share alone is useful.
- **One‑time/multi‑use gate**: `maxUses` 1‑5 with atomic decrement.
- **Client‑side crypto**: Web Crypto API, AES‑256‑GCM.
- **Decentralized storage**: Ciphertext on Walrus; immutable and censorship‑resistant.

## 🛠️ API

- `POST /api/claim/init`
  - Body: `{ share2B64Url: string, ttlSeconds?: number, maxUses?: 1|2|3|4|5 }`
  - Resp: `{ claimId: string, token: string }`

- `POST /api/claim`
  - Body: `{ claimId: string, token: string }`
  - Resp: `{ share2B64Url: string, usesRemaining: number, maxUses: number }`

## ⚙️ Implementation notes

- Key split/URL helpers live in `src/app/lib/crypto.ts`.
- Walrus integration in `src/app/lib/walrus.ts`.
- Creation flow in `src/app/create/page.tsx` and `src/app/components`.
- Reveal flow in `src/app/secret/[blobId]/page.tsx`.

## 📦 Deployment (production tips)

- Replace in‑memory claim store with Redis/Upstash KV.
- Add rate‑limiting and monitoring.
- Point to Walrus mainnet endpoints when available.

## 🙌 Credits

Built with Next.js, React, Walrus, and Web Crypto API.

