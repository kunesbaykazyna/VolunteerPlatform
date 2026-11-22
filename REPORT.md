# 📄 Project Report — Helping Hands Volunteer Platform (v2)

**Course:** Basics of Information Systems  
**Project:** Helping Hands — Full-Stack Volunteer Management Platform  
**Tech Stack:** React.js (Vite, Axios), FastAPI (Python), PostgreSQL, Mailtrap SMTP  

---

## 1. Executive Summary & Completed Objectives

The second version of the **Helping Hands** platform was finalized, tested, and extended with multi-organizer company governance, database integrity verification, and full-stack user experience improvements.

### Implemented Features
1. **Frontend User Profiles (`Profile.jsx`, `OrganizerPublic.jsx`):**
   - Separate profile management for volunteers (`phone`, `skills`, `bio`) and organizations (`company_name`, `website`, `contact_phone`, `description`).
   - Profile avatar upload with client-side cropping/compression (256×256 JPEG/PNG/WebP under 300 KB) and password change functionality.
   - Public organization showcase (`#/organizers/:id`) fixed with an unauthenticated endpoint (`/api/organizers/{id}/public/projects`) so guests and volunteers can inspect company descriptions and open projects.
2. **Role-Based Registration & Email Authentication (`Auth.jsx`, `AuthFlows.jsx`):**
   - Users register either as a **Volunteer** or an **Organizer**.
   - Organizers choose between **creating a new company** (receiving an auto-generated invite code and `super_organizer` rights) or **joining an existing company** via `invite_code` (joining with `pending` status until approved).
   - Email verification (24-hour one-time token) and password reset (1-hour one-time token) integrated via Mailtrap SMTP.
3. **Session Persistence & Synchronization on Reload (`AppProvider.jsx`):**
   - JWT tokens (`HTTPBearer`, 30-minute session timeout) and user metadata persist in `localStorage` across page refreshes (`F5`), combined with hash-based routing.
   - On page load, `GET /api/auth/me` synchronizes the current user's `org_role`, `org_status`, `email_verified`, and `avatar_url` with PostgreSQL so permission changes take effect immediately upon refresh.
4. **Client Redesign & Localization (`index.css`, `Header.jsx`):**
   - Responsive UI with three selectable color themes (**Green**, **Pink**, **Dark**) persisted in `localStorage`.
   - Full interface localization across **English (EN)**, **Russian (RU)**, and **Kazakh (KZ)**.
5. **Organizer Dashboard & Multi-Organizer Governance (`Dashboard.jsx`):**
   - Project creation, editing, closing/reopening applications, cancellation with optional reason, and permanent deletion.
   - Volunteer application review with mandatory motivation (20–1000 characters), approval, rejection with reason (5–500 characters), and reopening.
   - **Company Team Panel** allowing the `super_organizer` to share the invite code, approve/remove colleagues, and transfer the `super_organizer` role.

---

## 2. Database Architecture & Relationship Enhancements

An audit of the existing PostgreSQL schema (`users`, `projects`, `volunteer_profiles`, `organization_profiles`, `registrations`) confirmed existing foreign keys (`projects.organizer_id -> users.user_id`, `volunteer_profiles.user_id -> users.user_id`, `organization_profiles.user_id -> users.user_id`, `registrations.user_id -> users.user_id`, `registrations.project_id -> projects.project_id`), while identifying two structural gaps:
1. Missing application-level columns (`users.avatar_url`, `users.email_verified`, `projects.applications_open`, `projects.cancellation_reason`, `registrations.motivation`, `registrations.rejection_reason`, and `auth_tokens`).
2. A 1:1 coupling between `users` and `organization_profiles`, which prevented two organizers from sharing one company and projects.

### Migration Enhancements (`004_organizations_and_missing_columns.sql`)
* **`organizations`:** Centralized company entity storing shared `company_name`, `website`, `description`, `contact_phone`, and a unique `invite_code`.
* **`organization_members`:** Links `users` to `organizations` with `org_role IN ('super_organizer', 'organizer')` and `status IN ('pending', 'active')`.
* **Partial Unique Index (`uq_one_super_organizer_per_org`):**
  
      CREATE UNIQUE INDEX uq_one_super_organizer_per_org
      ON public.organization_members (organization_id)
      WHERE org_role = 'super_organizer' AND status = 'active';

  This enforces at the database level that **strictly one** active `super_organizer` can exist per company.
* **`projects.organization_id` & `projects.version`:** Links projects to companies and enables optimistic concurrency locking.

---

## 3. Multi-Organizer Conflict Prevention & Security

| Conflict / Risk | Implemented Safeguard |
|---|---|
| **Company hijacking by name** | Organizers cannot join another company by typing its name; joining requires a valid secret `invite_code` plus approval by the `super_organizer`. |
| **Dual super-organizers** | Enforced by PostgreSQL partial unique index `uq_one_super_organizer_per_org` and atomic role-transfer (`make_super`) inside a single transaction. |
| **Authority conflicts** | Regular `organizer` members can create projects and review company applications, but only the `super_organizer` can edit shared company info, manage team members, or modify/delete colleagues' projects. |
| **Simultaneous project edits** | Optimistic locking via `projects.version`; stale edits are rejected with `HTTP 409 Conflict`. |
| **Simultaneous last-spot approvals** | Row-level locking (`SELECT ... FOR UPDATE OF r, p`), capacity verification inside the transaction, and `expected_status` validation (`HTTP 409 Conflict`). |
| **Orphaned company / projects on account deletion** | `DELETE /api/account` blocks a `super_organizer` from deleting their account while active colleagues remain; when a regular `organizer` leaves, their projects are automatically reassigned to the `super_organizer`. |
| **Credential & token safety** | Passwords hashed with `bcrypt`; verification/reset tokens stored strictly as `SHA-256` hashes; parameterized `%s` SQL bindings across all queries. |

---

## 4. Testing & Verification Results

### 4.1 Seeded Verification Dataset
All tables were reset (`TRUNCATE ... RESTART IDENTITY CASCADE`) and populated with realistic test data (2 companies: *Green Almaty Foundation* and *Qamqor Care*, 5 organizers including pending and super roles, 6 volunteers including unverified state, 10 projects across multiple cities/statuses, and 28 registrations).

### 4.2 Automated Unit & Integration Tests (`test_platform15.py`)
Executed via `python -m unittest test_platform15.py -v` covering password policy, token hashing/expiration, verification guardrails, invite-code validation, multi-organizer RBAC, `409 Conflict` concurrency checks, profile locking, atomic super-role transfer, and account-deletion safeguards:

    Ran 15 tests in 1.000s
    OK

*(Additional auth helper tests in `test_auth_helpers.py` and 15 end-to-end QA test cases in `test.md` passed verification.)*

---

## 5. Conclusion

All required frontend, backend, database, security, and testing tasks have been implemented and verified. The introduction of `organizations`, `organization_members`, the partial unique index for a single `super_organizer`, and transaction/version-based conflict controls ensures reliable collaboration for multiple organizers within the same company without data corruption or race conditions.