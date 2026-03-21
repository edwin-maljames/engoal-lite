# Engoal-lite — Functional Specification

> **Version:** 1.0
> **Date:** 2026-02-22
> **Status:** Draft
> **Audience:** Implementation agents (Claude Code), human reviewers

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Entities](#2-core-entities)
3. [Feature Specifications](#3-feature-specifications)
4. [User Stories](#4-user-stories)
5. [Edge Cases & Business Rules](#5-edge-cases--business-rules)

---

## 1. Overview

Engoal-lite is a personal financial goal-tracking application for a single user managing their investments in Indian Rupees (INR). The app allows the user to define financial goals (e.g., "Retirement corpus," "Child's education," "House down payment"), link real investments to those goals, and track progress month by month.

**How it works in plain English:**

1. The user creates financial goals with a target amount and target date.
2. The user registers investments (mutual funds, FDs, gold, real estate) and assigns each investment to one or more goals.
3. Every month, the user opens the app and enters two numbers per investment: how much they invested this month and what the current market-to-market (MTM) value is.
4. The system automatically calculates whether each goal is on track (Green), slightly behind (Amber), or significantly behind (Red) by projecting the current portfolio forward at each investment's expected rate of return and comparing it to the goal target.
5. A dashboard gives a bird's-eye view of all goals, total portfolio value, and asset allocation.

**Key constraints:**

- Single user, no multi-tenancy. One email/password login.
- All amounts in INR. Display uses Lakhs/Crores formatting (Indian numbering system).
- No live market data feeds. All values are manually entered by the user.
- Five supported asset classes: Equity Mutual Funds, Debt Mutual Funds, Fixed Deposits, Gold (SGBs/ETFs/physical), Real Estate.

---

## 2. Core Entities

### 2.1 User

Single user account. No registration flow needed beyond initial setup.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `email` | String | Unique, required, valid email format | Used for login |
| `password_hash` | String | Required, bcrypt or argon2 | Never stored in plain text |
| `name` | String | Required, max 100 chars | Display name |
| `created_at` | Timestamp | Auto-set | |
| `updated_at` | Timestamp | Auto-set on mutation | |

### 2.2 Goal

A financial target the user is working towards.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `user_id` | UUID | FK -> User, required | Always the single user |
| `name` | String | Required, max 200 chars | e.g., "Retirement," "Emergency Fund" |
| `description` | String | Optional, max 1000 chars | Free-text notes |
| `target_amount` | Decimal(15,2) | Required, > 0 | In INR. Max ~999,99,99,99,999.99 (999 crores) |
| `target_date` | Date | Required, must be in the future at creation time | Month + Year granularity is sufficient |
| `priority` | Enum | `HIGH`, `MEDIUM`, `LOW` | Default: `MEDIUM` |
| `status` | Enum | `ACTIVE`, `COMPLETED`, `ABANDONED` | Default: `ACTIVE` |
| `rag_status` | Enum | `GREEN`, `AMBER`, `RED`, `NOT_STARTED` | System-calculated, never user-set |
| `created_at` | Timestamp | Auto-set | |
| `updated_at` | Timestamp | Auto-set on mutation | |

### 2.3 Investment

A real-world investment instrument the user holds.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `user_id` | UUID | FK -> User, required | |
| `name` | String | Required, max 200 chars | e.g., "Parag Parikh Flexi Cap," "SBI FD 2027" |
| `asset_class` | Enum | Required. One of: `EQUITY_MF`, `DEBT_MF`, `FIXED_DEPOSIT`, `GOLD`, `REAL_ESTATE`, `SMALLCASE` | |
| `expected_return_pct` | Decimal(5,2) | Required, >= 0, <= 100 | Annual expected rate of return (CAGR). e.g., 12.00 for 12% |
| `start_date` | Date | Required | When the user started this investment |
| `notes` | String | Optional, max 1000 chars | e.g., "Maturity: March 2027", "Windmill Capital smallcase" |
| `is_active` | Boolean | Default: `true` | Soft-delete / archival flag |
| `created_at` | Timestamp | Auto-set | |
| `updated_at` | Timestamp | Auto-set on mutation | |

### 2.4 GoalInvestment (Join Table)

Links an investment to a goal. An investment can contribute to multiple goals; a goal can have multiple investments.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `goal_id` | UUID | FK -> Goal, required | |
| `investment_id` | UUID | FK -> Investment, required | |
| `allocation_pct` | Decimal(5,2) | Required, > 0, <= 100 | What percentage of this investment counts towards this goal |
| `created_at` | Timestamp | Auto-set | |

**Asset class descriptions:**

| Asset Class | Description | Typical CAGR (default) |
|-------------|-------------|------------------------|
| `EQUITY_MF` | Equity mutual funds (diversified, sectoral, index funds) | 12% |
| `DEBT_MF` | Debt mutual funds (short-term, liquid, bond funds) | 7% |
| `FIXED_DEPOSIT` | Bank or NBFC fixed deposits with guaranteed return | 7% |
| `GOLD` | Sovereign Gold Bonds, Gold ETFs, or physical gold | 9% |
| `REAL_ESTATE` | Property tracked by market value (no rental income) | 8% |
| `SMALLCASE` | Curated basket of stocks/ETFs held directly in demat account, managed by a SEBI-registered expert (e.g., via Zerodha, Groww). Tracked as a single instrument — user does not enter individual stock positions. Equity-like in risk and return profile. | 14% |

**Constraint:** For a given `investment_id`, the sum of `allocation_pct` across all linked goals MUST be <= 100%. The system must enforce this on create/update.

### 2.5 MonthlyEntry

A single month's data point for one investment. One entry per investment per month.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `investment_id` | UUID | FK -> Investment, required | |
| `month` | Date | Required, always set to first of the month | e.g., `2026-02-01` for February 2026 |
| `total_invested` | Decimal(15,2) | Required, >= 0 | **Cumulative** total capital put into this investment to date (snapshot). Not the monthly increment — the running total. |
| `current_value` | Decimal(15,2) | Required, >= 0 | Total market value of this investment as of this month |
| `created_at` | Timestamp | Auto-set | |
| `updated_at` | Timestamp | Auto-set on mutation | |

**Unique constraint:** (`investment_id`, `month`) — only one entry per investment per calendar month.

> **Snapshot model rationale:** The user records the *total* they have invested so far (e.g., ₹5.5L across 11 months of SIP), not the amount added this specific month. This is simpler to enter — just look at your investment statement and note the current invested amount and the current market value. Gain/loss = `current_value - total_invested`.

---

## 3. Feature Specifications

### 3.1 Authentication

#### 3.1.1 Login Screen

- Fields: Email, Password
- "Remember me" checkbox (persist session for 30 days via secure cookie / token)
- On successful login, redirect to Dashboard
- On failure, show inline error: "Invalid email or password"
- Rate limit: max 5 failed attempts per 15 minutes, then lock for 15 minutes

#### 3.1.2 Initial Setup

- On first launch (no user exists in DB), show a one-time setup screen:
  - Name, Email, Password, Confirm Password
  - Password requirements: minimum 8 characters, at least one uppercase, one lowercase, one digit
- After setup, redirect to Dashboard

#### 3.1.3 Session Management

- JWT-based or session-cookie-based (implementation choice)
- Token expiry: 24 hours (or 30 days if "Remember me" is checked)
- Single active session is sufficient (no multi-device requirement)

---

### 3.2 Dashboard

The landing page after login. Provides a portfolio-level overview.

#### 3.2.1 Portfolio Summary Card

| Metric | Calculation | Display Format |
|--------|-------------|----------------|
| Total Invested | Sum of the latest `total_invested` snapshot for each active investment | e.g., "12,45,000" |
| Total Current Value (MTM) | Sum of `current_value` from the latest MonthlyEntry for each active investment | e.g., "15,32,780" |
| Total Gain/Loss | Total Current Value - Total Invested | e.g., "+2,87,780" (green) or "-50,000" (red) |
| Total Gain/Loss % | ((Total Current Value - Total Invested) / Total Invested) * 100 | e.g., "+23.11%" |

#### 3.2.2 Asset Allocation Breakdown

A table and/or pie chart showing exposure across asset classes.

| Column | Description |
|--------|-------------|
| Asset Class | One of the five supported types |
| Current Value (INR) | Sum of latest `current_value` for all investments in this class |
| Allocation % | (Current Value of class / Total Current Value) * 100 |

Display as both a table and a donut/pie chart.

#### 3.2.3 Goals Overview

A card grid or list showing each active goal with:

| Element | Detail |
|---------|--------|
| Goal name | Clickable, links to Goal Detail View |
| Target amount | Formatted in INR |
| Current value | Sum of (latest `current_value` * `allocation_pct / 100`) for each linked investment |
| Progress bar | Visual bar showing current value / target amount |
| RAG status badge | Color-coded: Green / Amber / Red / Grey (not started) |
| Target date | Formatted as "MMM YYYY" (e.g., "Mar 2030") |
| Time remaining | "X years, Y months" from today |

Sort order: by RAG severity (Red first, then Amber, then Green, then Not Started), then by target date ascending.

#### 3.2.4 Recent Activity

List of the last 10 monthly entries made by the user, showing:
- Investment name
- Month
- Amount invested
- Current value
- Date entered

---

### 3.3 Goal Management

#### 3.3.1 Create Goal

**Screen:** Modal or dedicated page.

**Fields:**

| Field | Input Type | Validation |
|-------|-----------|------------|
| Name | Text input | Required, 1-200 chars |
| Description | Textarea | Optional, max 1000 chars |
| Target Amount | Number input | Required, > 0, max 99,99,99,99,999 |
| Target Date | Month/Year picker | Required, must be at least 1 month in the future |
| Priority | Dropdown | HIGH / MEDIUM / LOW. Default: MEDIUM |

**On submit:** Create the goal with `status = ACTIVE` and `rag_status = NOT_STARTED`.

#### 3.3.2 Edit Goal

- All fields editable except `id` and `created_at`.
- Changing the target amount or target date triggers an immediate RAG recalculation.
- If `status` is changed to `COMPLETED` or `ABANDONED`, the goal no longer appears on the main dashboard (moves to an archive view).

#### 3.3.3 Delete Goal

- Soft-delete: set `status = ABANDONED`.
- Confirm dialog: "Are you sure you want to abandon the goal '{name}'? This will unlink all investments from this goal."
- On confirm: set status to `ABANDONED`, delete all `GoalInvestment` rows for this goal.
- Investments themselves are NOT deleted (they may be linked to other goals).

#### 3.3.4 Goal Detail View

A dedicated page for a single goal showing all its data.

**Sections:**

**A. Goal Header**
- Name, description, target amount, target date, time remaining, priority badge
- RAG status badge (large, prominent)

**B. Progress Summary**

| Metric | Calculation |
|--------|-------------|
| Current Value | Sum of (latest MTM of each linked investment * allocation_pct / 100) |
| Total Invested | Sum of (latest `total_invested` for each linked investment * allocation_pct / 100) |
| Projected Value at Target Date | See RAG calculation formula in section 3.6 |
| Shortfall / Surplus | Projected Value - Target Amount |
| Monthly SIP Needed (to close gap) | If shortfall exists, calculate the fixed monthly investment needed to bridge the gap using the weighted average expected return |

**C. Projected Growth Chart**

- Line chart with X axis = time (monthly, from today to target date), Y axis = INR value
- Two lines:
  - **Projected line** (blue): projects from current value using the weighted average expected return of linked investments, assuming current monthly investment rate continues
  - **Target line** (red, horizontal): the goal's target amount
- Shade the area between the lines: green if projected > target, red if projected < target

**D. Linked Investments Table**

| Column | Detail |
|--------|--------|
| Investment Name | Clickable, links to investment detail |
| Asset Class | Badge/tag |
| Allocation % | The `allocation_pct` from GoalInvestment |
| Allocated Value | Latest MTM * allocation_pct / 100 |
| Expected Return | The `expected_return_pct` |
| Gain/Loss | (Latest `current_value` - Latest `total_invested`) * allocation_pct / 100 |

**E. Actions**
- "Link Investment" button — opens a picker to choose from existing investments or create a new one
- "Edit Goal" button
- "Abandon Goal" button

---

### 3.4 Investment Management

#### 3.4.1 Create Investment

**Screen:** Modal or dedicated page.

**Fields:**

| Field | Input Type | Validation |
|-------|-----------|------------|
| Name | Text input | Required, 1-200 chars |
| Asset Class | Dropdown | Required. One of: Equity Mutual Fund, Debt Mutual Fund, Fixed Deposit, Gold, Real Estate, Smallcase |
| Expected Annual Return (%) | Number input | Required, 0.00 - 100.00, two decimal places |
| Start Date | Date picker | Required, cannot be in the future |
| Notes | Textarea | Optional, max 1000 chars |

**On submit:** Create the investment with `is_active = true`.

#### 3.4.2 Edit Investment

- All fields editable.
- Changing `expected_return_pct` triggers RAG recalculation for all linked goals.

#### 3.4.3 Deactivate Investment

- Set `is_active = false`.
- The investment is hidden from the monthly entry workflow but its historical data is retained.
- Warn the user if the investment is linked to active goals: "This investment is linked to X active goals. Deactivating it will affect their RAG status."

#### 3.4.4 Investment List View

Table of all investments (active by default, with a toggle to show inactive).

| Column | Detail |
|--------|--------|
| Name | Clickable |
| Asset Class | Badge |
| Current Value | Latest `current_value` from MonthlyEntry |
| Total Invested | Latest `total_invested` from the most recent MonthlyEntry |
| Gain/Loss | Current Value - Total Invested |
| Gain/Loss % | Percentage |
| Expected Return | `expected_return_pct` |
| Linked Goals | Comma-separated list of goal names |

#### 3.4.5 Link Investment to Goal

- When linking, the user must specify `allocation_pct` (what percentage of this investment counts towards this goal).
- Validation: sum of `allocation_pct` across all goals for this investment must not exceed 100%.
- If the user tries to allocate more than the remaining unallocated percentage, show an error: "Only X% of this investment is unallocated. You can allocate up to X%."

---

### 3.5 Monthly Data Entry Workflow

This is the core recurring interaction. The user does this once a month.

#### 3.5.1 Entry Screen

**Trigger:** User clicks "Monthly Entry" in the navigation, or is prompted by a banner on the dashboard if the current month has no entries yet.

**Step 1: Select Month**
- Default: current month (e.g., "February 2026")
- Allow selecting a past month if entries were missed (dropdown of the last 12 months)
- If entries already exist for the selected month, pre-fill the values for editing

**Step 2: Investment Entry Form**

Display a form (table layout preferred) with one row per active investment:

| Column | Input Type | Notes |
|--------|-----------|-------|
| Investment Name | Read-only label | |
| Asset Class | Read-only badge | |
| Previous Month Value (MTM) | Read-only | Latest `current_value` from the prior month. Shows "--" if first entry. |
| Previous Total Invested | Read-only | Latest `total_invested` from the prior month. Shows "--" if first entry. Helps user verify they enter the right cumulative figure. |
| Total Invested to Date | Number input | Required. The **cumulative** total you have put into this investment so far (across all time, not just this month). |
| Current Market Value (MTM) | Number input | Required. The total market value of this investment right now. |

**Behavior:**
- All active investments are shown. The user enters two numbers per investment: total invested to date and current market value.
- Example: if you've been doing a ₹10,000/month SIP for 11 months, enter `total_invested = 1,10,000` — not `10,000`.
- If no new money was added this month, `total_invested` will be the same as last month. That's fine — enter it again.
- "Save Draft" button: saves entries without triggering RAG recalculation.
- "Submit" button: saves all entries and triggers RAG recalculation for all affected goals.

**Step 3: Confirmation**

After submit, show a summary:
- Total portfolio value: sum of all `current_value` entered this month
- Total invested across portfolio: sum of latest `total_invested` for all investments
- Overall gain/loss: total current value - total invested
- Month-over-month value change: this month's total current value vs. last month's total current value
- RAG status changes: list any goals whose RAG status changed (e.g., "Retirement: Green → Amber")

#### 3.5.2 Entry Reminders

- If today is after the 25th of the month and the current month has no entries, show a persistent banner on the dashboard: "You haven't entered your monthly data for {Month}. Enter now."

---

### 3.6 RAG Status Calculation

This is the most important business logic in the application. The RAG status indicates whether a goal is on track, slightly behind, or significantly behind.

#### 3.6.1 Inputs

For a given goal, collect the following:

```
current_value    = Sum of (latest MTM of each linked investment * allocation_pct / 100)
years_remaining  = (goal.target_date - today) / 365.25   (fractional years)
target_amount    = Goal's target_amount
```

For each linked investment, its `expected_return_pct` (annual CAGR) is used. The weighted average return is calculated as:

```
weighted_return = Sum of (investment_current_value_allocated * expected_return_pct)
                  / Sum of (investment_current_value_allocated)
```

Where `investment_current_value_allocated = latest MTM * allocation_pct / 100`.

#### 3.6.2 Projected Future Value Calculation

The projection answers: **"If I invest no more money, will my existing portfolio grow to reach the goal?"**

```
projected_value = current_value * (1 + weighted_return / 100) ^ years_remaining
```

This is a pure CAGR compounding formula. No future contributions are assumed — the projection reflects only the growth of the current corpus.

**Why no SIP component?** The snapshot model does not capture monthly flow; it captures the state of the portfolio at a point in time. The projection is conservative by design: it tells you whether what you have *right now* is sufficient. If it is, great. If not, the shortfall tells you how much ground you need to make up.

#### 3.6.3 RAG Determination

```
shortfall_pct = (target_amount - projected_value) / target_amount * 100
```

| Condition | RAG Status | Display |
|-----------|-----------|---------|
| `projected_value >= target_amount` | GREEN | On Track |
| `0 < shortfall_pct <= 15` | AMBER | Slightly Behind |
| `shortfall_pct > 15` | RED | Significantly Behind |
| No investments linked or no entries exist | NOT_STARTED | Not Started |

#### 3.6.4 When to Recalculate

RAG status must be recalculated:
- When a monthly entry is submitted (for all goals linked to the affected investments)
- When a goal's target amount or target date is edited
- When an investment's expected return is changed
- When a GoalInvestment link is created, modified, or deleted
- When an investment is deactivated

Store the calculated `rag_status` on the Goal entity for fast reads on the dashboard.

#### 3.6.5 Monthly SIP Required to Close Gap

When `rag_status` is AMBER or RED, calculate what monthly SIP the user would need to start (on top of corpus growth) to bridge the shortfall by the target date. This is a recommendation, not a tracked value.

```
monthly_rate = (1 + weighted_return / 100) ^ (1/12) - 1
months_remaining = years_remaining * 12
gap = target_amount - projected_value
required_sip = gap * monthly_rate / ((1 + monthly_rate) ^ months_remaining - 1)
```

Display this as: "Start a monthly SIP of ~₹X to reach your goal on time."

Note: this is purely informational. The system does not track whether the user actually starts this SIP — it will naturally show up in future snapshots as `total_invested` grows and `current_value` increases.

---

### 3.7 Asset Allocation View

A dedicated page (also summarized on the Dashboard) showing how the portfolio is distributed across asset classes.

#### 3.7.1 Allocation Table

| Column | Calculation |
|--------|-------------|
| Asset Class | One of the six supported types |
| Number of Investments | Count of active investments in this class |
| Current Value (INR) | Sum of latest `current_value` for all investments in this class |
| Allocation % | (Class Value / Total Portfolio Value) * 100 |
| Total Invested (INR) | Sum of latest `total_invested` for investments in this class |
| Gain/Loss (INR) | Current Value - Total Invested |
| Gain/Loss % | ((Current Value - Total Invested) / Total Invested) * 100 |

#### 3.7.2 Visualization

- **Donut chart:** Allocation percentages with INR values on hover/tap.
- **Stacked bar over time:** Show how allocation has changed over the last 12 months (one bar per month, segments colored by asset class). Data source: MonthlyEntry values aggregated by asset class per month.

#### 3.7.3 Drill-down

Clicking an asset class row expands or navigates to a list of all investments in that class with their individual values.

---

### 3.8 INR Formatting Rules

All monetary values throughout the application must follow the Indian numbering system:

| Value | Formatted |
|-------|-----------|
| 1000 | 1,000 |
| 100000 | 1,00,000 (1 Lakh) |
| 1000000 | 10,00,000 (10 Lakhs) |
| 10000000 | 1,00,00,000 (1 Crore) |
| 150000000 | 15,00,00,000 (15 Crores) |

- Always prefix with the rupee symbol: **INR** or **₹**
- For large values on dashboard cards, use compact notation: "1.5 Cr" or "12.4 L"
- For tables and detail views, use full formatted numbers with commas

---

### 3.9 Navigation Structure

```
Sidebar / Top Nav:
  - Dashboard          (home, portfolio overview)
  - Goals              (list of all goals)
  - Investments        (list of all investments)
  - Monthly Entry      (data entry workflow)
  - Asset Allocation   (allocation breakdown)
  - Settings           (profile, password change)
```

---

## 4. User Stories

### Goal Management

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| US-01 | As a user, I want to create a financial goal with a name, target amount, and target date so that I can track my progress toward it. | Goal is saved with status ACTIVE and rag_status NOT_STARTED. Appears on dashboard. |
| US-02 | As a user, I want to edit a goal's target amount or target date so that I can adjust my plan if circumstances change. | Goal is updated. RAG status is recalculated immediately. |
| US-03 | As a user, I want to abandon a goal so that it no longer clutters my dashboard. | Goal status set to ABANDONED. Removed from dashboard. GoalInvestment links deleted. Investments retained. |
| US-04 | As a user, I want to mark a goal as completed when I've achieved it so that I can celebrate and track my wins. | Goal status set to COMPLETED. Moves to completed section. |
| US-05 | As a user, I want to set a priority (High/Medium/Low) on each goal so that I can focus on what matters most. | Priority saved. Can be used for sorting/filtering on dashboard. |

### Investment Management

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| US-06 | As a user, I want to add an investment with its asset class and expected annual return so that the system can project its future growth. | Investment saved. Appears in investment list and monthly entry form. |
| US-07 | As a user, I want to link an investment to one or more goals with a specific allocation percentage so that I know how much of each investment contributes to each goal. | GoalInvestment record created. Allocation validated (sum <= 100%). RAG recalculated for affected goals. |
| US-08 | As a user, I want to see a warning if I try to allocate more than 100% of an investment across goals so that I don't double-count. | System rejects the allocation with a clear error message showing remaining unallocated percentage. |
| US-09 | As a user, I want to deactivate an investment that I've exited so that it no longer shows in my monthly entry form but historical data is preserved. | Investment marked inactive. Hidden from monthly entry. Historical entries retained. Warning shown if linked to active goals. |

### Monthly Data Entry

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| US-10 | As a user, I want to enter the amount I invested this month and the current market value for each of my investments so that my portfolio is up to date. | MonthlyEntry records created/updated. Portfolio totals recalculated. RAG statuses recalculated. |
| US-11 | As a user, I want to see the previous month's value pre-filled next to each investment so that I can quickly spot changes. | Previous month's `current_value` displayed as read-only reference in the entry form. |
| US-12 | As a user, I want to enter data for a past month that I missed so that my records are complete. | Month selector allows past months. Entries saved with the correct month. |

### Dashboard & Insights

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| US-13 | As a user, I want to see my total portfolio value, total invested, and overall gain/loss on the dashboard so that I get an instant snapshot. | Portfolio summary card displays correct totals with INR formatting. |
| US-14 | As a user, I want to see the RAG status of each goal at a glance on the dashboard so that I know which goals need attention. | Each goal card shows correct RAG badge. Goals sorted by severity. |
| US-15 | As a user, I want to see my asset allocation as a pie chart and table so that I can check if my portfolio is properly diversified. | Donut chart and table show correct percentages and INR values per asset class. |
| US-16 | As a user, I want to see a projected growth chart for each goal so that I can visually understand whether I'll reach my target. | Line chart shows projected value over time vs. target line. Shaded area indicates surplus or shortfall. |
| US-17 | As a user, I want to see how much additional monthly investment is needed when a goal is off track so that I can take corrective action. | When RAG is AMBER or RED, the goal detail view shows the required additional monthly SIP amount. |
| US-18 | As a user, I want to be reminded if I haven't entered my monthly data so that I don't forget to update my portfolio. | Banner appears on dashboard after the 25th if current month has no entries. |

---

## 5. Edge Cases & Business Rules

### 5.1 Goal Target Date Has Passed

| Scenario | Behavior |
|----------|----------|
| Target date is in the past and goal status is ACTIVE | Display a "Past Due" badge on the goal. RAG calculation uses `months_remaining = 0`. The projected value equals the current value (no growth projection). If current value >= target amount, RAG = GREEN. Otherwise, RAG = RED. Prompt user: "This goal's target date has passed. Would you like to mark it as Completed or extend the target date?" |

### 5.2 Investment Linked to Multiple Goals

| Scenario | Behavior |
|----------|----------|
| Investment X is linked to Goal A (60%) and Goal B (40%) | Each goal only "sees" its allocated share of the investment's value and monthly contributions. The sum of allocations must not exceed 100%. The unallocated portion (0% in this case) is not counted toward any goal but still appears in portfolio totals and asset allocation. |
| User tries to add a third goal link at 20% when only 0% remains | System rejects: "This investment is fully allocated. Remove or reduce an existing goal allocation first." |
| User deactivates Investment X | Both Goal A and Goal B recalculate their RAG status without Investment X's contributions. |

### 5.3 No New Investment This Month

| Scenario | Behavior |
|----------|----------|
| User adds no new money to an investment this month | Allowed. Enter the same `total_invested` as last month (unchanged), with the updated `current_value`. |
| User skips a month entirely (no entries at all) | The system uses the last available month's data. RAG calculation still works but uses stale `current_value`. The dashboard reminder banner will appear after the 25th. |

### 5.4 First Month / No Historical Data

| Scenario | Behavior |
|----------|----------|
| Investment has no MonthlyEntry records yet | Current value = 0. It appears in the monthly entry form with "Previous: --". |
| Goal has linked investments but none have entries | RAG status = NOT_STARTED (grey badge). |
| Goal has no linked investments | RAG status = NOT_STARTED. Goal detail shows: "No investments linked. Add investments to start tracking." |

### 5.5 Investment Value Drops to Zero

| Scenario | Behavior |
|----------|----------|
| User enters `current_value = 0` | Allowed. This may mean the investment was fully redeemed or has lost all value. System should show a confirmation: "Are you sure the current value is 0? This means the investment has no market value." |
| `current_value = 0` but `total_invested > 0` in the same entry | Allowed. This indicates a total loss. No automatic flag beyond the confirmation above. Gain/loss will show as `-total_invested`. |

### 5.6 Editing Past Monthly Entries

| Scenario | Behavior |
|----------|----------|
| User edits a past month's entry | Allowed. Only the latest month's data is used for RAG calculations, but historical entries are used for charts and gain/loss history. Editing a past entry updates the historical `total_invested` and `current_value` for that month. |
| User deletes a past month's entry | Not allowed. Entries can only be edited, never deleted. This prevents accidental loss of historical data. |

### 5.7 Currency & Number Validation

| Rule | Detail |
|------|--------|
| Minimum amount | 0 (for `total_invested`), 0 (for `current_value`) |
| Maximum amount | 99,99,99,99,999.99 (approximately 999 crores) |
| Decimal places | 2 (paise). Inputs should accept integers and auto-format. |
| Negative values | Never allowed for any monetary field |
| `total_invested` decreasing | Warn the user if `total_invested` is lower than the previous month's snapshot (this would typically indicate a data entry error — you can't un-invest). Allow it after confirmation (e.g., if they partially withdrew and are recording the remaining invested amount). |

### 5.8 Expected Return Edge Cases

| Scenario | Behavior |
|----------|----------|
| `expected_return_pct = 0` | Valid. Means no growth expected (e.g., a savings account). Projected value = current value (no growth over time). |
| `expected_return_pct` is very high (e.g., 50%) | Allowed but show a soft warning: "An expected return of 50% is unusually high. Are you sure?" Threshold for warning: > 30%. |
| Weighted average return is 0 (all linked investments have 0% return) | Projected value = current value (corpus does not grow). RAG will be GREEN only if current value already meets the target. |

### 5.9 Concurrent RAG Recalculations

| Scenario | Behavior |
|----------|----------|
| Bulk monthly entry submission affects 5 goals | Calculate RAG for all 5 goals in a single batch after all entries are saved. Do not recalculate after each individual entry save within the same submission. |

### 5.10 Data Integrity Rules

| Rule | Detail |
|------|--------|
| Deleting a goal | Soft-delete only (status = ABANDONED). GoalInvestment links removed. MonthlyEntries for linked investments are NOT affected. |
| Deleting an investment | Not supported. Investments can only be deactivated (`is_active = false`). |
| Orphaned investments | An investment with no goal links is valid. It still appears in portfolio totals and asset allocation. |
| Duplicate investment names | Allowed. Investments are identified by UUID, not name. |
| Duplicate goal names | Allowed. Goals are identified by UUID, not name. |

### 5.11 Goal Completion Logic

| Scenario | Behavior |
|----------|----------|
| Current value >= target amount before target date | RAG = GREEN. Show a celebratory banner: "You've reached your target for '{goal name}' ahead of schedule!" Offer to mark as COMPLETED. Do not auto-complete. |
| User manually marks goal as COMPLETED | Status changes. Goal moves to a "Completed Goals" section. GoalInvestment links are retained (for historical view) but the allocated portions are freed up for reallocation to other goals. |

---

## Appendix A: INR Formatting Reference Implementation

```python
def format_inr(amount: float) -> str:
    """Format a number in Indian numbering system with rupee symbol."""
    if amount < 0:
        return f"-{format_inr(abs(amount))}"

    amount = round(amount, 2)
    integer_part = int(amount)
    decimal_part = round(amount - integer_part, 2)

    s = str(integer_part)
    if len(s) <= 3:
        formatted = s
    else:
        last_three = s[-3:]
        remaining = s[:-3]
        # Insert commas every 2 digits in the remaining part
        groups = []
        while remaining:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        groups.reverse()
        formatted = ",".join(groups) + "," + last_three

    if decimal_part:
        return f"₹{formatted}.{str(decimal_part).split('.')[1].ljust(2, '0')}"
    return f"₹{formatted}"
```

## Appendix B: Compact INR Notation

```
if value >= 1_00_00_000:
    display as "{value / 1_00_00_000:.1f} Cr"
elif value >= 1_00_000:
    display as "{value / 1_00_000:.1f} L"
elif value >= 1_000:
    display as "{value / 1_000:.1f} K"
else:
    display as full formatted number
```

## Appendix C: RAG Calculation Pseudocode

```python
def calculate_rag(goal):
    linked = get_goal_investments(goal.id)

    if not linked:
        return "NOT_STARTED"

    current_value = 0
    weighted_return_numerator = 0
    has_any_entry = False

    for gi in linked:
        inv = get_investment(gi.investment_id)
        latest_entry = get_latest_monthly_entry(inv.id)

        if latest_entry is None:
            continue

        has_any_entry = True
        allocated_value = latest_entry.current_value * gi.allocation_pct / 100
        current_value += allocated_value
        weighted_return_numerator += allocated_value * inv.expected_return_pct

    if not has_any_entry or current_value == 0:
        return "NOT_STARTED"

    # Weighted average expected CAGR across all linked investments
    weighted_return = weighted_return_numerator / current_value  # e.g., 12.0 for 12%

    # Years remaining (fractional)
    days_remaining = (goal.target_date - today()).days
    if days_remaining <= 0:
        projected_value = current_value  # Goal date passed — no growth projected
    else:
        years_remaining = days_remaining / 365.25
        # Project corpus forward at weighted CAGR (no future contributions assumed)
        projected_value = current_value * (1 + weighted_return / 100) ** years_remaining

    if projected_value >= goal.target_amount:
        return "GREEN"

    shortfall_pct = (goal.target_amount - projected_value) / goal.target_amount * 100

    if shortfall_pct <= 15:
        return "AMBER"
    else:
        return "RED"
```

---

*End of functional specification.*
