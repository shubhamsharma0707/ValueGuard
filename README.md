# ValueGuard — Real Estate Fair Value Detection Tool

> A full-stack financial intelligence tool that compares **Government Circle Rates** against **Estimated Market Rates** to flag overpriced or speculative properties across Indian cities and states.

---

## What It Does

ValueGuard is a property valuation dashboard covering **62 zones across 23 cities in 9 states**. It:

- Maps **all 29 Indian states** in a 3-level cascade — State → City → Zone / Area
- Pulls government-registered circle rates for each tracked zone
- Applies a multi-factor formula to estimate real market value
- Flags speculative pricing with **Safe / Caution / High Risk** risk levels
- Shows an animated variance gauge, live Chart.js comparison, city heatmap, and query history
- Provides a built-in **EMI / Loan Calculator** to gauge affordability
- Supports **Zone Comparison** (pin up to 3 zones, radar chart, side-by-side table)
- Generates a **print-friendly valuation report**
- Encodes the full UI state in a **shareable URL**

---

## Valuation Formula

The estimated market value per square foot is computed in four steps:

**Step 1 — Base Value**
```
Base = Circle Rate × Zone Multiplier
```

**Step 2 — Metro Premium**
- Within 2 km of metro → +₹800/sqft
- Within 5 km of metro → +₹400/sqft
- Beyond 5 km → ₹0

**Step 3 — Age Depreciation**
```
Depreciation = Property Age (years) × ₹120/sqft/year
```

**Step 4 — Speculative Uplift**
```
Speculative Uplift = Speculation Level (1–5) × ₹500/sqft
```

**Final Formula:**
```
Market Value  = Base + Metro Premium − Age Depreciation + Speculative Uplift
Variance %    = ((Market Value − Circle Rate) / Circle Rate) × 100

Risk Levels:  < 20% → Safe  |  20–50% → Caution  |  > 50% → High Risk
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript (ES Modules) |
| Backend | Node.js, Express 5 |
| Charts | Chart.js 4 (CDN with SRI integrity hash) |
| Security | Helmet (CSP, HSTS), express-rate-limit, CORS, dotenv |
| Data | `backend/data.json` — 62 zones, no database required |

---

## Project Structure

```
valueguard/
├── backend/
│   ├── server.js               ← Express entry point, middleware, static serving
│   ├── routes/
│   │   ├── valuate.js          ← POST /api/valuate, GET /api/locations, GET /api/history
│   │   └── trends.js           ← GET /api/trends/:location_id
│   ├── services/
│   │   ├── valuationService.js ← Formula logic (pure functions)
│   │   └── trendService.js     ← 12-month price trend generator (seeded RNG)
│   ├── data.json               ← 62 zone records across 23 cities
│   └── .env                    ← PORT=3000 (gitignored)
├── frontend/
│   ├── index.html              ← Single-page dashboard
│   ├── style.css               ← Dark glass design system
│   ├── print.css               ← Print-friendly report layout
│   └── js/
│       ├── main.js             ← App init, event wiring, 3-level cascade logic
│       ├── api.js              ← fetch() wrappers for all API calls
│       ├── state.js            ← Shared state, INDIAN_STATES list, CITY_STATE_MAP
│       ├── dom.js              ← Centralised DOM element references
│       ├── ui.js               ← All render/update functions
│       ├── charts.js           ← Chart.js setup and update helpers
│       └── utils.js            ← escapeHTML, formatINR, debounce, icons
└── package.json
```

---

## Setup & Run

### Prerequisites
- Node.js v18+
- npm

### 1. Clone & install
```bash
git clone https://github.com/shubhamsharma0707/ValueGuard.git
cd ValueGuard
npm install
```

### 2. Start the server
```bash
npm run dev
```

The server starts at `http://localhost:3000`:
```
ValueGuard running at http://localhost:3000
   Endpoints:
   GET  http://localhost:3000/api/locations
   POST http://localhost:3000/api/valuate
   GET  http://localhost:3000/api/history
   GET  http://localhost:3000/api/trends/:location_id
```

### 3. Open in browser
Navigate to `http://localhost:3000`.
> No build step, no webpack, no bundler required. The Express server statically serves the `frontend/` folder.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/locations` | Returns all 62 zone objects |
| `POST` | `/api/valuate` | Computes and returns a valuation result |
| `GET` | `/api/history` | Returns the last 5 valuations (in-memory) |
| `GET` | `/api/trends/:location_id` | Returns 12-month projected price trend |

### POST /api/valuate — Request
```json
{
  "location_id": "grg_cyber_city",
  "property_age": 8,
  "metro_distance_km": 1.5,
  "speculation_level": 4
}
```

### POST /api/valuate — Response
```json
{
  "zone_name": "Cyber City Gurugram",
  "city": "Gurugram",
  "circle_rate": 7700,
  "market_value": 17125,
  "variance_pct": 122.4,
  "risk_level": "High Risk",
  "reason_text": "High variance is driven by metro proximity and elevated broker speculation...",
  "breakdown": {
    "base": 15477,
    "metro_premium": 800,
    "age_depreciation": 960,
    "speculative_uplift": 2000
  },
  "data_source": "Haryana HRERA / Collector Rate 2024-25",
  "last_updated": "2025-04-01",
  "timestamp": "2026-06-15T15:30:00.000Z"
}
```

---

## Features

| Feature | Detail |
|---|---|
| **3-Level Location Cascade** | State → City → Zone; all 29 Indian states listed |
| **Valuation Dashboard** | Animated variance gauge, risk badge, insight text |
| **Valuation Breakdown** | Base, Metro Premium, Depreciation, Speculative Uplift |
| **Sensitivity Analysis** | Chart showing market value vs. one variable |
| **City Zone Heatmap** | Color-coded table of all zones in selected city |
| **Zone Comparison** | Pin up to 3 zones, side-by-side table + radar chart |
| **EMI Calculator** | Expandable loan affordability tool with donut chart |
| **Query History** | Collapsible drawer showing last 5 valuations |
| **Dark / Light Mode** | Persisted in localStorage |
| **Shareable URLs** | Full UI state encoded in query params |
| **Print Report** | Clean print layout via `print.css` |
| **ARIA Accessibility** | Roles, live regions, keyboard navigation |

---

## Security

| Control | Implementation |
|---|---|
| Security headers | `helmet()` — CSP, HSTS, X-Frame-Options, MIME sniffing |
| Rate limiting | 60 requests / minute / IP via `express-rate-limit` |
| Body size cap | `express.json({ limit: '10kb' })` |
| Input validation | Strict allowlist regex + length cap on all user inputs |
| No input reflection | Raw user values never echoed back in error messages |
| XSS prevention | `escapeHTML()` on all server data before DOM insertion |
| CSS injection | `CSS.escape()` on all URL param values |
| CDN integrity | Chart.js loaded with SRI `integrity` hash |
| CORS | Restricted to `localhost` origins only |
| Secret management | `.env` gitignored; only `PORT=3000` stored |

---

## Zone Database

**62 zones · 23 cities · 9 states**

| State | Cities | Zones |
|---|---|---|
| **Haryana** | Gurugram, Faridabad, Panchkula, Ambala, Sonipat, Rohtak, Hisar, Karnal, Panipat, Yamunanagar, Rewari, Bhiwani, Kurukshetra, Jhajjar | 37 |
| **Maharashtra** | Mumbai, Pune | 5 |
| **Karnataka** | Bengaluru | 5 |
| **Uttar Pradesh** | Noida | 4 |
| **Delhi** | Delhi | 3 |
| **Telangana** | Hyderabad | 2 |
| **Tamil Nadu** | Chennai | 2 |
| **West Bengal** | Kolkata | 2 |
| **Gujarat** | Ahmedabad | 2 |

<details>
<summary><strong>Full zone list by city</strong></summary>

| City | Zones |
|---|---|
| Ahmedabad | SG Highway, GIFT City |
| Ambala | Ambala Cantt, Ambala City |
| Bengaluru | Whitefield, Electronic City, Sarjapur Road, Koramangala, Hebbal |
| Bhiwani | City Centre, Hansi Road |
| Chennai | OMR, Sholinganallur |
| Delhi | Dwarka, Vasant Kunj, Okhla Phase 3 |
| Faridabad | NHPC Chowk, Sector 21C, Surajkund, Neharpar |
| Gurugram | Cyber City, Sohna Road, Dwarka Expressway, Golf Course Road, Manesar |
| Hisar | Urban Estate, Sector 13, Agro Food Park |
| Hyderabad | Gachibowli, HITEC City |
| Jhajjar | Sector 1, Bahadurgarh |
| Karnal | Sector 7, Kunjpura Road, GT Karnal Road |
| Kolkata | Salt Lake, New Town |
| Kurukshetra | Sector 2, Pipli |
| Mumbai | Andheri West, Bandra Kurla Complex, Airoli Navi Mumbai |
| Noida | Sector 62, Sector 18, Sector 137, Expressway Sec 150 |
| Panchkula | Sector 5, Sector 20, Mansa Devi Complex |
| Panipat | Sector 13, Model Town |
| Pune | Hinjewadi, Magarpatta |
| Rewari | Sector 3, Dharuhera |
| Rohtak | Model Town, Delhi Road, Asthal Bohar |
| Sonipat | Sector 56, Kundli |
| Yamunanagar | Jagadhri Road, Sector 17 |

</details>

---

## Data Sources

All circle rates are sourced from official government portals:

- **Haryana** — HRERA / Collector Rate Schedule 2024-25
- **Uttar Pradesh** — UP IGRS / Noida Authority 2024-25
- **Karnataka** — Karnataka Kaveri Portal / Guidance Value 2024-25
- **Maharashtra** — Maharashtra IGR / Ready Reckoner 2024-25
- **Telangana** — Telangana IGRS / SRO Market Value 2024-25
- **Tamil Nadu** — TN TNREGINET / Guideline Value 2024-25
- **West Bengal** — WB WBSR / Market Value Schedule 2024-25
- **Delhi** — Delhi Govt / Circle Rate Notification 2024-25
- **Gujarat** — Gujarat Garvi / Jantri Rate 2024-25

---

## License

MIT
