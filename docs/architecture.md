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


## 13. AI routing: cloud key, on-device model, or both

Every AI feature (Ask advisor, SMS and email reading, category suggestions, OCR name clean-up, insight text) goes through one router. The user chooses where AI runs in Settings: no AI, their own cloud key, a model on this phone, or Auto. No feature is tied to one engine, and no feature is denied by either. The backend does no inference.

```mermaid
flowchart TD
    F[Feature: advisor, ingestion, categorise, ocr, insight] --> R{AiRouter mode for this feature}
    R -->|off| RULES[Rules only: parseSms, parseEmail, categorise]
    R -->|cloud| C[Cloud provider]
    R -->|device| D[On-device provider]
    R -->|auto| D
    D -->|missing, failed or low confidence| FB{Cloud allowed in Auto?}
    FB -->|yes| C
    FB -->|no| RULES
    C --> G{Needs message text?}
    G -->|no: advisor, insight| SEND[Send aggregates only]
    G -->|yes| K{Consent for this provider?}
    K -->|no| RULES
    K -->|yes| RED[Redact, verify, send]
    D --> LOCAL[Original text, never leaves the phone]
```

Modes and overrides. Preferences live in their own persisted store (`lib/ai/prefs.ts`, key `bacchat.ai`): `aiMode` (off, cloud, device, auto), `aiFeatureModes` (overrides for advisor, ingestion, categorise; OCR follows categorise and insight follows advisor), provider choice, OpenAI-compatible base URL and model, `aiAutoCloudFallback`, `aiActiveModelId`, and `aiConsent` (provider key to the time it was given). API keys are never in preferences: the Anthropic key and model stay where they were (secure store), and the OpenAI-compatible key is in the secure store under `bacchat.ai.openai.key`.

Layers.

```mermaid
flowchart LR
    UI[Settings AiSection, Ask k18] --> SVC[services/aiService]
    ING[ingestService] -->|extractor| SVC
    SVC --> RT[lib/ai/router AiRouter]
    RT --> EX[extract.ts rules first, validated model reading]
    RT --> ADV[client.ts createAdvisor loop and read-only tools]
    RT --> P1[AnthropicProvider]
    RT --> P2[OpenAICompatibleProvider]
    RT --> P3[OnDeviceProvider]
    P3 --> NATIVE[modules/bacchat-llm over llama.rn and llama.cpp]
    SVC --> DL[ModelDownloadManager and ModelRegistry]
```

Privacy boundaries.

- Advisor and insights: only the aggregates the read-only tools return. Each tool result is also scanned for payee names, account names, UPI ids, notes and message references and blocked on a hit. This is the same on every engine.
- Message reading, tagging and OCR clean-up need raw text. On the phone's model the original text is used and nothing leaves the phone. For a cloud provider the text is redacted first (`lib/ai/redact.ts`): OTPs and codes, balances and limits, card and account numbers (last 4 kept), phone numbers (also inside UPI handles), email addresses (domain kept), PAN and Aadhaar. The amount, date, payee name, last-4 digits and UPI handle stay, because they are what the model must read. A second check refuses to send text that still matches a sensitive pattern. Text the rules call not-a-payment (OTPs, offers, reminders) never goes to any model.
- Consent: a cloud provider is called for message text only after explicit, one-time consent for that provider (a self-hosted endpoint counts per host). The router leaves the cloud engine out of the plan without consent, and a guard on the provider re-checks at call time, so withdrawing consent stops calls at once. Settings shows a calm disclosure line next to the switch. When a message is read by rules only because consent is missing, Settings says so once.
- Nothing is logged: prompts, message text, model output and keys never reach a log. Errors shown to people are the calm fixed messages in `lib/ai/errors.ts`.

Hybrid ingestion. `extractTransaction(text, ctx)` runs the rule parser first and accepts it at confidence 0.75 or more. Otherwise the router asks a model for strict JSON (amount as printed, direction, merchant, time, method, last-4, UPI id, category name from the user's list). The answer must pass a schema and then cross-checks: the amount must appear in the original text, must not equal the balance or limit, and must agree with the rule parser when it found something; digits, UPI id and merchant must be present in the text or are dropped; the category must be one of the user's. A failed check is sent back to the model once with the reason, then refused. Accepted readings become normal candidates and the pipeline stores them To review and AI added. In Auto, a low-confidence device answer hands over to the cloud only if the user allowed fallback and gave consent.

On-device model lifecycle.

```mermaid
stateDiagram-v2
    [*] --> NotDownloaded
    NotDownloaded --> Downloading: Download (Range resume, free space check)
    Downloading --> Paused: Pause or network drop (partial file kept)
    Paused --> Downloading: Resume
    Downloading --> Verifying: all bytes received
    Verifying --> Installed: checksum ok or unpinned
    Verifying --> NotDownloaded: checksum mismatch (file removed)
    Installed --> Active: Use this
    Active --> Loaded: first request loads the GGUF
    Loaded --> Installed: unload on memory pressure or delete
    Installed --> NotDownloaded: Delete
```

Models are never bundled. The registry lists small GGUF models with size, RAM need, licence and chat template. The engine loads a model lazily on the first request and keeps one loaded. Tool use is emulated with a small JSON protocol checked against each tool's schema, with repair attempts; JSON output uses grammar-constrained decoding when the engine supports it.
