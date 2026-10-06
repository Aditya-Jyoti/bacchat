# Architecture

How Bacchat is put together. Items marked "planned" are intended design and may change as the code lands; see [decisions.md](decisions.md) for the reasoning and [backend.md](backend.md) for the sync service.

## 1. System context

Everything runs on the phone by default. The only network traffic is anonymous public NAV fetches, optional encrypted sync, and optional calls to the user's own AI provider.

```mermaid
flowchart LR
    U[User] --> APP[Bacchat app on Android]
    APP --> DB[(SQLCipher database on device)]
    APP --> KS[Android Keystore]
    APP -->|encrypted blobs, opt-in| BE[Bacchat Cloud backend]
    APP -->|encrypted blobs, opt-in| GD[Google Drive app folder]
    APP -->|encrypted blobs, opt-in| WS[WebDAV or S3 server]
    APP -->|anonymous GET| NAV[AMFI daily NAV file and NPS NAV pages]
    APP -->|aggregates only, own API key| AI[User's AI provider]
    SMS[SMS and notifications] -->|read on device| APP
    SH[Share intent from other apps] --> APP
```

## 2. Frontend layering

Dependencies point downward only. Screens never touch the database or native modules directly.

```mermaid
flowchart TD
    SC[screens: one folder per tab, one component per k-id] --> CO[components: shared and custom]
    SC --> ST[state store: zustand]
    CO --> TH[theme: colour, type, shape]
    SC --> TH
    ST --> RE[data: repositories]
    RE --> DB[(local database, SQLCipher)]
    ST --> LI[lib: format, reconcile, sync client, AI client]
    LI --> RE
    LI --> NM[native modules]
    NM --> N1[SMS and notification reader]
    NM --> N2[share intent receiver]
    NM --> N3[keystore and biometrics]
    NM --> N4[Material You dynamic colour]
    NAV[navigation] --> SC
```

Folder map (planned, matches CLAUDE.md): `frontend/src/theme`, `components`, `screens`, `navigation`, `data`, `lib`.

## 3. Theming pipeline

```mermaid
flowchart LR
    A[Wallpaper dynamic scheme via native module] --> B[Convert roles to oklch]
    B --> C{Contrast at least 4.5 to 1 in both modes?}
    C -->|yes| D[Clamp surfaces to paper and brown-black]
    C -->|no| F[khata fallback: khataPalette hue 45]
    E[Android below 12 or module missing] --> F
    D --> G[Add fixed roles: caution, chart2 to chart4]
    F --> G
    G --> H[BacchatTheme]
    H --> I[Paper MD3 theme adapter]
    H --> J[useTheme hook for custom components]
```

- `oklch.ts` converts oklch to sRGB hex. Screens never hold hex values; they read roles from the hook.
- The Paper adapter maps BacchatTheme roles onto react-native-paper's `MD3Theme` so standard components inherit Khata colours, fonts and shapes.
- The check runs on every scheme change (wallpaper change, light or dark switch).

## 4. Navigation structure

Bottom tabs hold a native stack each. The tab bar is visible only on the five tab roots. Sheets and dialogs are modal routes over their parent. The full route table is in [screens.md](screens.md).

```mermaid
flowchart TD
    ROOT[Root stack] --> START[Start stack: k21 Splash, k22 Welcome]
    ROOT --> TABS[Bottom tabs]
    ROOT --> MOD[Modal routes: k6, k9, k18, k27]
    TABS --> T1[Home stack: k1, k2]
    TABS --> T2[Money stack: k3 and k4 toggle, k5, k7, k8, k19, k28]
    TABS --> T3[Goals stack: k12, k13, k14]
    TABS --> T4[You stack: k23, k10, k11, k15, k16, k17, k24, k25, k26]
```

Deep links (planned): share image to k7, "From SMS" notification to k4 filtered to To review, launcher shortcut to k5.

## 5. Data model

Money is integer paise. Every table carries `id`, `updatedAt`, `deletedAt` (tombstone, used by sync). Field lists are planned.

```mermaid
erDiagram
    ACCOUNT ||--o{ ENTRY : holds
    ACCOUNT ||--o{ FUND_HOLDING : holds
    ACCOUNT ||--o| DEBT_CARD : "may be"
    DEBT_CARD ||--o{ ENTRY : "charged to"
    ENTRY ||--|{ ENTRY_SOURCE : "seen from"
    CATEGORY ||--o{ ENTRY : tags
    CATEGORY ||--o{ BUDGET : limits
    MERCHANT ||--o{ ENTRY : paid
    MERCHANT }o--|| CATEGORY : "usually in"
    UPI_ID ||--o{ ENTRY : "moved through"
    GOAL ||--o{ GOAL_ALLOCATION : receives
    ACCOUNT ||--o{ GOAL_ALLOCATION : funds
    RECURRING }o--|| CATEGORY : "tagged"
    RECURRING }o--o| ACCOUNT : "paid from"

    ACCOUNT {
        string id
        string name
        string kind
        int balancePaise
    }
    DEBT_CARD {
        string accountId
        int dueDay
        int outstandingPaise
        int limitPaise
    }
    ENTRY {
        string id
        int amountPaise
        string direction
        datetime at
        string note
        bool toReview
    }
    ENTRY_SOURCE {
        string entryId
        string kind
        string rawRef
        bool aiAdded
    }
    CATEGORY {
        string id
        string name
        string icon
    }
    MERCHANT {
        string id
        string name
        string categoryId
    }
    GOAL {
        string id
        string name
        int targetPaise
        date targetDate
    }
    GOAL_ALLOCATION {
        string goalId
        string accountId
        int amountPaise
    }
    BUDGET {
        string categoryId
        int monthlyPaise
    }
    RECURRING {
        string id
        string title
        int amountPaise
        string cadence
        date nextDue
    }
    UPI_ID {
        string id
        string handle
        string label
    }
    FUND_HOLDING {
        string id
        string schemeCode
        int unitsMicro
        int lastNavPaise
    }
```

`ENTRY_SOURCE.kind` is one of SMS, Email, Screenshot, By hand. An entry matched by a second source gains another row here rather than a duplicate entry. Screenshots themselves stay on the device and do not sync by default.

## 6. Reconciliation (screenshot import)

A screenshot is read with on-device OCR (k7), parsed into candidate rows, then each row is compared with entries on the same day. Rule: amount (exact) + time (within 10 minutes) + merchant (fuzzy).

```mermaid
flowchart TD
    A[Candidate row from screenshot] --> B[Load same-day entries]
    B --> C{Score: amount, time within 10 min, merchant fuzzy}
    C -->|all three agree| M[Matched: skip row, existing entry gains a second source]
    C -->|two of three agree| X[Conflict: blocks import until resolved in k9]
    C -->|otherwise| N[New: add entry]
    N --> N1{Merchant seen before?}
    N1 -->|yes| N2[Infer category from merchant history]
    N1 -->|no| N3[Mark Pick a category]
    X --> R{Saved local rule for this merchant?}
    R -->|trust screenshots| K[Keep screenshot row]
    R -->|none| U[User picks keep A, keep B or both]
    U --> RL[Optional: save rule trust screenshots for merchant]
```

```mermaid
sequenceDiagram
    actor User
    participant K7 as k7 Reading
    participant OCR as OCR parser
    participant REC as reconcile lib
    participant REPO as repositories
    participant K8 as k8 Review
    participant K9 as k9 Conflict sheet
    User->>K7: Share screenshot
    K7->>OCR: Image
    OCR-->>K7: Candidate rows
    K7->>REC: rows
    REC->>REPO: entries for same days
    REPO-->>REC: existing entries
    REC-->>K8: Matched, Conflict, New lists
    User->>K8: Tap conflict row
    K8->>K9: Open sheet
    User->>K9: Keep A, keep B or both (optional rule)
    K9-->>K8: Resolution
    User->>K8: Add entries
    K8->>REPO: Insert New rows, add sources to Matched, apply resolutions
```

The reconcile function is pure (rows and entries in, classification out) so it is unit tested without UI. Thresholds are constants in one file.

## 7. SMS and email AI ingestion

Reading happens on the device. The default parser is rule-based; the user's own AI model is used only if they enable it, and then only the message text needed to extract a transaction is sent (planned, opt-in).

```mermaid
sequenceDiagram
    participant OS as Android
    participant NM as SMS and notification module
    participant P as Parser
    participant AI as User AI provider (optional)
    participant REC as reconcile lib
    participant DB as Local database
    participant UI as k4 Entries
    OS->>NM: New SMS or bank notification
    NM->>P: Message text and time
    P->>P: Rules: amount, merchant, direction, card or UPI id
    alt rules cannot parse and AI enabled
        P->>AI: Redacted message text
        AI-->>P: Structured fields
    end
    P->>REC: Candidate entry
    REC->>DB: Look for same-day match
    alt matched
        REC->>DB: Add source to existing entry
    else new
        REC->>DB: Insert entry with toReview true, source SMS
    end
    DB-->>UI: Entry shows dashed outline and To review tag
    UI->>DB: User confirms by tap or swipe right
```

Rules: AI-added entries are flagged until confirmed. A notification "From SMS" deep links to k4 filtered to To review. The reader needs the SMS or notification-listener permission; without it the rest of the app works.

## 8. AI advisor

The advisor is an MCP-style client inside the app. Tools are read-only functions over local data that return aggregates.

```mermaid
sequenceDiagram
    actor User
    participant K18 as k18 Ask sheet
    participant AIC as AI client (lib)
    participant T as Read-only tools
    participant DB as Local database
    participant P as User's AI provider
    User->>K18: Ask a question
    K18->>AIC: Question
    AIC->>P: Question, tool list, own API key
    P-->>AIC: Call tool goals or cash_flow or card_dues or affordability
    AIC->>T: Run tool
    T->>DB: Query
    DB-->>T: Rows
    T-->>AIC: Aggregates only
    AIC-->>K18: Show tool chip
    AIC->>P: Tool result
    P-->>AIC: Answer text
    AIC-->>K18: Answer
```

- Tools are read-only; there is no tool that writes or deletes.
- Only aggregates leave the device (totals, counts, dates). No raw SMS text, account names or UPI handles. The sheet says so.
- The API key is stored in the Keystore-backed secure store, never in the database or sync blobs.
- Opened from the Ask pill, an Ask row in You, and insight cards. Always a bottom sheet, never a takeover.

## 9. Sync

Sync is off by default. The client derives a key from a passphrase, encrypts each blob locally, and exchanges it with a server that cannot read it. Blob names are opaque (planned: one blob per table snapshot or per change batch).

```mermaid
sequenceDiagram
    actor User
    participant App as Sync client
    participant K as Key derivation
    participant S as Server (Bacchat Cloud, Drive or WebDAV/S3)
    User->>App: Set passphrase (k25)
    App->>K: Argon2id(passphrase, salt)
    K-->>App: 256-bit key (kept in Keystore)
    App-->>User: Offer recovery key
    User->>App: Sync now (k26)
    App->>S: GET /v1/blobs (names, versions)
    S-->>App: Remote versions
    App->>App: Pull newer blobs, decrypt XChaCha20-Poly1305
    App->>App: Merge with local changes
    App->>S: PUT /v1/blobs/:name with baseVersion
    alt baseVersion is current
        S-->>App: 200 new version
    else someone else pushed first
        S-->>App: 409 with current version
        App->>S: GET /v1/blobs/:name
        App->>User: k9 resolve pattern (keep A, keep B, both)
        User-->>App: Resolution
        App->>S: PUT with updated baseVersion
    end
```

- Nonce: 24 random bytes per blob (XChaCha20 permits random nonces). Blob name is bound as associated data.
- Last-writer-wins is not used for conflicting rows; the user resolves them with the k9 pattern.
- Screenshots are excluded unless the user turns them on.

## 10. Security model

```mermaid
flowchart TD
    subgraph Device
      DB[(SQLCipher database)] --- DK[DB key in Keystore]
      LOCK[Optional biometric app lock] --> DK
      AK[AI API key in secure store]
      SK[Sync key from passphrase]
    end
    subgraph Network
      ENC[Ciphertext blobs only]
    end
    SK --> ENC
    ENC --> SRV[Server sees names, sizes, versions, account token]
```

| Asset | Protection |
|---|---|
| Local data | SQLCipher at rest; key in Android Keystore; optional biometric lock |
| Sync data | Encrypted on device before upload; server never has the key |
| Passphrase | Never leaves the device; Argon2id stretches it; recovery key offered |
| AI key | Secure store; sent only to the chosen provider |
| Account on server | Random token from register; stored as a hash on the server |
| Public fetches | Anonymous; no identifiers sent |

Out of scope: a rooted or compromised phone, and weak passphrases chosen by the user (the UI nudges toward the recovery key). See [backend.md](backend.md) for the server threat model.

## 11. Deployment

```mermaid
flowchart LR
    DEV[Developer] --> GH[GitHub repo and Actions]
    GH -->|docker build| IMG[bacchat-backend image]
    IMG --> C
    subgraph HOST[Docker host]
      C[Container: Node 20, port 8080]
      V[(Volume mounted at /data)]
      C --- V
    end
    PHONE[Bacchat app] -->|HTTPS via reverse proxy| C
    GH -->|EAS or local build| APK[Android build]
    APK --> PHONE
```

TLS is terminated by a reverse proxy in front of the container (planned guidance in backend.md). The app can point at any compatible host, so self-hosting is first class.

## 12. Performance and offline notes

- Offline first: every screen works with no network. Network failures only affect NAV refresh, AI and sync, and each shows a calm inline state.
- Lists use `FlatList` or FlashList with fixed row heights (56-60) so Entries scales to tens of thousands of rows. Summaries are computed by SQL aggregates, not in JS loops.
- Index entries on `(at)`, `(accountId, at)` and `(categoryId, at)` (planned).
- Charts are small SVG components; scrubbing updates a shared value so no full re-render per frame. Skia only where SVG is too slow.
- SQLCipher open and key derivation happen behind the splash (k21); first paint uses cached Home data.
- NAV refresh is once a day in the background, cached, and skipped on metered or offline connections.
- Sync pushes only changed blobs and compresses before encrypting. Compressing after encryption is useless, so order matters.
- Fonts (Young Serif, Figtree) load before the splash hides; fallback to system serif and sans if they fail.
- Font scale to 200% and reduce motion are honoured; animations use the native driver or Reanimated worklets.
