# Engoal -- Technical Design Document

**Version:** 1.0
**Date:** 2026-02-22
**Author:** Alteeza Lab (AI Architect Agent)
**Status:** Draft -- Pending Orchestrator Review

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [API Design](#4-api-design)
5. [RAG Calculation Algorithm](#5-rag-calculation-algorithm)
6. [Security Design](#6-security-design)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Error Handling Strategy](#8-error-handling-strategy)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Architecture Overview

### 1.1 System Context

Engoal is a solo-user personal financial planning application. It tracks investments across multiple asset classes (Equity MFs, Debt MFs, Fixed Deposits, Gold, Real Estate), links them to financial goals, and uses a RAG (Red/Amber/Green) status system to show whether the user is on track to meet each goal.

### 1.2 Monorepo Structure

```
Engoal/
├── frontend/                 # Next.js 15 App Router (TypeScript)
│   ├── src/
│   │   ├── app/              # App Router pages and layouts
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # Utilities, API client, constants
│   │   ├── hooks/            # Custom React hooks
│   │   └── types/            # Shared TypeScript types
│   ├── public/               # Static assets
│   ├── tests/                # Vitest unit tests + Playwright E2E
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                  # FastAPI (Python 3.12+)
│   ├── app/
│   │   ├── api/              # Route handlers grouped by resource
│   │   │   ├── auth.py
│   │   │   ├── goals.py
│   │   │   ├── investments.py
│   │   │   ├── entries.py
│   │   │   └── dashboard.py
│   │   ├── core/             # Config, security, dependencies
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── deps.py
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic v2 request/response schemas
│   │   ├── services/         # Business logic layer
│   │   │   ├── rag.py        # RAG calculation engine
│   │   │   └── projection.py # Future value projection
│   │   ├── db/               # Database session, base model
│   │   │   ├── session.py
│   │   │   └── base.py
│   │   └── main.py           # FastAPI app factory
│   ├── alembic/              # Database migrations
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── tests/                # pytest test suite
│   ├── pyproject.toml        # uv / project config
│   └── .python-version
│
├── docker-compose.yml        # PostgreSQL + app services
├── .github/
│   └── workflows/
│       └── ci.yml            # CI pipeline
├── CLAUDE.md                 # Project-level Claude Code rules
└── engoal_technical_design.md
```

### 1.3 Request Flow

```
┌──────────────────┐       HTTPS        ┌──────────────────┐       SQL        ┌──────────────┐
│                  │ ────────────────>   │                  │ ──────────────>  │              │
│   Next.js 15     │   JSON over REST    │   FastAPI        │   SQLAlchemy     │ PostgreSQL   │
│   (Browser SPA)  │ <────────────────   │   (Python 3.12)  │ <──────────────  │     16       │
│                  │   JSON responses    │                  │   Query results  │              │
└──────────────────┘                     └──────────────────┘                  └──────────────┘
       │                                        │
       │ TanStack Query                         │ Pydantic v2
       │ (client-side cache)                    │ (validation + serialization)
       │                                        │
       ▼                                        ▼
  React 19 Components               Services Layer (RAG calc,
  + shadcn/ui                        projections, business logic)
```

### 1.4 Data Flow for Monthly Entry

```
1. User opens "Add Monthly Entry" form
2. Frontend validates with Zod schema
3. POST /api/v1/investments/{id}/entries  (JWT in Authorization header)
4. FastAPI validates with Pydantic v2
5. Service layer persists entry via SQLAlchemy
6. Service layer recalculates RAG status for linked goal
7. Response includes updated entry + goal RAG status
8. TanStack Query invalidates dashboard + goal caches
9. UI updates reactively
```

---

## 2. Technology Stack

### 2.1 Backend

| Technology | Version | Justification |
|---|---|---|
| **Python** | 3.12+ | Pattern matching, performance improvements, `type` statement for aliases. LTS until 2028. |
| **FastAPI** | 0.115+ | Async-first, automatic OpenAPI docs, Pydantic-native validation. Best Python framework for typed REST APIs. |
| **uv** | 0.5+ | 10-100x faster than pip. Deterministic lockfile (`uv.lock`). Drop-in replacement for pip, venv, and pip-tools. |
| **SQLAlchemy** | 2.0+ | Mature ORM with full type stub support. Mapped column syntax eliminates boilerplate. Async session support. |
| **Alembic** | 1.14+ | Industry-standard migration tool for SQLAlchemy. Autogenerate migrations from model diffs. |
| **Pydantic** | 2.10+ | V2 rewrite in Rust gives 5-50x validation speedup. Native integration with FastAPI. |
| **pytest** | 8.3+ | Fixture-based testing, rich plugin ecosystem, async test support via `pytest-asyncio`. |
| **ruff** | 0.8+ | Replaces flake8, isort, black in a single Rust-based tool. Sub-second linting on large codebases. |
| **mypy** | 1.13+ | Static type checking. Catches type errors before runtime. Strict mode enforced. |

### 2.2 Frontend

| Technology | Version | Justification |
|---|---|---|
| **Next.js** | 15 | App Router with React Server Components. Built-in API route proxying. Turbopack for fast dev builds. |
| **React** | 19 | Concurrent features, `use()` hook, improved Suspense. Stable release for production. |
| **TypeScript** | 5.7+ | Strict null checks, discriminated unions for RAG status types, `satisfies` operator for config safety. |
| **Tailwind CSS** | 4.0+ | Utility-first CSS. Zero runtime cost. Excellent design system primitives. |
| **shadcn/ui** | latest | Copy-paste accessible components built on Radix UI. Full control over styling and behavior. Not a locked dependency. |
| **React Hook Form** | 7.54+ | Uncontrolled form management with minimal re-renders. Native Zod resolver integration. |
| **Zod** | 3.24+ | TypeScript-first schema validation. Shares shape definitions between form validation and API response parsing. |
| **Vitest** | 3.0+ | Vite-native test runner. ESM-first, Jest-compatible API, 2-5x faster than Jest. |
| **Playwright** | 1.49+ | Cross-browser E2E testing. Auto-waiting, trace viewer, CI-friendly. |
| **TanStack Query** | 5.64+ | Server state management. Automatic caching, background refetching, optimistic updates. Replaces Redux for API state. |

### 2.3 Database

| Technology | Version | Justification |
|---|---|---|
| **PostgreSQL** | 16 | ACID compliance, JSON support for flexible metadata, excellent indexing (B-tree, GIN). Logical replication if scaling is needed later. |

### 2.4 Infrastructure / Tooling

| Technology | Purpose |
|---|---|
| **Docker Compose** | Local dev environment (PostgreSQL container). |
| **GitHub Actions** | CI/CD pipeline: lint, type-check, test, build. |
| **pre-commit** | Git hooks: ruff format, ruff check, mypy (backend); eslint, prettier (frontend). |

---

## 3. Database Schema

### 3.1 Entity-Relationship Diagram

```
┌──────────┐       1:N        ┌──────────────┐
│  users   │ ──────────────>  │    goals     │
└──────────┘                  └──────────────┘
                                     │
                                     │ 1:N
                                     ▼
                              ┌──────────────┐
                              │ investments  │
                              └──────────────┘
                                     │
                                     │ 1:N
                                     ▼
                              ┌────────────────┐
                              │ monthly_entries│
                              └────────────────┘
```

### 3.2 Full DDL

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE asset_class AS ENUM (
    'equity_mf',
    'debt_mf',
    'fixed_deposit',
    'gold',
    'real_estate',
    'smallcase'
);

CREATE TYPE rag_status AS ENUM ('green', 'amber', 'red');

CREATE TYPE goal_status AS ENUM ('active', 'achieved', 'abandoned');

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================
-- TABLE: goals
-- ============================================================
CREATE TABLE goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    target_amount   NUMERIC(15, 2) NOT NULL,   -- in INR (paise precision)
    target_date     DATE NOT NULL,
    status          goal_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_goals_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_goals_target_amount CHECK (target_amount > 0),
    CONSTRAINT chk_goals_target_date CHECK (target_date > CURRENT_DATE)
);

CREATE INDEX idx_goals_user_id ON goals (user_id);
CREATE INDEX idx_goals_status ON goals (user_id, status);

-- ============================================================
-- TABLE: investments
-- ============================================================
CREATE TABLE investments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id         UUID NOT NULL,
    user_id         UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    asset_class     asset_class NOT NULL,
    expected_cagr   NUMERIC(5, 2) NOT NULL,    -- e.g. 12.50 means 12.50%
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_investments_goal FOREIGN KEY (goal_id)
        REFERENCES goals (id) ON DELETE CASCADE,
    CONSTRAINT fk_investments_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_investments_cagr CHECK (expected_cagr >= 0 AND expected_cagr <= 100)
);

CREATE INDEX idx_investments_goal_id ON investments (goal_id);
CREATE INDEX idx_investments_user_id ON investments (user_id);
CREATE INDEX idx_investments_asset_class ON investments (asset_class);

-- ============================================================
-- TABLE: monthly_entries
-- ============================================================
CREATE TABLE monthly_entries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investment_id       UUID NOT NULL,
    entry_month         DATE NOT NULL,              -- always first of month (e.g., 2026-02-01)
    total_invested      NUMERIC(15, 2) NOT NULL,    -- CUMULATIVE total invested in this investment to date (snapshot, not monthly increment)
    current_value       NUMERIC(15, 2) NOT NULL,    -- mark-to-market value as of this month
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_entries_investment FOREIGN KEY (investment_id)
        REFERENCES investments (id) ON DELETE CASCADE,
    CONSTRAINT chk_entries_total_invested CHECK (total_invested >= 0),
    CONSTRAINT chk_entries_value CHECK (current_value >= 0),
    CONSTRAINT uq_entries_investment_month UNIQUE (investment_id, entry_month)
);

CREATE INDEX idx_entries_investment_id ON monthly_entries (investment_id);
CREATE INDEX idx_entries_month ON monthly_entries (entry_month DESC);
CREATE INDEX idx_entries_investment_month ON monthly_entries (investment_id, entry_month DESC);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    token_hash      VARCHAR(255) NOT NULL,      -- SHA-256 hash of the refresh token
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_investments_updated_at
    BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_entries_updated_at
    BEFORE UPDATE ON monthly_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

### 3.3 Computed / Derived Fields

The following values are **not stored** in the database. They are calculated on-demand by the service layer and returned in API responses:

| Field | Scope | Derivation |
|---|---|---|
| `projected_value` | Per investment | Future value of the latest `current_value` grown at `expected_cagr` until `goal.target_date` |
| `total_projected` | Per goal | Sum of `projected_value` across all linked investments |
| `progress_pct` | Per goal | `(total_projected / target_amount) * 100` |
| `rag_status` | Per goal | Green if `progress_pct >= 100`, Amber if `>= 85`, Red if `< 85` |
| `total_invested` | Per goal | Sum of latest `total_invested` snapshot across all linked investments |
| `total_current_value` | Per goal | Sum of latest `current_value` across all linked investments |
| `unrealized_gain` | Per investment | `current_value - total_invested` (from latest entry) |
| `absolute_return_pct` | Per investment | `((current_value - total_invested) / total_invested) * 100` |

**Rationale for not storing:** These values change whenever a new monthly entry is added or CAGR assumptions are updated. Computing on read avoids stale data and eliminates the need for cascading update triggers.

---

## 4. API Design

**Base URL:** `/api/v1`
**Content-Type:** `application/json`
**Authentication:** Bearer JWT in `Authorization` header (except login)

### 4.1 Auth Endpoints

#### POST /api/v1/auth/login

Authenticate user and return JWT tokens.

| Field | Value |
|---|---|
| **Auth required** | No |
| **Rate limit** | 5 requests / minute per IP |

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "securepassword123"
}
```

**Response (200):**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
    "token_type": "bearer",
    "expires_in": 900
}
```

**Response (401):**
```json
{
    "detail": {
        "code": "INVALID_CREDENTIALS",
        "message": "Invalid email or password."
    }
}
```

#### POST /api/v1/auth/refresh

Exchange a valid refresh token for a new access token. Implements refresh token rotation: the old refresh token is revoked and a new one is issued.

| Field | Value |
|---|---|
| **Auth required** | No (refresh token in body) |
| **Rate limit** | 10 requests / minute per IP |

**Request Body:**
```json
{
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response (200):**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "bmV3IHJlZnJlc2ggdG9r...",
    "token_type": "bearer",
    "expires_in": 900
}
```

#### POST /api/v1/auth/logout

Revoke the current refresh token.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Rate limit** | 10 requests / minute |

**Request Body:**
```json
{
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response (200):**
```json
{
    "message": "Successfully logged out."
}
```

#### GET /api/v1/auth/me

Return the authenticated user's profile.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Rate limit** | 30 requests / minute |

**Response (200):**
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "Rahul Sharma",
    "is_active": true,
    "created_at": "2026-01-15T10:30:00Z"
}
```

---

### 4.2 Goals Endpoints

#### GET /api/v1/goals

List all goals for the authenticated user.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Query params** | `status` (optional): `active`, `achieved`, `abandoned` |

**Response (200):**
```json
{
    "goals": [
        {
            "id": "uuid",
            "name": "Retirement Corpus",
            "description": "Build a 5 Cr corpus by age 50",
            "target_amount": 50000000.00,
            "target_amount_formatted": "5.00 Cr",
            "target_date": "2045-06-01",
            "status": "active",
            "total_invested": 1200000.00,
            "total_current_value": 1450000.00,
            "total_projected_value": 52300000.00,
            "progress_pct": 104.6,
            "rag_status": "green",
            "investment_count": 3,
            "created_at": "2026-01-15T10:30:00Z"
        }
    ],
    "count": 1
}
```

#### POST /api/v1/goals

Create a new goal.

| Field | Value |
|---|---|
| **Auth required** | Yes |

**Request Body:**
```json
{
    "name": "Child Education Fund",
    "description": "Engineering college fees for daughter",
    "target_amount": 3000000.00,
    "target_date": "2040-06-01"
}
```

**Response (201):** Full goal object with computed fields (all zeroed since no investments yet).

#### GET /api/v1/goals/{goal_id}

Get a single goal with all computed fields.

**Response (200):** Same shape as individual item in the list response.

#### PUT /api/v1/goals/{goal_id}

Update a goal. All fields optional.

**Request Body:**
```json
{
    "name": "Updated Goal Name",
    "target_amount": 3500000.00,
    "target_date": "2041-01-01",
    "status": "active"
}
```

**Response (200):** Updated goal object with recomputed fields.

#### DELETE /api/v1/goals/{goal_id}

Delete a goal and all linked investments/entries (cascade).

**Response (204):** No content.

#### GET /api/v1/goals/{goal_id}/projection

Get detailed projection breakdown for a goal.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Query params** | `cagr_override` (optional): override all investment CAGRs with a single value for scenario analysis |

**Response (200):**
```json
{
    "goal_id": "uuid",
    "goal_name": "Retirement Corpus",
    "target_amount": 50000000.00,
    "target_date": "2045-06-01",
    "years_remaining": 19.27,
    "investments": [
        {
            "id": "uuid",
            "name": "Nifty 50 Index Fund",
            "asset_class": "equity_mf",
            "latest_value": 800000.00,
            "expected_cagr": 12.0,
            "projected_value": 35200000.00
        },
        {
            "id": "uuid",
            "name": "PPF",
            "asset_class": "debt_mf",
            "latest_value": 400000.00,
            "expected_cagr": 7.1,
            "projected_value": 14800000.00
        }
    ],
    "total_current_value": 1200000.00,
    "total_projected_value": 50000000.00,
    "progress_pct": 100.0,
    "rag_status": "green",
    "shortfall": 0.00,
    "shortfall_formatted": "0"
}
```

#### GET /api/v1/goals/{goal_id}/rag-status

Lightweight endpoint returning only the RAG status for a goal.

**Response (200):**
```json
{
    "goal_id": "uuid",
    "rag_status": "amber",
    "progress_pct": 91.3,
    "shortfall": 4350000.00,
    "shortfall_formatted": "43.50 L"
}
```

---

### 4.3 Investments Endpoints

#### GET /api/v1/investments

List all investments, optionally filtered.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Query params** | `goal_id` (optional), `asset_class` (optional), `is_active` (optional) |

**Response (200):**
```json
{
    "investments": [
        {
            "id": "uuid",
            "goal_id": "uuid",
            "goal_name": "Retirement Corpus",
            "name": "Nifty 50 Index Fund",
            "asset_class": "equity_mf",
            "expected_cagr": 12.0,
            "is_active": true,
            "latest_total_invested": 500000.00,
            "latest_current_value": 620000.00,
            "unrealized_gain": 120000.00,
            "absolute_return_pct": 24.0,
            "latest_entry_month": "2026-02-01",
            "notes": null,
            "created_at": "2026-01-15T10:30:00Z"
        }
    ],
    "count": 1
}
```

#### POST /api/v1/investments

Create a new investment linked to a goal.

**Request Body:**
```json
{
    "goal_id": "uuid",
    "name": "SBI Blue Chip Fund",
    "asset_class": "equity_mf",
    "expected_cagr": 13.5,
    "notes": "SIP of 10k/month since Jan 2024"
}
```

**Response (201):** Full investment object.

#### GET /api/v1/investments/{investment_id}

Get a single investment with computed fields.

#### PUT /api/v1/investments/{investment_id}

Update investment details (name, CAGR, notes, active status). Cannot change the linked goal -- delete and recreate instead.

**Request Body:**
```json
{
    "name": "Updated Fund Name",
    "expected_cagr": 14.0,
    "is_active": true,
    "notes": "Updated notes"
}
```

**Response (200):** Updated investment object.

#### DELETE /api/v1/investments/{investment_id}

Delete an investment and all its monthly entries (cascade).

**Response (204):** No content.

---

### 4.4 Monthly Entries Endpoints

#### POST /api/v1/investments/{investment_id}/entries

Add a monthly entry for an investment.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Idempotency** | If an entry for the same `entry_month` exists, it is updated (upsert behavior). |

**Request Body:**
```json
{
    "entry_month": "2026-02-01",
    "total_invested": 560000.00,
    "current_value": 640000.00
}
```

Note: `total_invested` is the **cumulative** total invested in this investment to date, not the amount added this month.

**Response (201 or 200):**
```json
{
    "id": "uuid",
    "investment_id": "uuid",
    "entry_month": "2026-02-01",
    "total_invested": 560000.00,
    "current_value": 640000.00,
    "unrealized_gain": 80000.00,
    "absolute_return_pct": 14.29,
    "created_at": "2026-02-22T14:00:00Z",
    "updated_at": "2026-02-22T14:00:00Z",
    "goal_rag_status": "green"
}
```

#### GET /api/v1/investments/{investment_id}/entries

List all monthly entries for an investment, ordered by month descending.

| Field | Value |
|---|---|
| **Auth required** | Yes |
| **Query params** | `from_month` (optional, ISO date), `to_month` (optional, ISO date), `limit` (optional, default 12) |

**Response (200):**
```json
{
    "entries": [
        {
            "id": "uuid",
            "entry_month": "2026-02-01",
            "total_invested": 560000.00,
            "current_value": 640000.00,
            "unrealized_gain": 80000.00,
            "absolute_return_pct": 14.29,
            "month_over_month_value_change": 20000.00,
            "created_at": "2026-02-22T14:00:00Z"
        },
        {
            "id": "uuid",
            "entry_month": "2026-01-01",
            "total_invested": 550000.00,
            "current_value": 620000.00,
            "unrealized_gain": 70000.00,
            "absolute_return_pct": 12.73,
            "month_over_month_value_change": null,
            "created_at": "2026-01-20T11:00:00Z"
        }
    ],
    "count": 2,
    "investment_id": "uuid",
    "investment_name": "Nifty 50 Index Fund"
}
```

#### DELETE /api/v1/investments/{investment_id}/entries/{entry_id}

Delete a specific monthly entry.

**Response (204):** No content.

---

### 4.5 Dashboard Endpoint

#### GET /api/v1/dashboard

Aggregated view of all goals, investments, and RAG statuses.

| Field | Value |
|---|---|
| **Auth required** | Yes |

**Response (200):**
```json
{
    "summary": {
        "total_invested": 2500000.00,
        "total_invested_formatted": "25.00 L",
        "total_current_value": 3100000.00,
        "total_current_value_formatted": "31.00 L",
        "total_unrealized_gain": 600000.00,
        "overall_return_pct": 24.0,
        "active_goals": 3,
        "goals_on_track": 2,
        "goals_at_risk": 1
    },
    "asset_allocation": [
        {
            "asset_class": "equity_mf",
            "current_value": 2000000.00,
            "allocation_pct": 64.5
        },
        {
            "asset_class": "debt_mf",
            "current_value": 600000.00,
            "allocation_pct": 19.4
        },
        {
            "asset_class": "gold",
            "current_value": 300000.00,
            "allocation_pct": 9.7
        },
        {
            "asset_class": "fixed_deposit",
            "current_value": 200000.00,
            "allocation_pct": 6.4
        }
    ],
    "goals": [
        {
            "id": "uuid",
            "name": "Retirement Corpus",
            "target_amount_formatted": "5.00 Cr",
            "rag_status": "green",
            "progress_pct": 104.6,
            "target_date": "2045-06-01"
        },
        {
            "id": "uuid",
            "name": "Child Education",
            "target_amount_formatted": "30.00 L",
            "rag_status": "amber",
            "progress_pct": 91.3,
            "target_date": "2040-06-01"
        }
    ],
    "recent_entries": [
        {
            "investment_name": "Nifty 50 Index Fund",
            "goal_name": "Retirement Corpus",
            "entry_month": "2026-02-01",
            "current_value": 640000.00,
            "created_at": "2026-02-22T14:00:00Z"
        }
    ]
}
```

---

## 5. RAG Calculation Algorithm

### 5.1 Core Concept

For each goal, Engoal projects the future value of every linked investment using compound growth at the investment's expected CAGR. The sum of all projected values is compared against the goal's target amount to produce a Red/Amber/Green status.

### 5.2 Future Value Formula

For a single investment:

```
FV_i = CV_i * (1 + r_i) ^ t
```

Where:
- `FV_i` = projected future value of investment `i`
- `CV_i` = current mark-to-market value (from the latest `monthly_entries.current_value`)
- `r_i` = expected annual CAGR as a decimal (e.g., 12% = 0.12)
- `t` = years remaining until `goal.target_date`, calculated as:

```
t = (goal.target_date - today) / 365.25
```

If `t <= 0` (goal date has passed), `FV_i = CV_i` (no growth projected).

### 5.3 Goal-Level Aggregation

```
total_projected = SUM(FV_i)  for all active investments linked to the goal

progress_pct = (total_projected / goal.target_amount) * 100
```

### 5.4 RAG Thresholds

| Status | Condition | Meaning |
|---|---|---|
| **Green** | `progress_pct >= 100.0` | On track or ahead. Current investments, if grown at expected CAGR, will meet or exceed the goal. |
| **Amber** | `85.0 <= progress_pct < 100.0` | Slightly behind. A small course correction (higher SIP, better returns) could close the gap. |
| **Red** | `progress_pct < 85.0` | Significantly behind. Material action required -- increase investment or extend timeline. |

### 5.5 Shortfall Calculation

```
shortfall = max(0, goal.target_amount - total_projected)
```

Returned in API responses to quantify exactly how much the user is behind.

### 5.6 Python Implementation

```python
# backend/app/services/rag.py

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum


class RAGStatus(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


def calculate_years_remaining(target_date: date) -> Decimal:
    """Calculate fractional years from today to target date."""
    delta = target_date - date.today()
    days = Decimal(str(delta.days))
    if days <= 0:
        return Decimal("0")
    return (days / Decimal("365.25")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def project_future_value(
    current_value: Decimal,
    cagr_pct: Decimal,
    years: Decimal,
) -> Decimal:
    """
    Project future value using compound growth.

    FV = CV * (1 + r)^t

    All calculations use Decimal for financial precision.
    """
    if years <= 0 or current_value <= 0:
        return current_value

    rate = cagr_pct / Decimal("100")
    growth_factor = (Decimal("1") + rate) ** years
    fv = current_value * growth_factor
    return fv.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_rag_status(progress_pct: Decimal) -> RAGStatus:
    """Determine RAG status from progress percentage."""
    if progress_pct >= Decimal("100"):
        return RAGStatus.GREEN
    elif progress_pct >= Decimal("85"):
        return RAGStatus.AMBER
    else:
        return RAGStatus.RED


def evaluate_goal(
    target_amount: Decimal,
    target_date: date,
    investments: list[dict],
) -> dict:
    """
    Evaluate a goal's RAG status using snapshot-based projection.

    The projection answers: "If I invest no more money, will my existing
    portfolio grow to reach the goal?" No future contributions are assumed.

    Args:
        target_amount: Goal target in INR.
        target_date: Goal deadline.
        investments: List of dicts with keys:
            - current_value: Decimal (latest MTM from snapshot)
            - expected_cagr: Decimal (annual %)

    Returns:
        Dict with total_projected, progress_pct, rag_status, shortfall,
        and recommended_monthly_sip (to close the gap, if any).
    """
    years = calculate_years_remaining(target_date)

    # Compute weighted-average CAGR across all investments
    total_current_value = sum(inv["current_value"] for inv in investments)

    if total_current_value <= 0:
        return {
            "years_remaining": years,
            "total_current_value": Decimal("0"),
            "total_projected": Decimal("0"),
            "progress_pct": Decimal("0"),
            "rag_status": RAGStatus.RED,
            "shortfall": target_amount,
            "investment_projections": [],
            "recommended_monthly_sip": None,
        }

    weighted_cagr = sum(
        inv["current_value"] * inv["expected_cagr"] for inv in investments
    ) / total_current_value

    total_projected = Decimal("0")
    projections = []

    for inv in investments:
        fv = project_future_value(
            current_value=inv["current_value"],
            cagr_pct=inv["expected_cagr"],
            years=years,
        )
        total_projected += fv
        projections.append({**inv, "projected_value": fv})

    if target_amount > 0:
        progress_pct = (total_projected / target_amount * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        progress_pct = Decimal("0")

    shortfall = max(Decimal("0"), target_amount - total_projected)
    status = compute_rag_status(progress_pct)

    # Compute recommended monthly SIP to close gap (informational only)
    recommended_sip = None
    if shortfall > 0 and years > 0:
        monthly_rate = (Decimal("1") + weighted_cagr / Decimal("100")) ** (
            Decimal("1") / Decimal("12")
        ) - Decimal("1")
        months_remaining = (years * Decimal("12")).quantize(Decimal("1"))
        if monthly_rate > 0:
            recommended_sip = (
                shortfall * monthly_rate
                / ((Decimal("1") + monthly_rate) ** months_remaining - Decimal("1"))
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "years_remaining": years,
        "total_current_value": total_current_value,
        "total_projected": total_projected,
        "progress_pct": progress_pct,
        "rag_status": status,
        "shortfall": shortfall,
        "investment_projections": projections,
        "recommended_monthly_sip": recommended_sip,
    }
```

### 5.7 INR Formatting

```python
# backend/app/services/formatting.py

from decimal import Decimal


def format_inr(amount: Decimal) -> str:
    """
    Format INR amount in Lakhs/Crores notation.

    Examples:
        45000       -> "45,000"
        150000      -> "1.50 L"
        2500000     -> "25.00 L"
        50000000    -> "5.00 Cr"
        123456789   -> "12.35 Cr"
    """
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""

    if abs_amount >= Decimal("10000000"):  # 1 Crore = 10,000,000
        crores = abs_amount / Decimal("10000000")
        return f"{sign}{crores:.2f} Cr"
    elif abs_amount >= Decimal("100000"):  # 1 Lakh = 100,000
        lakhs = abs_amount / Decimal("100000")
        return f"{sign}{lakhs:.2f} L"
    else:
        return f"{sign}{abs_amount:,.0f}"
```

### 5.8 Worked Example

**Goal:** Child Education Fund -- Target 30,00,000 INR by 2040-06-01

**Investments (as of 2026-02-22):**

| Investment | Asset Class | Current Value | Expected CAGR |
|---|---|---|---|
| SBI Blue Chip Fund | equity_mf | 4,00,000 | 12.0% |
| HDFC Short Term Debt | debt_mf | 2,00,000 | 7.5% |
| Gold ETF | gold | 1,50,000 | 9.0% |

**Calculation:**

```
t = (2040-06-01 - 2026-02-22) / 365.25 = 14.27 years

FV_equity  = 4,00,000 * (1.12)^14.27  = 4,00,000 * 4.9736  = 19,89,440
FV_debt    = 2,00,000 * (1.075)^14.27  = 2,00,000 * 2.7685  =  5,53,700
FV_gold    = 1,50,000 * (1.09)^14.27   = 1,50,000 * 3.3876  =  5,08,140

total_projected = 19,89,440 + 5,53,700 + 5,08,140 = 30,51,280

progress_pct = (30,51,280 / 30,00,000) * 100 = 101.71%

rag_status = GREEN (>= 100%)
shortfall  = 0
```

---

## 6. Security Design

### 6.1 Authentication: JWT Access + Refresh Token Strategy

```
┌─────────┐                     ┌─────────┐                    ┌────────┐
│ Browser  │                     │ FastAPI  │                    │  DB    │
└────┬─────┘                     └────┬─────┘                    └───┬────┘
     │  POST /auth/login              │                              │
     │  {email, password}             │                              │
     │ ──────────────────────────────>│  verify password (bcrypt)    │
     │                                │ ─────────────────────────────>
     │                                │  store refresh_token hash    │
     │                                │ ─────────────────────────────>
     │  {access_token, refresh_token} │                              │
     │ <──────────────────────────────│                              │
     │                                │                              │
     │  GET /api/v1/goals             │                              │
     │  Authorization: Bearer <AT>    │                              │
     │ ──────────────────────────────>│  validate JWT signature      │
     │                                │  check expiry                │
     │  {goals: [...]}               │                              │
     │ <──────────────────────────────│                              │
     │                                │                              │
     │  POST /auth/refresh            │                              │
     │  {refresh_token}               │                              │
     │ ──────────────────────────────>│  hash RT, lookup in DB       │
     │                                │  revoke old RT               │
     │                                │  issue new AT + RT           │
     │  {access_token, refresh_token} │                              │
     │ <──────────────────────────────│                              │
```

**Token Configuration:**

| Token | Lifetime | Storage (Client) | Storage (Server) |
|---|---|---|---|
| Access Token (JWT) | 15 minutes | Memory (JS variable) | Not stored (stateless) |
| Refresh Token | 7 days | HttpOnly Secure cookie | SHA-256 hash in `refresh_tokens` table |

**JWT Claims:**

```json
{
    "sub": "user-uuid",
    "exp": 1708700000,
    "iat": 1708699100,
    "type": "access"
}
```

**Refresh Token Rotation:** Every time a refresh token is used, it is revoked and a new one is issued. If a revoked token is presented, all refresh tokens for that user are invalidated (compromise detection).

### 6.2 Password Hashing

```python
# backend/app/core/security.py

from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # ~250ms per hash on modern hardware
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

**Password Policy (enforced by Pydantic validator):**
- Minimum 10 characters
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Not in the top 10,000 common passwords list

### 6.3 Rate Limiting

Using `slowapi` (token-bucket algorithm):

| Endpoint Group | Limit | Key |
|---|---|---|
| `/auth/login` | 5 / minute | Client IP |
| `/auth/refresh` | 10 / minute | Client IP |
| All other authenticated endpoints | 60 / minute | User ID |
| Global fallback | 120 / minute | Client IP |

### 6.4 CORS Policy

```python
# backend/app/main.py

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Next.js dev server
        "https://engoal.example.com", # Production domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,  # Preflight cache: 10 minutes
)
```

### 6.5 SQL Injection Prevention

All database access uses SQLAlchemy ORM with parameterized queries. No raw SQL strings are ever constructed from user input.

```python
# CORRECT: ORM query (parameterized)
goal = await session.execute(
    select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
)

# NEVER: Raw string interpolation
# query = f"SELECT * FROM goals WHERE id = '{goal_id}'"  # VULNERABLE
```

### 6.6 HTTPS Enforcement

- **Production:** TLS termination at reverse proxy (nginx/Caddy). Backend listens on HTTP internally.
- **Development:** HTTP allowed on `localhost` only.
- All cookies set with `Secure` flag.
- HSTS header prevents downgrade attacks.

### 6.7 Security Headers

Applied via middleware on every response:

```python
# backend/app/core/middleware.py

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"  # Deprecated; CSP is preferred
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        return response
```

### 6.8 Additional Security Measures

| Measure | Implementation |
|---|---|
| **Input validation** | All inputs validated by Pydantic v2 schemas with strict types. Max string lengths enforced. |
| **UUID primary keys** | Non-sequential, non-guessable identifiers. Prevents enumeration attacks. |
| **User scoping** | Every query includes `WHERE user_id = :current_user_id`. No endpoint can access another user's data. |
| **Dependency injection** | `get_current_user` dependency extracts and validates JWT on every protected route. |
| **Logging** | Structured JSON logging. Auth failures logged with IP and timestamp. Passwords never logged. |
| **Environment variables** | Secrets loaded from `.env` via `pydantic-settings`. `.env` is in `.gitignore`. |

---

## 7. Frontend Architecture

### 7.1 Next.js App Router Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                # Root layout: providers, global styles
│   ├── page.tsx                  # Landing / redirect to dashboard
│   ├── (auth)/                   # Auth route group (no layout nesting)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx            # Minimal layout for auth pages
│   ├── (app)/                    # Authenticated route group
│   │   ├── layout.tsx            # App shell: sidebar, navbar, auth guard
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Dashboard with summary cards + goal RAGs
│   │   ├── goals/
│   │   │   ├── page.tsx          # Goal list
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create goal form
│   │   │   └── [goalId]/
│   │   │       ├── page.tsx      # Goal detail + projection
│   │   │       └── edit/
│   │   │           └── page.tsx  # Edit goal form
│   │   ├── investments/
│   │   │   ├── page.tsx          # All investments list
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create investment form
│   │   │   └── [investmentId]/
│   │   │       ├── page.tsx      # Investment detail + entry history
│   │   │       ├── edit/
│   │   │       │   └── page.tsx  # Edit investment form
│   │   │       └── entries/
│   │   │           └── new/
│   │   │               └── page.tsx  # Add monthly entry form
│   │   └── settings/
│   │       └── page.tsx          # User profile settings
│   └── not-found.tsx             # 404 page
│
├── components/
│   ├── ui/                       # shadcn/ui primitives (Button, Card, Input, etc.)
│   ├── forms/
│   │   ├── goal-form.tsx
│   │   ├── investment-form.tsx
│   │   └── entry-form.tsx
│   ├── dashboard/
│   │   ├── summary-cards.tsx
│   │   ├── asset-allocation-chart.tsx
│   │   └── goal-rag-list.tsx
│   ├── goals/
│   │   ├── goal-card.tsx
│   │   ├── goal-projection.tsx
│   │   └── rag-badge.tsx
│   ├── investments/
│   │   ├── investment-card.tsx
│   │   └── entry-history-table.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── navbar.tsx
│   │   └── page-header.tsx
│   └── shared/
│       ├── currency-display.tsx  # INR formatting (Lakhs/Crores)
│       ├── loading-skeleton.tsx
│       ├── empty-state.tsx
│       └── confirm-dialog.tsx
│
├── hooks/
│   ├── use-auth.ts               # Auth state + login/logout/refresh
│   ├── use-goals.ts              # TanStack Query hooks for goals
│   ├── use-investments.ts        # TanStack Query hooks for investments
│   ├── use-entries.ts            # TanStack Query hooks for entries
│   └── use-dashboard.ts          # TanStack Query hook for dashboard
│
├── lib/
│   ├── api-client.ts             # Axios/fetch wrapper with JWT interceptor
│   ├── constants.ts              # API base URL, asset class labels, etc.
│   ├── format-currency.ts        # INR Lakhs/Crores formatter
│   ├── query-client.ts           # TanStack Query client config
│   └── validators.ts             # Shared Zod schemas
│
└── types/
    ├── api.ts                    # API response types
    ├── goal.ts                   # Goal type definitions
    ├── investment.ts             # Investment type definitions
    └── entry.ts                  # Monthly entry type definitions
```

### 7.2 Component Hierarchy

```
RootLayout
├── QueryClientProvider (TanStack Query)
├── AuthProvider (context: user, tokens, login/logout)
│
├── (auth) Layout
│   └── LoginPage
│       └── LoginForm (React Hook Form + Zod)
│
└── (app) Layout
    ├── Sidebar
    │   ├── NavLinks (Dashboard, Goals, Investments)
    │   └── UserMenu (profile, logout)
    ├── Navbar
    │   └── PageHeader
    │
    ├── DashboardPage
    │   ├── SummaryCards (total invested, current value, gain, goals on track)
    │   ├── AssetAllocationChart (pie/donut chart)
    │   ├── GoalRAGList
    │   │   └── GoalCard (name, target, RAG badge, progress bar)
    │   └── RecentEntriesTable
    │
    ├── GoalListPage
    │   └── GoalCard[] (clickable, shows RAG badge)
    │
    ├── GoalDetailPage
    │   ├── GoalHeader (name, target, date, RAG badge)
    │   ├── GoalProjection (table of investments with projected values)
    │   ├── ProgressBar (visual % toward target)
    │   └── InvestmentList (linked investments)
    │
    ├── InvestmentDetailPage
    │   ├── InvestmentHeader (name, asset class, CAGR)
    │   ├── CurrentValueCard (latest MTM, gain/loss)
    │   └── EntryHistoryTable (monthly entries, sortable)
    │
    └── EntryFormPage
        └── EntryForm (month picker, amount invested, current value)
```

### 7.3 State Management with TanStack Query

All server state is managed via TanStack Query. No Redux, no Zustand. Client-only state (modals, form state) uses React's `useState`.

```typescript
// frontend/src/hooks/use-goals.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Goal, GoalCreate, GoalUpdate } from "@/types/goal";

const GOALS_KEY = ["goals"] as const;

export function useGoals(status?: string) {
  return useQuery({
    queryKey: [...GOALS_KEY, { status }],
    queryFn: () =>
      apiClient.get<{ goals: Goal[]; count: number }>("/goals", {
        params: { status },
      }),
  });
}

export function useGoal(goalId: string) {
  return useQuery({
    queryKey: [...GOALS_KEY, goalId],
    queryFn: () => apiClient.get<Goal>(`/goals/${goalId}`),
    enabled: !!goalId,
  });
}

export function useGoalProjection(goalId: string) {
  return useQuery({
    queryKey: [...GOALS_KEY, goalId, "projection"],
    queryFn: () => apiClient.get(`/goals/${goalId}/projection`),
    enabled: !!goalId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoalCreate) => apiClient.post<Goal>("/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateGoal(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoalUpdate) =>
      apiClient.put<Goal>(`/goals/${goalId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => apiClient.delete(`/goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

**Cache Invalidation Strategy:**

| Action | Invalidates |
|---|---|
| Create/update/delete goal | `["goals"]`, `["dashboard"]` |
| Create/update/delete investment | `["investments"]`, `["goals", goalId]`, `["dashboard"]` |
| Create/delete monthly entry | `["entries", investmentId]`, `["investments", investmentId]`, `["goals", goalId]`, `["dashboard"]` |

### 7.4 API Client with JWT Interceptor

```typescript
// frontend/src/lib/api-client.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type TokenStore = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  refreshToken: () => Promise<string>;
  onAuthFailure: () => void;
};

let tokenStore: TokenStore;

export function initializeApiClient(store: TokenStore) {
  tokenStore = store;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokenStore?.accessToken) {
    headers["Authorization"] = `Bearer ${tokenStore.accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, attempt token refresh once
  if (response.status === 401 && tokenStore) {
    try {
      const newToken = await tokenStore.refreshToken();
      tokenStore.setAccessToken(newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } catch {
      tokenStore.onAuthFailure();
      throw new AuthError("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail?.message || "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const apiClient = {
  get: <T>(path: string, opts?: { params?: Record<string, string> }) => {
    const url = opts?.params
      ? `${path}?${new URLSearchParams(opts.params)}`
      : path;
    return request<T>(url);
  },
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
```

### 7.5 TypeScript Types

```typescript
// frontend/src/types/goal.ts

export type RAGStatus = "green" | "amber" | "red";

export type GoalStatus = "active" | "achieved" | "abandoned";

export type AssetClass =
  | "equity_mf"
  | "debt_mf"
  | "fixed_deposit"
  | "gold"
  | "real_estate"
  | "smallcase";

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  target_amount_formatted: string;
  target_date: string; // ISO date
  status: GoalStatus;
  total_invested: number;
  total_current_value: number;
  total_projected_value: number;
  progress_pct: number;
  rag_status: RAGStatus;
  investment_count: number;
  created_at: string;
}

export interface GoalCreate {
  name: string;
  description?: string;
  target_amount: number;
  target_date: string;
}

export interface GoalUpdate {
  name?: string;
  description?: string;
  target_amount?: number;
  target_date?: string;
  status?: GoalStatus;
}

export interface GoalProjection {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  target_date: string;
  years_remaining: number;
  investments: InvestmentProjection[];
  total_current_value: number;
  total_projected_value: number;
  progress_pct: number;
  rag_status: RAGStatus;
  shortfall: number;
  shortfall_formatted: string;
}

export interface InvestmentProjection {
  id: string;
  name: string;
  asset_class: AssetClass;
  latest_value: number;
  expected_cagr: number;
  projected_value: number;
}

// frontend/src/types/investment.ts

export interface Investment {
  id: string;
  goal_id: string;
  goal_name: string;
  name: string;
  asset_class: AssetClass;
  expected_cagr: number;
  is_active: boolean;
  latest_total_invested: number;   // cumulative invested to date
  latest_current_value: number;
  unrealized_gain: number;
  absolute_return_pct: number;
  latest_entry_month: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvestmentCreate {
  goal_id: string;
  name: string;
  asset_class: AssetClass;
  expected_cagr: number;
  notes?: string;
}

export interface InvestmentUpdate {
  name?: string;
  expected_cagr?: number;
  is_active?: boolean;
  notes?: string;
}

// frontend/src/types/entry.ts

export interface MonthlyEntry {
  id: string;
  entry_month: string;
  total_invested: number;          // cumulative invested to date (snapshot)
  current_value: number;
  unrealized_gain: number;
  absolute_return_pct: number;
  month_over_month_value_change: number | null;
  created_at: string;
}

export interface EntryCreate {
  entry_month: string;
  total_invested: number;          // cumulative invested to date (snapshot)
  current_value: number;
}
```

### 7.6 Zod Validation Schemas

```typescript
// frontend/src/lib/validators.ts

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export const goalSchema = z.object({
  name: z
    .string()
    .min(1, "Goal name is required")
    .max(200, "Goal name must be under 200 characters"),
  description: z.string().max(1000).optional(),
  target_amount: z
    .number({ invalid_type_error: "Target amount must be a number" })
    .positive("Target amount must be positive")
    .max(100_00_00_00_000, "Target amount exceeds maximum"),  // 1000 Cr
  target_date: z
    .string()
    .refine((d) => new Date(d) > new Date(), "Target date must be in the future"),
});

export const investmentSchema = z.object({
  goal_id: z.string().uuid("Invalid goal"),
  name: z
    .string()
    .min(1, "Investment name is required")
    .max(200, "Investment name must be under 200 characters"),
  asset_class: z.enum([
    "equity_mf",
    "debt_mf",
    "fixed_deposit",
    "gold",
    "real_estate",
    "smallcase",
  ]),
  expected_cagr: z
    .number()
    .min(0, "CAGR cannot be negative")
    .max(100, "CAGR cannot exceed 100%"),
  notes: z.string().max(1000).optional(),
});

export const entrySchema = z.object({
  entry_month: z.string().refine((d) => {
    const date = new Date(d);
    return date.getDate() === 1; // Must be first of month
  }, "Entry month must be the first of a month"),
  total_invested: z
    .number({ invalid_type_error: "Total invested must be a number" })
    .min(0, "Total invested cannot be negative"),
  current_value: z
    .number({ invalid_type_error: "Current value must be a number" })
    .min(0, "Current value cannot be negative"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type InvestmentInput = z.infer<typeof investmentSchema>;
export type EntryInput = z.infer<typeof entrySchema>;
// EntryInput.total_invested = cumulative total invested to date (snapshot model)
```

### 7.7 Currency Display Component

```typescript
// frontend/src/components/shared/currency-display.tsx

"use client";

interface CurrencyDisplayProps {
  amount: number;
  formatted?: string; // Pre-formatted from API (e.g., "25.00 L")
  className?: string;
  showSign?: boolean;
}

export function CurrencyDisplay({
  amount,
  formatted,
  className,
  showSign = false,
}: CurrencyDisplayProps) {
  const display = formatted || formatINR(amount);
  const isNegative = amount < 0;
  const isPositive = amount > 0;

  const signClass = isNegative
    ? "text-red-600"
    : isPositive && showSign
      ? "text-green-600"
      : "";

  const prefix = showSign && isPositive ? "+" : "";

  return (
    <span className={`font-mono tabular-nums ${signClass} ${className ?? ""}`}>
      {prefix}{display}
    </span>
  );
}

function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}${(abs / 1_00_000).toFixed(2)} L`;
  }
  return `${sign}${abs.toLocaleString("en-IN")}`;
}
```

### 7.8 RAG Badge Component

```typescript
// frontend/src/components/goals/rag-badge.tsx

import type { RAGStatus } from "@/types/goal";

const RAG_CONFIG: Record<RAGStatus, { label: string; classes: string }> = {
  green: {
    label: "On Track",
    classes: "bg-green-100 text-green-800 border-green-200",
  },
  amber: {
    label: "At Risk",
    classes: "bg-amber-100 text-amber-800 border-amber-200",
  },
  red: {
    label: "Off Track",
    classes: "bg-red-100 text-red-800 border-red-200",
  },
};

interface RAGBadgeProps {
  status: RAGStatus;
  progressPct?: number;
  size?: "sm" | "md";
}

export function RAGBadge({ status, progressPct, size = "md" }: RAGBadgeProps) {
  const config = RAG_CONFIG[status];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.classes} ${sizeClass}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === "green"
            ? "bg-green-500"
            : status === "amber"
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />
      {config.label}
      {progressPct !== undefined && (
        <span className="font-mono">({progressPct.toFixed(1)}%)</span>
      )}
    </span>
  );
}
```

---

## 8. Error Handling Strategy

### 8.1 Backend: Standardized Error Response

All API errors follow a consistent JSON structure:

```json
{
    "detail": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "Goal with ID '550e8400-...' not found.",
        "field": null
    }
}
```

For validation errors (422):

```json
{
    "detail": {
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed.",
        "errors": [
            {
                "field": "target_amount",
                "message": "Value must be greater than 0.",
                "type": "value_error"
            },
            {
                "field": "target_date",
                "message": "Date must be in the future.",
                "type": "value_error"
            }
        ]
    }
}
```

**Error Code Registry:**

| HTTP Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request body, invalid query params |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password on login |
| 401 | `TOKEN_EXPIRED` | JWT access token has expired |
| 401 | `TOKEN_INVALID` | JWT signature verification failed |
| 403 | `FORBIDDEN` | User trying to access another user's resource |
| 404 | `RESOURCE_NOT_FOUND` | Goal, investment, or entry not found |
| 409 | `CONFLICT` | Duplicate entry for same investment + month |
| 422 | `VALIDATION_ERROR` | Pydantic validation failure |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error (logged, not exposed to client) |

### 8.2 Backend: Exception Handler Implementation

```python
# backend/app/core/exceptions.py

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_500_INTERNAL_SERVER_ERROR,
)


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field


class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=HTTP_404_NOT_FOUND,
            code="RESOURCE_NOT_FOUND",
            message=f"{resource} with ID '{resource_id}' not found.",
        )


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(
            status_code=HTTP_409_CONFLICT,
            code="CONFLICT",
            message=message,
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": {
                    "code": exc.code,
                    "message": exc.message,
                    "field": exc.field,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Log the full traceback for debugging
        import logging
        logger = logging.getLogger("engoal")
        logger.exception("Unhandled exception", exc_info=exc)

        return JSONResponse(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred.",
                    "field": None,
                }
            },
        )
```

### 8.3 Frontend: Error Boundaries

```typescript
// frontend/src/components/shared/error-boundary.tsx

"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### 8.4 Frontend: TanStack Query Error Handling

```typescript
// frontend/src/lib/query-client.ts

import { QueryClient } from "@tanstack/react-query";
import { ApiError, AuthError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry auth errors
        if (error instanceof AuthError) return false;
        // Never retry 4xx errors (except 408 and 429)
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408 &&
          error.status !== 429
        ) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      staleTime: 30_000,        // 30 seconds
      gcTime: 5 * 60_000,       // 5 minutes (garbage collection)
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
```

### 8.5 Frontend: Toast Notifications for Mutations

```typescript
// frontend/src/hooks/use-goals.ts (mutation error handling pattern)

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoalCreate) => apiClient.post<Goal>("/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      toast.success("Goal created successfully.");
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create goal. Please try again.");
      }
    },
  });
}
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
        ╱╲
       ╱  ╲
      ╱ E2E ╲          Playwright (5-10 tests)
     ╱────────╲         Critical user journeys
    ╱Integration╲       FastAPI TestClient + MSW (30-50 tests)
   ╱──────────────╲     API contracts, DB queries
  ╱   Unit Tests    ╲   pytest + Vitest (100+ tests)
 ╱────────────────────╲  Pure logic, components, hooks
```

### 9.2 Backend: pytest

**Directory Structure:**
```
backend/tests/
├── conftest.py               # Shared fixtures (db session, test user, auth headers)
├── unit/
│   ├── test_rag.py           # RAG calculation logic
│   ├── test_projection.py    # Future value projection
│   └── test_formatting.py    # INR formatting
├── integration/
│   ├── test_auth_api.py      # Auth endpoints
│   ├── test_goals_api.py     # Goals CRUD + projection
│   ├── test_investments_api.py
│   ├── test_entries_api.py
│   └── test_dashboard_api.py
└── factories.py              # Test data factories
```

**Fixtures:**

```python
# backend/tests/conftest.py

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import create_app
from app.db.base import Base
from app.core.deps import get_db
from app.core.security import hash_password

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5433/engoal_test"


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(engine):
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            yield session
        await session.rollback()


@pytest.fixture
async def app(db_session):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    yield app


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test/api/v1",
    ) as client:
        yield client


@pytest.fixture
async def test_user(db_session):
    from app.models.user import User

    user = User(
        email="test@engoal.app",
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def auth_headers(client, test_user):
    response = await client.post("/auth/login", json={
        "email": "test@engoal.app",
        "password": "TestPass123!",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

**Unit Test Example:**

```python
# backend/tests/unit/test_rag.py

from datetime import date
from decimal import Decimal

import pytest

from app.services.rag import (
    calculate_years_remaining,
    compute_rag_status,
    evaluate_goal,
    project_future_value,
    RAGStatus,
)


class TestProjectFutureValue:
    def test_basic_growth(self):
        """12% CAGR on 1,00,000 for 10 years."""
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("10.00"),
        )
        assert fv == Decimal("310584.82")  # 1,00,000 * 1.12^10

    def test_zero_years(self):
        """No growth if years remaining is zero."""
        fv = project_future_value(
            current_value=Decimal("100000"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("0"),
        )
        assert fv == Decimal("100000")

    def test_zero_value(self):
        """No growth on zero value."""
        fv = project_future_value(
            current_value=Decimal("0"),
            cagr_pct=Decimal("12.00"),
            years=Decimal("10.00"),
        )
        assert fv == Decimal("0")


class TestComputeRAGStatus:
    @pytest.mark.parametrize(
        "pct, expected",
        [
            (Decimal("120.00"), RAGStatus.GREEN),
            (Decimal("100.00"), RAGStatus.GREEN),
            (Decimal("99.99"), RAGStatus.AMBER),
            (Decimal("85.00"), RAGStatus.AMBER),
            (Decimal("84.99"), RAGStatus.RED),
            (Decimal("50.00"), RAGStatus.RED),
            (Decimal("0"), RAGStatus.RED),
        ],
    )
    def test_thresholds(self, pct, expected):
        assert compute_rag_status(pct) == expected


class TestEvaluateGoal:
    def test_on_track_goal(self):
        result = evaluate_goal(
            target_amount=Decimal("3000000"),
            target_date=date(2040, 6, 1),
            investments=[
                {"current_value": Decimal("400000"), "expected_cagr": Decimal("12.00")},
                {"current_value": Decimal("200000"), "expected_cagr": Decimal("7.50")},
            ],
        )
        assert result["rag_status"] == RAGStatus.GREEN
        assert result["shortfall"] == Decimal("0")

    def test_behind_goal(self):
        result = evaluate_goal(
            target_amount=Decimal("10000000"),
            target_date=date(2030, 1, 1),
            investments=[
                {"current_value": Decimal("100000"), "expected_cagr": Decimal("10.00")},
            ],
        )
        assert result["rag_status"] == RAGStatus.RED
        assert result["shortfall"] > 0
```

**Integration Test Example:**

```python
# backend/tests/integration/test_goals_api.py

import pytest
from httpx import AsyncClient


class TestGoalsCRUD:
    @pytest.mark.anyio
    async def test_create_goal(self, client: AsyncClient, auth_headers: dict):
        response = await client.post(
            "/goals",
            json={
                "name": "Retirement Corpus",
                "description": "Build retirement fund",
                "target_amount": 50000000.00,
                "target_date": "2045-06-01",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Retirement Corpus"
        assert data["target_amount"] == 50000000.00
        assert data["rag_status"] == "red"  # No investments yet
        assert data["progress_pct"] == 0.0

    @pytest.mark.anyio
    async def test_create_goal_unauthenticated(self, client: AsyncClient):
        response = await client.post(
            "/goals",
            json={
                "name": "Test",
                "target_amount": 100000,
                "target_date": "2030-01-01",
            },
        )
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_create_goal_invalid_date(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.post(
            "/goals",
            json={
                "name": "Test",
                "target_amount": 100000,
                "target_date": "2020-01-01",  # Past date
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_list_goals(self, client: AsyncClient, auth_headers: dict):
        # Create two goals first
        for name in ["Goal A", "Goal B"]:
            await client.post(
                "/goals",
                json={
                    "name": name,
                    "target_amount": 1000000,
                    "target_date": "2040-01-01",
                },
                headers=auth_headers,
            )

        response = await client.get("/goals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2

    @pytest.mark.anyio
    async def test_delete_goal_cascades(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create goal
        goal_resp = await client.post(
            "/goals",
            json={
                "name": "To Delete",
                "target_amount": 1000000,
                "target_date": "2040-01-01",
            },
            headers=auth_headers,
        )
        goal_id = goal_resp.json()["id"]

        # Create investment linked to goal
        inv_resp = await client.post(
            "/investments",
            json={
                "goal_id": goal_id,
                "name": "Test Fund",
                "asset_class": "equity_mf",
                "expected_cagr": 12.0,
            },
            headers=auth_headers,
        )
        inv_id = inv_resp.json()["id"]

        # Delete goal
        delete_resp = await client.delete(f"/goals/{goal_id}", headers=auth_headers)
        assert delete_resp.status_code == 204

        # Verify investment is also gone
        inv_check = await client.get(
            f"/investments/{inv_id}", headers=auth_headers
        )
        assert inv_check.status_code == 404
```

### 9.3 Frontend: Vitest

**Directory Structure:**
```
frontend/tests/
├── setup.ts                  # Test setup (MSW, custom matchers)
├── unit/
│   ├── format-currency.test.ts
│   ├── validators.test.ts
│   └── components/
│       ├── rag-badge.test.tsx
│       ├── currency-display.test.tsx
│       └── goal-card.test.tsx
└── integration/
    ├── mocks/
    │   └── handlers.ts       # MSW request handlers
    ├── hooks/
    │   ├── use-goals.test.tsx
    │   └── use-dashboard.test.tsx
    └── pages/
        └── dashboard.test.tsx
```

**Unit Test Example:**

```typescript
// frontend/tests/unit/format-currency.test.ts

import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/format-currency";

describe("formatINR", () => {
  it("formats amounts below 1 lakh with Indian comma separating", () => {
    expect(formatINR(45000)).toBe("45,000");
    expect(formatINR(1234)).toBe("1,234");
    expect(formatINR(0)).toBe("0");
  });

  it("formats amounts in lakhs", () => {
    expect(formatINR(100000)).toBe("1.00 L");
    expect(formatINR(150000)).toBe("1.50 L");
    expect(formatINR(2500000)).toBe("25.00 L");
    expect(formatINR(9999999)).toBe("100.00 L");
  });

  it("formats amounts in crores", () => {
    expect(formatINR(10000000)).toBe("1.00 Cr");
    expect(formatINR(50000000)).toBe("5.00 Cr");
    expect(formatINR(123456789)).toBe("12.35 Cr");
  });

  it("handles negative amounts", () => {
    expect(formatINR(-250000)).toBe("-2.50 L");
    expect(formatINR(-50000000)).toBe("-5.00 Cr");
  });
});
```

**MSW Integration Test Example:**

```typescript
// frontend/tests/integration/mocks/handlers.ts

import { http, HttpResponse } from "msw";

const API_URL = "http://localhost:8000/api/v1";

export const handlers = [
  http.get(`${API_URL}/dashboard`, () => {
    return HttpResponse.json({
      summary: {
        total_invested: 2500000,
        total_invested_formatted: "25.00 L",
        total_current_value: 3100000,
        total_current_value_formatted: "31.00 L",
        total_unrealized_gain: 600000,
        overall_return_pct: 24.0,
        active_goals: 2,
        goals_on_track: 1,
        goals_at_risk: 1,
      },
      asset_allocation: [
        { asset_class: "equity_mf", current_value: 2000000, allocation_pct: 64.5 },
        { asset_class: "debt_mf", current_value: 600000, allocation_pct: 19.4 },
      ],
      goals: [
        {
          id: "goal-1",
          name: "Retirement",
          target_amount_formatted: "5.00 Cr",
          rag_status: "green",
          progress_pct: 104.6,
          target_date: "2045-06-01",
        },
      ],
      recent_entries: [],
    });
  }),

  http.get(`${API_URL}/goals`, () => {
    return HttpResponse.json({
      goals: [
        {
          id: "goal-1",
          name: "Retirement",
          target_amount: 50000000,
          target_amount_formatted: "5.00 Cr",
          target_date: "2045-06-01",
          status: "active",
          rag_status: "green",
          progress_pct: 104.6,
          investment_count: 2,
          total_invested: 1200000,
          total_current_value: 1450000,
          total_projected_value: 52300000,
          created_at: "2026-01-15T10:30:00Z",
        },
      ],
      count: 1,
    });
  }),
];
```

### 9.4 E2E: Playwright

**Directory Structure:**
```
frontend/tests/e2e/
├── fixtures/
│   └── auth.ts               # Login helper fixture
├── login.spec.ts
├── dashboard.spec.ts
├── goal-crud.spec.ts
├── investment-entry.spec.ts
└── playwright.config.ts
```

**E2E Test Example:**

```typescript
// frontend/tests/e2e/goal-crud.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Goal Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[name="email"]', "test@engoal.app");
    await page.fill('[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("create a new goal and verify RAG status", async ({ page }) => {
    await page.click('a[href="/goals/new"]');
    await page.waitForURL("/goals/new");

    await page.fill('[name="name"]', "Emergency Fund");
    await page.fill('[name="target_amount"]', "500000");
    await page.fill('[name="target_date"]', "2028-12-31");
    await page.click('button[type="submit"]');

    // Should redirect to goal detail
    await expect(page.locator("h1")).toContainText("Emergency Fund");
    // No investments yet, so RAG should be red
    await expect(page.locator('[data-testid="rag-badge"]')).toContainText(
      "Off Track"
    );
  });

  test("delete a goal shows confirmation dialog", async ({ page }) => {
    await page.goto("/goals");
    await page.click('[data-testid="goal-card"]:first-child');

    await page.click('[data-testid="delete-goal-btn"]');
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    await expect(page.locator('[role="alertdialog"]')).toContainText(
      "permanently delete"
    );
  });
});
```

### 9.5 Test Commands

**Backend:**
```bash
# Run all backend tests
cd backend && uv run pytest -v

# Run only unit tests
cd backend && uv run pytest tests/unit/ -v

# Run with coverage
cd backend && uv run pytest --cov=app --cov-report=term-missing

# Run a specific test file
cd backend && uv run pytest tests/unit/test_rag.py -v
```

**Frontend:**
```bash
# Run all Vitest tests
cd frontend && npx vitest run

# Run in watch mode
cd frontend && npx vitest

# Run with coverage
cd frontend && npx vitest run --coverage

# Run Playwright E2E
cd frontend && npx playwright test

# Run Playwright with UI
cd frontend && npx playwright test --ui
```

### 9.6 CI Pipeline

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: engoal_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd="pg_isready -U test"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          version: "0.5"
      - name: Install dependencies
        working-directory: backend
        run: uv sync
      - name: Lint (ruff)
        working-directory: backend
        run: uv run ruff check .
      - name: Format check (ruff)
        working-directory: backend
        run: uv run ruff format --check .
      - name: Type check (mypy)
        working-directory: backend
        run: uv run mypy app/
      - name: Test (pytest)
        working-directory: backend
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5433/engoal_test
        run: uv run pytest -v --cov=app --cov-report=xml

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      - name: Lint
        working-directory: frontend
        run: npx next lint
      - name: Type check
        working-directory: frontend
        run: npx tsc --noEmit
      - name: Unit + Integration tests
        working-directory: frontend
        run: npx vitest run --coverage
      - name: Install Playwright browsers
        working-directory: frontend
        run: npx playwright install --with-deps chromium
      - name: E2E tests
        working-directory: frontend
        run: npx playwright test
```

---

## Appendix A: Environment Variables

```bash
# backend/.env (NEVER committed to git)

# Database
DATABASE_URL=postgresql+asyncpg://engoal:secret@localhost:5432/engoal

# JWT
JWT_SECRET_KEY=<random-64-char-hex>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# App
APP_ENV=development
APP_DEBUG=true
CORS_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_DEFAULT=60/minute
```

```bash
# frontend/.env.local (NEVER committed to git)

NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Appendix B: Docker Compose (Development)

```yaml
# docker-compose.yml

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: engoal
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: engoal
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-ONLY", "pg_isready", "-U", "engoal"]
      interval: 5s
      timeout: 3s
      retries: 5

  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: engoal_test
    ports:
      - "5433:5432"

volumes:
  pgdata:
```

---

## Appendix C: Default Expected CAGR by Asset Class

These are suggested defaults when creating investments. The user can override them.

| Asset Class | Default CAGR | Rationale |
|---|---|---|
| Equity Mutual Funds | 12.0% | Long-term Nifty 50 CAGR (15-year rolling average) |
| Debt Mutual Funds | 7.0% | Conservative estimate for short/medium term debt funds |
| Fixed Deposits | 7.0% | Approximate post-tax FD return at 30% tax bracket |
| Gold | 9.0% | 10-year historical gold CAGR in INR |
| Real Estate | 8.0% | Conservative estimate for urban residential property appreciation |
| Smallcase | 14.0% | Active/thematic equity basket — premium over index equity MF due to targeted sector/strategy exposure. Conservative relative to typical smallcase marketing claims. User should override based on the specific smallcase's stated mandate. |

---

*End of Technical Design Document*
