# 🔐 IAM & Secrets Audit Report

**Date:** January 27, 2026
**Auditor:** Antigravity AI - IAM Module
**Target:** Supabase Keys & Identity Management

---

## 1. 🔍 Secret Scanning Results

### A. Environment Variables (`.env.local`)
*   **Status:** ✅ **SECURE**
*   **Found:**
    *   `NEXT_PUBLIC_SUPABASE_URL`: Hardcoded endpoint (Public).
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_...` (Public).
*   **Analysis:** These keys are designed to be exposed to the client (Browser). No private keys (`SERVICE_ROLE`) were found in this file.

### B. Source Code Repository
*   **Status:** 🚨 **CRITICAL FAIL**
*   **Finding:** Hardcoded Credentials in `scripts/create_admin_no_deps.js`.
    *   **Line 5:** Hardcoded API Key.
    *   **Line 11:** Hardcoded Admin Password (`U78...`).
*   **Risk:** If this file is committed to GitHub, the Admin password is compromised immediately.
*   **Remediation:** DELETE this script immediately or refactor it to use `process.env`. The password must be rotated.

### C. Key Format Anomaly
*   **Observation:** The `ANON_KEY` uses the format `sb_publishable_...`.
*   **Note:** Standard Supabase keys are usually JWTs (`eyJ...`). While `sb_publishable_` might be valid for specific new gateways, ensure this is the correct key from **Project Settings > API**. If authentication fails, this key format is the likely culprit.

---

## 2. 🛡️ IAM Policies Audit (Supabase Auth)

### A. Authentication flow
*   **Method:** Email/Password.
*   **Security:** `lib/supabase.js` correctly uses the singleton pattern.
*   **Registration:** The `signUp` flow in the audit scope (via script) allows creating users.
*   **Mitigation:** The active RLS policies (from previous audits) successfully quarantine new users as 'pending' (or restricted role), so even if someone runs the script, they don't get Admin access automatically without DB-level promotion.

---

## 3. 🚀 Deployment (Vercel)

*   **Env Sync:** Verify that `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel matches the one in `.env.local`.
*   **Exposure:** Since the code routes calls through `createClient`, the keys are exposed in the bundle `main.js`. This is *expected behavior* for the Anon Key, but emphasizes why **RLS is mandatory** (which you have implemented).

---

## 4. 🔥 Immediate Action Plan

1.  **SANITIZE:** Delete `scripts/create_admin_no_deps.js`.
    ```powershell
    Remove-Item scripts/create_admin_no_deps.js
    ```
2.  **ROTATE:** Change the password for `gabregu@yawi.ar` manually in the app or Supabase console, as the script exposed it.
3.  **VERIFY:** Check Supabase Dashboard to confirm your `ANON_KEY` format.

**Verdict:** IAM Architecture is sound, but **Operational Hygiene** (scripts) failed.
