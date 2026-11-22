# 🧪 Testing Guide & Test Cases — Helping Hands

This document provides setup instructions, test credentials, automated test commands, and 15 end-to-end test cases covering authentication, role management, multi-organizer company workflows, conflict prevention, and database integrity.

---

## 1. Environment & Database Preparation

### 1.1 Apply Migrations & Seed Test Data
Run the organization/column migration and load the clean test dataset (2 companies, 5 organizers, 6 volunteers, 10 projects, 28 applications):

    psql -d volunteer_db -f volunteer_backend/migrations/004_organizations_and_missing_columns.sql
    psql -d volunteer_db -f volunteer_backend/seed_test_data.sql

*(Add `-U postgres` if your PostgreSQL setup requires an explicit database user.)*

### 1.2 Start Backend with Mailtrap SMTP (macOS / Linux)
Before testing registration or password reset, configure Mailtrap Sandbox credentials in the same terminal where Uvicorn runs:

    export DATABASE_URL="postgresql://localhost:5432/volunteer_db"
    export SECRET_KEY="helping_hands_local_secret_key_for_testing"
    export FRONTEND_URL="http://localhost:5173"
    export SMTP_HOST="sandbox.smtp.mailtrap.io"
    export SMTP_PORT="2525"
    export SMTP_USER="<mailtrap-username>"
    export SMTP_PASSWORD="<mailtrap-password>"
    export SMTP_FROM="noreply@helpinghands.test"

    uvicorn main:app --reload

Start the frontend in a second terminal (`volunteer_frontend`):

    npm run dev

---

## 2. Pre-Seeded Test Accounts

All seeded accounts share the same password: **`Test1234`**

| Email | Role | Company / Org Status | Testing Purpose |
|---|---|---|---|
| `super1@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`super_organizer`, `active`) | Company owner: invite code `GREEN001`, approve/remove colleagues, transfer super role, manage any company project |
| `org1@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`organizer`, `active`) | Second organizer: create own projects, review company applications; cannot delete super-organizer projects or edit company info |
| `org1_pending@helpinghands.test` | `organizer` | **Green Almaty Foundation** (`organizer`, `pending`) | Joined via invite code; blocked from creating projects until approved by `super1` |
| `super2@helpinghands.test` | `organizer` | **Qamqor Care** (`super_organizer`, `active`) | Second company (`QAMQOR02`) for cross-company isolation testing |
| `org2@helpinghands.test` | `organizer` | **Qamqor Care** (`organizer`, `active`) | Second active organizer in Qamqor Care |
| `vol1@helpinghands.test` | `volunteer` | Verified (`email_verified = true`) | Standard volunteer; project *"Цифровая грамотность для пенсионеров"* is open for new applications |
| `vol2@helpinghands.test` – `vol5@helpinghands.test` | `volunteer` | Verified (`email_verified = true`) | Seeded with `confirmed`, `pending`, `cancelled`, and `attended` applications |
| `vol6_unverified@helpinghands.test` | `volunteer` | Unverified (`email_verified = false`) | Verifies email confirmation banner and `403` block on applying |

### Special Projects in Seed Data
* **«Эко-лекторий для школьников»** — `status = 'full'` (2/2 confirmed) → verifies capacity lock.
* **«Сортировка вторсырья на складе»** — `applications_open = false` → verifies closed-applications lock.
* **«Велопробег за чистый воздух»** — `status = 'cancelled'` → verifies cancellation badge & reason display.
* **«Осенняя очистка тропы на Кок-Жайляу»** — past event with `attended` registrations & `hours_contributed`.

---

## 3. Running Automated & DB Tests

From `volunteer_backend` (with `venv` activated):

    python -m unittest -v

For PostgreSQL constraint & trigger QA tests:

    psql -d volunteer_db -f qa_db_tests/qa_db_tests.sql

---

## 4. 15 Functional & Security Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| **TC-01** | Volunteer registration & email verification | Mailtrap configured, backend & frontend running | 1. Open `#/auth?tab=register`. 2. Select **Volunteer**, fill name, new email (`vol_new@example.com`), password (`Test1234`). 3. Submit and open email in Mailtrap Sandbox. 4. Click **Verify email**. | Account created with `email_verified = false`; verification link sets `email_verified = true` and enables project applications. |
| **TC-02** | Organizer registration (Create Company) | Mailtrap configured | 1. Open `#/auth?tab=register`, select **Organizer** → **Create new company**. 2. Enter company name (`Eco Test`), name, email, password. 3. Verify email and open `#/dashboard`. | User becomes `super_organizer` (`active`) in `organization_members`; unique `invite_code` is visible in **Company team**. |
| **TC-03** | 2nd Organizer registration with valid & invalid invite code | Company `Green Almaty Foundation` (`GREEN001`) exists | 1. Select **Organizer** → **Join existing company**. 2. Enter invalid code `WRONG123` → submit. 3. Replace with `GREEN001` and submit. | `WRONG123` returns `400` (`Invalid company invite code`). `GREEN001` creates member in `organization_members` with `org_role = 'organizer'` and `status = 'pending'`. |
| **TC-04** | Pending organizer restriction & approval | Logged in as `org1_pending@helpinghands.test`, then `super1@helpinghands.test` | 1. Log in as `org1_pending@helpinghands.test` and open `#/dashboard`. 2. Confirm **New Project** is disabled and pending banner is shown. 3. Log in as `super1@helpinghands.test` and click **Approve** next to `org1_pending`. 4. Refresh `org1_pending` session (`F5`). | Before approval, `POST /api/projects` returns `403`. After approval, `org1_pending` becomes `active` and can create projects. |
| **TC-05** | Session persistence & sync on page refresh | Logged in as any user | 1. Navigate to `#/dashboard` or `#/profile`. 2. Press **F5** / reload browser tab. | User stays logged in (`localStorage` token + user), route stays unchanged, and `GET /api/auth/me` syncs latest `org_role` and `org_status`. |
| **TC-06** | Profile update & company-profile lock | Logged in as `org1@helpinghands.test`, then `super1@helpinghands.test` | 1. As `org1`, open `#/profile` and inspect company fields. 2. Attempt `PUT /api/profile/{id}` with `company_name` via API. 3. Upload avatar as `org1`. 4. Edit company website as `super1`. | Company inputs are `readOnly` for `org1` (API returns `403`). Both can update personal avatar/password; only `super1` can update company details. |
| **TC-07** | Public organizer page visibility | Logged in as `vol1@helpinghands.test` (or anonymous guest) | 1. Open `#/projects`, click any project. 2. Click the organizer's name link (`#/organizers/{id}`). | Public company profile and list of open company projects load via `/api/organizers/{id}/public/projects` without `401`/`403` errors. |
| **TC-08** | Theme switching & multilingual UI | Any page open | 1. Click palette button in header and switch `Green` → `Pink` → `Dark`. 2. Switch language `EN` → `RU` → `KZ`. 3. Refresh browser. | Theme colors and translations update immediately and persist in `localStorage`. |
| **TC-09** | Catalog search, filters & sorting | Projects seeded in DB | 1. Open `#/projects`. 2. Filter by category `Environment`, city `Almaty`, check **Only free spots**, sort by **Most spots left**. 3. Reset filters. | Matching open/full projects appear in sorted order; reset restores full catalog. |
| **TC-10** | Volunteer application validation & restrictions | Seeded test accounts & projects | 1. As `vol6_unverified`, open any open project. 2. As `vol1`, open *"Цифровая грамотность для пенсионеров"*, type 10 chars of motivation. 3. Type 25 chars and submit. 4. Open *"Сортировка вторсырья"* (`applications_open = false`). | Unverified user sees verification prompt (`403`). Submit button stays disabled under 20 chars. Valid motivation succeeds (`pending`). Closed project blocks applications. |
| **TC-11** | Duplicate application & capacity limit enforcement | `vol1` applied to project; project *"Эко-лекторий"* has 2/2 confirmed | 1. Attempt second `POST /api/projects/{id}/apply` for same project as `vol1`. 2. Attempt to confirm a 3rd volunteer in a 2-spot project. | Duplicate application rejected by unique constraint (`uq_user_project`). Over-capacity confirmation blocked by `409` / `check_project_capacity()` trigger. |
| **TC-12** | Multi-organizer project permissions | Logged in as `org1@helpinghands.test` (company member) | 1. Open `#/dashboard`. 2. Check buttons on `super1`'s project vs `org1`'s own project. 3. Attempt `DELETE /api/projects/{super1_project_id}` as `org1`. | `org1` sees all company projects and reviews applications, can edit/delete own projects, but cannot modify/delete `super1`'s project (`403`). `super1` can manage all company projects. |
| **TC-13** | Concurrent project editing conflict (`409 Conflict`) | Two browser sessions (`super1` and `org1`) open edit modal for the same project | 1. `super1` saves edits (`version` increments `1 → 2`). 2. `org1` submits edits from already-open modal (`version: 1`). | `PUT /api/projects/{id}` returns `409 Conflict` for `org1`, preventing silent overwrite of `super1`'s changes and refreshing UI data. |
| **TC-14** | Concurrent application review conflict (`409 Conflict`) | `super1` and `org1` view same `pending` application | 1. `super1` clicks **Approve** (`pending → confirmed`). 2. `org1` clicks **Reject** without refreshing (`expected_status: "pending"`). | Backend row lock (`FOR UPDATE`) detects status mismatch and returns `409 Conflict` instead of overwriting `super1`'s decision. |
| **TC-15** | Super organizer transfer & account deletion safety | Active `super1` and active `org1` in Green Almaty | 1. As `super1`, try **Delete Account** while `org1` is active. 2. Click **Make super** next to `org1`. 3. Confirm DB constraint prevents two active `super_organizer` rows. | Step 1 returns `400` ("Transfer the super organizer role..."). Step 2 atomically switches `org1` to `super_organizer` and `super1` to `organizer`; partial unique index `uq_one_super_organizer_per_org` guarantees only one super organizer exists. |