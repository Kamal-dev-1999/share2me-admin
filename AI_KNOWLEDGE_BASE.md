# Share2Me Admin Portal - AI Knowledge Base

> **AI Assistant Instruction:** Before making any modifications to the `admin` folder or troubleshooting issues, please read this document in its entirety to understand the architecture, data flow, and specific implementation details of the Share2Me Admin Portal.

## 1. System Architecture
The Admin Portal is a completely standalone application distinct from the main Share2Me peer-to-peer site. It is split into a decoupled frontend and backend.

- **Frontend:** Next.js (App Router), styled with Tailwind CSS & Lucide React. Hosted on **Vercel** (`share2me-admin-peach.vercel.app`).
- **Backend:** Node.js / Express.js server. Hosted on **Render** (`share2me-admin.onrender.com`).
- **Database (Metrics):** PostgreSQL via Supabase (used strictly for dashboard analytics like transfer logs, user counts, and Stripe revenue).
- **Storage (Blogs):** AWS S3 API (specifically Cloudflare R2 bucket `share2me-auto-blogs-prod`). Blogs are stored as structured JSON files, **not** HTML or Markdown, to allow dynamic rendering on the main site.

## 2. Environment Variables & Deployment
When deploying or debugging API connectivity, remember that the Next.js frontend is configured to rewrite `/api/admin/*` requests to the backend API. 
- In Vercel, `NEXT_PUBLIC_API_URL` **must** be set to the backend Render URL (e.g., `https://share2me-admin.onrender.com/api/admin`).
- If `NEXT_PUBLIC_API_URL` is missing, it falls back to `http://localhost:4000/api/admin`, which will break production data fetching.

### Required Backend Secrets:
- `AUTH_JWT_SECRET` (For verifying Google OAuth admin tokens)
- `DATABASE_URL` (Supabase Postgres)
- `STRIPE_SECRET_KEY` (For revenue metrics)
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` & `S3_BLOGS_BUCKET` (For S3 JSON blogs)
- `GITHUB_PAT` & `GITHUB_OWNER` & `GITHUB_REPO` (For triggering GitHub Actions)
- `AUTHORIZED_ADMIN_EMAILS` (Comma-separated list of allowed Google emails)

## 3. Authentication Flow
The portal is locked down using **NextAuth.js** with the **Google Provider**.
1. A user attempts to log in via Google.
2. NextAuth intercepts the email and checks if it exists in the `AUTHORIZED_ADMIN_EMAILS` environment variable.
3. If the email is not in the list, access is immediately denied (`Unauthorized`).
4. If authorized, NextAuth issues a session token. All subsequent API calls from the frontend attach the email via the `X-Admin-Email` HTTP header.
5. The backend (`admin/backend/lib/adminAuth.js`) verifies this header against its own copy of `AUTHORIZED_ADMIN_EMAILS` before processing any request.

## 4. Blog Publishing System (Critical)
The Share2Me main site expects blogs to be highly structured JSON files, allowing it to render complex dynamic layouts.

**Data Structure:**
Previously, manual blogs were saved with raw HTML (`htmlContent`). This has been deprecated. All blogs MUST conform to the following JSON structure:
```json
{
  "title": "...",
  "slug": "...",
  "category": "...",
  "intro": "Text block (can contain markdown images)",
  "sections": [
    {
      "heading": "...",
      "content": "...",
      "bullets": ["Point 1", "Point 2"]
    }
  ],
  "conclusion": "..."
}
```
**Frontend Editor (`admin/frontend/app/blogs/editor/page.tsx`):**
- Uses a dynamic React form allowing admins to add/remove sections and bullets. 
- Includes instant local SEO validation (checking lengths of meta descriptions, title limits, etc.).
- Allows multi-destination deployment targeting specific frontend domains (e.g., `share2.me` vs `share2me.in`).

**Backend Publisher (`admin/backend/lib/publisher.js`):**
- Parses the incoming structured payload and executes an AWS S3 `PutObjectCommand` to save the JSON directly to the bucket under `blogs/{slug}.json`.

## 5. Auto-Blog Generation (GitHub Actions)
The dashboard features an "Auto-Generate Blog" button. 
- This button hits the `POST /api/admin/actions/trigger-github` endpoint.
- The backend utilizes the `GITHUB_PAT` to send a `workflow_dispatch` event to the `auto-blog-cron.yml` workflow on GitHub.
- The GitHub Action runs a Node script that uses the Gemini API to generate a brand new structured blog and pushes it to S3 automatically.

## 6. Dashboard Metrics
The home dashboard fetches real-time stats by querying the Supabase PostgreSQL database directly using the `pg` library (`admin/backend/routes/dashboard.js`).
- It queries `g2p_transfers` for transfer counts.
- It queries `g2p_peers` for user counts.
- It integrates with the Stripe SDK to pull the current MRR (Monthly Recurring Revenue).

## 7. Troubleshooting Guidelines for AI
- **CORS Errors:** Ensure the `FRONTEND_URL` environment variable on the Render backend exactly matches the Vercel production URL.
- **404 API Not Found on Frontend:** Verify `NEXT_PUBLIC_API_URL` is set in Vercel. Next.js API rewrites in `next.config.mjs` depend on this variable.
- **403 GitHub API Error:** The `GITHUB_PAT` token either expired or lacks the `workflow` scope (for Classic tokens) or `Actions: Read and Write` permissions (for Fine-Grained tokens).
- **Manual Blogs Not Rendering on Main Site:** The blog was likely created using the old `htmlContent` schema instead of the new `sections` array schema. It must be recreated or manually migrated.
