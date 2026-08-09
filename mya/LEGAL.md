# Mya's World — Legal & Compliance Requirements
## Vistamations | 2026-08-09T12:20 AEST

### ⚠️ CRITICAL: COPPA Compliance (Children's Online Privacy Protection Act)

Since Mya is a child and this page is for her:

| Requirement | Status | Action |
|-------------|--------|--------|
| **Parental consent** | Required | Pete must provide explicit consent before any data collection |
| **Verifiable parent identity** | Required | Email verification to hops89@gmail.com or hops1010@gmail.com |
| **Data minimization** | Required | Only collect name + Fortnite tag — nothing else without consent |
| **Right to deletion** | Required | Must provide "delete my data" button at all times |
| **Privacy policy** | Required | Must be accessible from every page, written for parents |
| **No behavioral advertising** | Required | Zero ad tracking — no cookies beyond session |
| **No third-party data sharing** | Required | All data stays in Cloudflare D1, never shared |
| **Age screening** | Required | Gate before any form: "Are you under 13?" with parental redirect |

### Image Licensing

| Source | License | Cost |
|--------|---------|------|
| **Adobe Firefly** | Commercial-safe, trained on licensed content | $25 credit, 500 credits to spend |
| **Pinterest** | User-generated, NOT commercially licensed | Cannot use Pinterest images directly — source ONLY |
| **Adobe Stock** | Licensed per-image | Part of the $25 credit pool |

### Adobe Firefly Auth

- **Account**: hops89@gmail.com
- **Credit**: $25 prepaid
- **Spending plan**: 500 credits for image/video generation
- **API**: Adobe Firefly API (needs OAuth 2.0 client credentials)
- **Blockers**: None known — account active, credit available
- **Watch for**: Rate limits, credit depletion alerts at 100/50/25 remaining

### Cloudflare Configuration

| Setting | Value |
|---------|-------|
| **Domain** | www.vistamations.com/mya |
| **Account** | hops1010@gmail.com (Cloudflare login) |
| **Business email** | info@vistamations.com |
| **Email routing** | info@ → hops1010@gmail.com (Cloudflare Email Routing) |
| **D1 database** | vistamations-agent-memory (table: mya_customers) |
| **SSL** | Automatic via Cloudflare edge certificates |

### Email Routing Setup

```
Cloudflare Dashboard → Email → Email Routing
  Route: info@vistamations.com → hops1010@gmail.com
  Verification: DNS TXT record auto-added
  Test: Send to info@vistamations.com → should arrive in hops1010@gmail.com
```

### Agent Assignments

| Agent | Role | Task |
|-------|------|------|
| **Stefi (AG008)** | UI/Graphic Design | Fortnite-themed assets, color palette, card designs, Adobe Firefly prompts |
| **Trinity (AG002)** | Infrastructure Stability | Monitor nginx, Docker, Redis — alert if /mya goes down |
| **Big Brother (AG006)** | Engineering | Build page, wire nginx, D1 schema, legal compliance |
| **Dee (AG007)** | Research | Search Pinterest for Fortnite inspiration (no direct image use — attribution only) |
| **Terence (AG009)** | Think Tank | Evaluate Fortnite trend data, suggest content strategy for Mya |
| **Olivia (AG004)** | Operations | Coordinate agents, report to Pete, handle customer registration |

### Immediate Actions

1. ✅ Page created: `mya/index.html` — Fortnite bento infinite-scroll
2. ✅ Nginx route: `/mya` → `mya/index.html`
3. ✅ D1 migration: `0002_mya_customers.sql` (COPPA-compliant schema)
4. ⏳ Adobe Firefly API auth (hops89@gmail.com — needs OAuth client setup)
5. ⏳ Cloudflare Email Routing (info@ → hops1010@gmail.com)
6. ⏳ Deploy mya/ to Cloudflare Pages for www.vistamations.com/mya
7. ⏳ COPPA consent banner on /mya page
8. ⏳ Stefi to produce Fortnite-themed graphics
9. ⏳ Trinity to add /mya health monitoring to scheduled status checks
