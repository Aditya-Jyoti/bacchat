# Bacchat — Backend API Specification

> **Currency:** All monetary amounts are in **INR (₹)** as decimal numbers (e.g. `1234.50`).  
> **Dates:** ISO 8601 UTC strings — `"2024-11-15T10:30:00Z"`.  
> **Auth:** JWT Bearer tokens. Include `Authorization: Bearer <token>` on every request except `/auth/*` and `GET /invite/:code`.  
> **Errors:** Every error response follows the shape `{ "error": "Human-readable message" }` with the appropriate HTTP status code.

---

## Base URL

```
https://api.bacchat.app/v1
```

---

## Common Response Envelope

Successful responses return data directly (no wrapper object), except for paginated lists which may add `meta` in the future. Keep it flat for now.

---

## 1. Auth

### `POST /auth/signup`

Create a new account.

**Request body**
```json
{
  "name": "Aditya Jyoti",
  "email": "aj@example.com",
  "password": "secret123"
}
```

**Validations**
- `name` — required, non-empty string
- `email` — required, valid email, unique across users
- `password` — required, minimum 6 characters

**Response `201`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "name": "Aditya Jyoti",
    "email": "aj@example.com",
    "avatar_url": null,
    "is_guest": false,
    "created_at": "2024-11-15T10:30:00Z"
  }
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `409` | Email already registered |
| `422` | Validation failed |

---

### `POST /auth/login`

Authenticate with email + password.

**Request body**
```json
{
  "email": "aj@example.com",
  "password": "secret123"
}
```

**Response `200`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "name": "Aditya Jyoti",
    "email": "aj@example.com",
    "avatar_url": null,
    "is_guest": false,
    "created_at": "2024-11-15T10:30:00Z"
  }
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `401` | No account found with that email, or wrong password |

---

### `POST /auth/guest`

Create an anonymous guest session. No body required.

**Request body** — empty `{}`

**Response `201`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 42,
    "name": "Guest",
    "email": null,
    "avatar_url": null,
    "is_guest": true,
    "created_at": "2024-11-15T10:30:00Z"
  }
}
```

---

### `POST /auth/logout`

Invalidate the current token (server-side token denylist).

**Auth:** Required  
**Request body** — empty `{}`  
**Response `204`** — no body

---

### `GET /auth/me`

Return the currently authenticated user.

**Auth:** Required  
**Response `200`**
```json
{
  "id": 1,
  "name": "Aditya Jyoti",
  "email": "aj@example.com",
  "avatar_url": null,
  "is_guest": false,
  "created_at": "2024-11-15T10:30:00Z"
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `401` | Token missing or expired |

---

## 2. Groups

### `GET /groups`

All groups the authenticated user is a member of, with their net balance in each group.

**Auth:** Required  
**Response `200`**
```json
[
  {
    "id": 7,
    "name": "Goa Trip",
    "emoji": "🏖️",
    "member_count": 4,
    "net_balance": 1250.00,
    "invite_code": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "created_at": "2024-11-15T10:30:00Z"
  },
  {
    "id": 8,
    "name": "Flat",
    "emoji": "🏠",
    "member_count": 3,
    "net_balance": -400.00,
    "invite_code": "c8a3e9d2-1f7b-4a56-b890-2c4d6e8f0a12",
    "created_at": "2024-11-10T08:00:00Z"
  }
]
```

**`net_balance` semantics:**
- `> 0` — others owe you money (you are owed)
- `< 0` — you owe others money
- `≈ 0` (within ₹0.01) — settled

---

### `POST /groups`

Create a new group. The creator is automatically added as an admin member.

**Auth:** Required  
**Request body**
```json
{
  "name": "Goa Trip",
  "emoji": "🏖️"
}
```

**Validations**
- `name` — required, non-empty
- `emoji` — optional, defaults to `"💸"`

**Response `201`**
```json
{
  "id": 7,
  "name": "Goa Trip",
  "emoji": "🏖️",
  "member_count": 1,
  "net_balance": 0.0,
  "invite_code": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "created_at": "2024-11-15T10:30:00Z"
}
```

---

### `GET /groups/:groupId`

Full detail for one group — includes member list.

**Auth:** Required. User must be a member of this group.  
**Response `200`**
```json
{
  "id": 7,
  "name": "Goa Trip",
  "emoji": "🏖️",
  "invite_code": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "created_at": "2024-11-15T10:30:00Z",
  "members": [
    {
      "id": 1,
      "name": "Aditya Jyoti",
      "is_guest": false,
      "is_admin": true
    },
    {
      "id": 3,
      "name": "Ravi",
      "is_guest": false,
      "is_admin": false
    },
    {
      "id": 42,
      "name": "Priya",
      "is_guest": true,
      "is_admin": false
    }
  ]
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `403` | Authenticated user is not a member |
| `404` | Group not found |

---

### `GET /invite/:inviteCode`

Look up a group by invite code. **No auth required** — this is the guest entry point.

**Response `200`**
```json
{
  "group_id": 7,
  "name": "Goa Trip",
  "emoji": "🏖️",
  "member_count": 3
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `404` | Invite code not found |

---

### `POST /invite/:inviteCode/join`

Join a group via invite link. Works for both existing users and new guests.

**Auth:** Optional.  
- If a valid `Authorization` header is present → add that user to the group and return the updated group detail.  
- If no auth → create a guest user with the provided `name`, issue a token, add them to the group.

**Request body**
```json
{
  "name": "Priya"
}
```

`name` is **required only when not authenticated** (guest join). Ignored if the user already has an account.

**Response `200`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 42,
    "name": "Priya",
    "email": null,
    "avatar_url": null,
    "is_guest": true,
    "created_at": "2024-11-15T11:00:00Z"
  },
  "group": {
    "id": 7,
    "name": "Goa Trip",
    "emoji": "🏖️",
    "invite_code": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "created_at": "2024-11-15T10:30:00Z",
    "members": [ ... ]
  }
}
```

`token` is `null` if the caller was already authenticated.

**Errors**
| Status | Condition |
|--------|-----------|
| `400` | Not authenticated and `name` is missing |
| `404` | Invite code not found |
| `409` | User is already a member of this group |

---

## 3. Splits

### `GET /groups/:groupId/splits`

All splits in a group, sorted newest first.

**Auth:** Required. User must be a member.  
**Response `200`**
```json
[
  {
    "id": 101,
    "title": "Hotel checkout",
    "description": "Four nights at Taj Calangute",
    "category": "other",
    "total_amount": 12000.00,
    "paid_by_id": 1,
    "paid_by_name": "Aditya Jyoti",
    "share_count": 4,
    "created_at": "2024-11-14T22:00:00Z"
  },
  {
    "id": 99,
    "title": "Dinner at Fisherman's Wharf",
    "description": null,
    "category": "food",
    "total_amount": 3200.00,
    "paid_by_id": 3,
    "paid_by_name": "Ravi",
    "share_count": 4,
    "created_at": "2024-11-14T20:30:00Z"
  }
]
```

**`category` enum values:** `food` · `transport` · `entertainment` · `rent` · `utilities` · `other`

---

### `POST /groups/:groupId/splits`

Create a new split. The backend must persist both the split and all share rows atomically.

**Auth:** Required. User must be a member.  
**Request body**
```json
{
  "title": "Dinner at Fisherman's Wharf",
  "description": "Prawns and beer",
  "category": "food",
  "total_amount": 3200.00,
  "paid_by": 1,
  "split_type": "custom",
  "shares": [
    { "user_id": 1, "amount": 800.00 },
    { "user_id": 3, "amount": 800.00 },
    { "user_id": 42, "amount": 1600.00 }
  ]
}
```

**Field notes**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | — |
| `description` | string | no | nullable |
| `category` | string | yes | one of the enum values above |
| `total_amount` | number | yes | must be > 0 |
| `paid_by` | integer | yes | must be a member of the group |
| `split_type` | string | yes | `"equal"` or `"custom"` |
| `shares` | array | yes | at least one entry; all `user_id`s must be group members |

**Validations**
- Sum of `shares[].amount` must equal `total_amount` (within ₹0.01 tolerance)
- All `user_id` values in shares must be members of the group
- `paid_by` must be a member of the group

**Response `201`**
```json
{
  "id": 99,
  "group_id": 7,
  "title": "Dinner at Fisherman's Wharf",
  "description": "Prawns and beer",
  "category": "food",
  "total_amount": 3200.00,
  "paid_by_id": 1,
  "paid_by_name": "Aditya Jyoti",
  "split_type": "custom",
  "created_at": "2024-11-14T20:30:00Z",
  "shares": [
    { "id": 301, "user_id": 1, "user_name": "Aditya Jyoti", "amount": 800.00, "is_settled": false },
    { "id": 302, "user_id": 3, "user_name": "Ravi",         "amount": 800.00, "is_settled": false },
    { "id": 303, "user_id": 42, "user_name": "Priya",       "amount": 1600.00, "is_settled": false }
  ]
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `400` | Shares don't sum to total, or unknown user in shares |
| `403` | User not a member of group |
| `404` | Group not found |
| `422` | Validation failed |

---

### `GET /splits/:splitId`

Full detail for one split, including all shares with user names.

**Auth:** Required. User must be a member of the group this split belongs to.  
**Response `200`**
```json
{
  "id": 99,
  "group_id": 7,
  "title": "Dinner at Fisherman's Wharf",
  "description": "Prawns and beer",
  "category": "food",
  "total_amount": 3200.00,
  "paid_by_id": 1,
  "paid_by_name": "Aditya Jyoti",
  "split_type": "custom",
  "created_at": "2024-11-14T20:30:00Z",
  "shares": [
    { "id": 301, "user_id": 1,  "user_name": "Aditya Jyoti", "amount": 800.00,  "is_settled": false },
    { "id": 302, "user_id": 3,  "user_name": "Ravi",         "amount": 800.00,  "is_settled": true  },
    { "id": 303, "user_id": 42, "user_name": "Priya",        "amount": 1600.00, "is_settled": false }
  ]
}
```

---

### `PATCH /shares/:shareId/settle`

Mark one share as settled.

**Auth:** Required. Only the person who paid for the split (the creditor) or a group admin may settle shares.  
**Request body** — empty `{}`  
**Response `200`**
```json
{
  "id": 302,
  "user_id": 3,
  "user_name": "Ravi",
  "amount": 800.00,
  "is_settled": true
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| `403` | Not the payer or an admin |
| `404` | Share not found |
| `409` | Share is already settled |

---

### `POST /splits/:splitId/settle-all`

Settle every unsettled share in a split at once.

**Auth:** Required. Payer or group admin only.  
**Request body** — empty `{}`  
**Response `200`** — returns the full split detail (same shape as `GET /splits/:splitId`) with all shares showing `"is_settled": true`.

---

## 4. Balance

### `GET /groups/:groupId/balance`

Returns both the raw (per-split) debts and the minimum-transaction simplified debts for a group. The debt simplification (minimum cash flow algorithm) runs server-side.

**Auth:** Required. User must be a member.  
**Response `200`**
```json
{
  "raw_debts": [
    {
      "debtor_id": 3,
      "debtor_name": "Ravi",
      "creditor_id": 1,
      "creditor_name": "Aditya Jyoti",
      "amount": 800.00,
      "split_title": "Dinner at Fisherman's Wharf",
      "split_id": 99
    },
    {
      "debtor_id": 42,
      "debtor_name": "Priya",
      "creditor_id": 1,
      "creditor_name": "Aditya Jyoti",
      "amount": 1600.00,
      "split_title": "Dinner at Fisherman's Wharf",
      "split_id": 99
    },
    {
      "debtor_id": 1,
      "debtor_name": "Aditya Jyoti",
      "creditor_id": 3,
      "creditor_name": "Ravi",
      "amount": 500.00,
      "split_title": "Cab to airport",
      "split_id": 101
    }
  ],
  "simplified": [
    {
      "debtor_id": 42,
      "debtor_name": "Priya",
      "creditor_id": 1,
      "creditor_name": "Aditya Jyoti",
      "amount": 1600.00,
      "chain": [
        {
          "debtor_id": 42,
          "debtor_name": "Priya",
          "creditor_id": 1,
          "creditor_name": "Aditya Jyoti",
          "amount": 1600.00,
          "split_title": "Dinner at Fisherman's Wharf",
          "split_id": 99
        }
      ]
    },
    {
      "debtor_id": 3,
      "debtor_name": "Ravi",
      "creditor_id": 1,
      "creditor_name": "Aditya Jyoti",
      "amount": 300.00,
      "chain": [
        {
          "debtor_id": 3,
          "debtor_name": "Ravi",
          "creditor_id": 1,
          "creditor_name": "Aditya Jyoti",
          "amount": 800.00,
          "split_title": "Dinner at Fisherman's Wharf",
          "split_id": 99
        },
        {
          "debtor_id": 1,
          "debtor_name": "Aditya Jyoti",
          "creditor_id": 3,
          "creditor_name": "Ravi",
          "amount": 500.00,
          "split_title": "Cab to airport",
          "split_id": 101
        }
      ]
    }
  ]
}
```

**Notes**
- `raw_debts` — only unsettled shares; one entry per (debtor, creditor, split) triple. Excludes shares where `debtor_id == creditor_id` (the payer's own share).
- `simplified` — the result of the minimum cash flow algorithm. Each entry has a `chain` array of the raw debts that explain that payment (used by the "Why?" expand in the UI).
- If all shares are settled, both arrays are empty.

---

## 5. Budget

### `GET /budget`

Full budget overview for the authenticated user, computed for the **current calendar month**.

**Auth:** Required  
**Response `200`**
```json
{
  "settings": {
    "monthly_income": 80000.00,
    "monthly_savings_goal": 20000.00,
    "updated_at": "2024-11-01T00:00:00Z"
  },
  "categories": [
    {
      "id": 5,
      "name": "Rent",
      "icon": "🏠",
      "monthly_limit": 20000.00,
      "is_fixed": true,
      "spent_this_month": 20000.00
    },
    {
      "id": 6,
      "name": "Food",
      "icon": "🍔",
      "monthly_limit": 8000.00,
      "is_fixed": false,
      "spent_this_month": 3200.00
    }
  ],
  "total_spent_this_month": 23200.00
}
```

**Response `204`** if the user has not set up a budget yet (no settings row). The frontend shows a "Set up budget" prompt in this case.

---

### `PUT /budget/settings`

Create or update the user's monthly budget settings (upsert).

**Auth:** Required  
**Request body**
```json
{
  "monthly_income": 80000.00,
  "monthly_savings_goal": 20000.00
}
```

**Validations**
- Both fields required, must be ≥ 0

**Response `200`**
```json
{
  "monthly_income": 80000.00,
  "monthly_savings_goal": 20000.00,
  "updated_at": "2024-11-15T10:30:00Z"
}
```

---

### `POST /budget/categories`

Add a new budget category for the user.

**Auth:** Required  
**Request body**
```json
{
  "name": "Phone Bill",
  "icon": "📱",
  "monthly_limit": 999.00,
  "is_fixed": true
}
```

**Response `201`**
```json
{
  "id": 9,
  "name": "Phone Bill",
  "icon": "📱",
  "monthly_limit": 999.00,
  "is_fixed": true,
  "spent_this_month": 0.0
}
```

---

### `PUT /budget/categories/:categoryId`

Update an existing category.

**Auth:** Required. Must own this category.  
**Request body** — same shape as `POST /budget/categories`  
**Response `200`** — updated category object (same shape as `POST` response)

**Errors**
| Status | Condition |
|--------|-----------|
| `403` | Category belongs to a different user |
| `404` | Category not found |

---

### `DELETE /budget/categories/:categoryId`

Delete a category. Associated transaction `category_id` references should be set to `null`.

**Auth:** Required. Must own this category.  
**Response `204`** — no body

---

## 6. Transactions

Transactions represent actual money movements (expenses and income) tied to the user. Split shares that get created automatically are **not** transactions — those live in `split_shares`. Transactions are for personal budget tracking.

### `GET /transactions`

All transactions for the authenticated user, sorted newest first.

**Auth:** Required  
**Query params**
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `month` | `YYYY-MM` | current month | Filter to a specific month |
| `category_id` | integer | — | Filter to one category |
| `type` | `expense` \| `income` | — | Filter by type |

**Response `200`**
```json
[
  {
    "id": 201,
    "title": "Groceries",
    "amount": 1500.00,
    "type": "expense",
    "category_id": 6,
    "category_name": "Food",
    "split_id": null,
    "date": "2024-11-15T09:00:00Z"
  },
  {
    "id": 200,
    "title": "November salary",
    "amount": 80000.00,
    "type": "income",
    "category_id": null,
    "category_name": null,
    "split_id": null,
    "date": "2024-11-01T00:00:00Z"
  }
]
```

---

### `POST /transactions`

Log a new expense or income entry.

**Auth:** Required  
**Request body**
```json
{
  "title": "Groceries",
  "amount": 1500.00,
  "type": "expense",
  "category_id": 6,
  "split_id": null,
  "date": "2024-11-15T09:00:00Z"
}
```

**Field notes**
| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | — |
| `amount` | yes | must be > 0 |
| `type` | yes | `"expense"` or `"income"` |
| `category_id` | no | nullable; must belong to the authenticated user if provided |
| `split_id` | no | nullable; links to a split for context |
| `date` | no | defaults to server `now()` |

**Response `201`** — the created transaction object (same shape as the list items above)

---

### `DELETE /transactions/:transactionId`

Delete a transaction.

**Auth:** Required. Must own the transaction.  
**Response `204`** — no body

---

## 7. Profile

### `PUT /profile`

Update the authenticated user's profile.

**Auth:** Required  
**Request body**
```json
{
  "name": "Aditya J",
  "email": "new@example.com"
}
```

Both fields are optional — send only what needs to change.

**Validations**
- `email` — if provided, must be a valid email and unique
- Guests (`is_guest: true`) may provide an email here to upgrade their account

**Response `200`** — the updated user object
```json
{
  "id": 1,
  "name": "Aditya J",
  "email": "new@example.com",
  "avatar_url": null,
  "is_guest": false,
  "created_at": "2024-11-15T10:30:00Z"
}
```

---

## 8. HTTP Status Code Summary

| Code | Meaning |
|------|---------|
| `200` | OK — resource returned or updated |
| `201` | Created — new resource |
| `204` | No Content — success, no body |
| `400` | Bad Request — missing field, business rule violation |
| `401` | Unauthorized — token missing, expired, or invalid |
| `403` | Forbidden — authenticated but not allowed |
| `404` | Not Found |
| `409` | Conflict — duplicate email, already a member, etc. |
| `422` | Unprocessable Entity — field-level validation errors |
| `500` | Internal Server Error |

---

## 9. Auth Implementation Notes

- Tokens are **JWT**, signed with HS256 (or RS256 if you use a key pair).  
- Payload should include at minimum: `{ "sub": "<user_id>", "is_guest": false, "exp": <unix_ts> }`.  
- Token expiry: **30 days** for regular users, **7 days** for guests.  
- The `/auth/logout` route adds the token's `jti` (JWT ID) to a Redis denylist checked on every request.  
- Guest tokens can upgrade: if a guest calls `PUT /profile` with an email, set `is_guest = false` and issue a new token.

---

## 10. Database Notes for Backend

The Drift schema on the frontend maps 1:1 to these server tables. Suggested PostgreSQL schema:

```
users            (id, name, email, avatar_url, is_guest, created_at)
split_groups     (id, name, emoji, created_by → users, invite_code UNIQUE, created_at)
group_members    (id, group_id → split_groups, user_id → users, is_admin, joined_at)
splits           (id, group_id → split_groups, title, description, category, total_amount, paid_by → users, split_type, created_at)
split_shares     (id, split_id → splits, user_id → users, amount, is_settled)
budget_settings  (id, user_id → users UNIQUE, monthly_income, monthly_savings_goal, updated_at)
budget_categories(id, user_id → users, name, icon, monthly_limit, is_fixed)
transactions     (id, user_id → users, title, amount, type, category_id → budget_categories nullable, split_id → splits nullable, date)
```

---

## 11. Route Quick-Reference

```
POST   /auth/signup
POST   /auth/login
POST   /auth/guest
POST   /auth/logout                       🔐
GET    /auth/me                           🔐

GET    /groups                            🔐
POST   /groups                            🔐
GET    /groups/:groupId                   🔐
GET    /groups/:groupId/splits            🔐
POST   /groups/:groupId/splits            🔐
GET    /groups/:groupId/balance           🔐

GET    /invite/:inviteCode
POST   /invite/:inviteCode/join

GET    /splits/:splitId                   🔐
PATCH  /shares/:shareId/settle            🔐
POST   /splits/:splitId/settle-all        🔐

GET    /budget                            🔐
PUT    /budget/settings                   🔐
POST   /budget/categories                 🔐
PUT    /budget/categories/:categoryId     🔐
DELETE /budget/categories/:categoryId     🔐

GET    /transactions                      🔐
POST   /transactions                      🔐
DELETE /transactions/:transactionId       🔐

PUT    /profile                           🔐
```

🔐 = requires `Authorization: Bearer <token>` header
