# ValueGuard — Real Estate Fair Value Detection Tool

![ValueGuard Cover](frontend/screenshot.png) <!-- Update with actual screenshot path if available -->

> A full-stack financial intelligence tool that compares **Government Circle Rates** against **Estimated Market Rates** to flag overpriced or speculative properties across Indian tech corridors and cities.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla_JS-f7df1e.svg)

---

## What It Does

ValueGuard is a modern property valuation dashboard that brings transparency to real estate by covering **62 zones across 23 cities in 9 states**. It helps home buyers, investors, and analysts by:

- Mapping **all 29 Indian states** in a smooth 3-level cascade (State → City → Zone).
- Pulling verified government-registered circle rates for each tracked zone.
- Applying a multi-factor formula to estimate real market value.
- Flagging speculative pricing with **Safe / Caution / High Risk** visual indicators.
- Providing a built-in, workable **EMI & Affordability Calculator** complete with interactive charts.
- Enabling a robust **Multi-zone Comparison** feature (pin up to 3 zones and compare side-by-side using radar charts).
- Generating a **print-friendly valuation report**.
- Encoding the full UI state in a **shareable URL** for seamless collaboration.

---

## Key Features

| Feature | Description |
|---|---|
| **Valuation Dashboard** | Instant feedback with animated variance gauges, risk badges, and clear insight text. |
| **Multi-zone Comparison** | *New!* Pin up to 3 zones for a side-by-side tabular comparison and visual radar chart. |
| **EMI Calculator** | *New!* Expandable loan affordability tool complete with a dynamic donut chart for principal vs interest. |
| **Valuation Breakdown** | Understand exactly how the value is calculated: Base + Metro Premium - Depreciation + Speculative Uplift. |
| **City Zone Heatmap** | Color-coded table of all zones in your selected city to quickly spot undervalued gems. |
| **Shareable URLs** | Full UI state encoded in query params. Share your specific valuation with anyone. |

---

## Valuation Formula

The estimated market value per square foot is computed in a fully transparent 4-step process:

**Step 1 — Base Value**
```text
Base = Circle Rate × Zone Multiplier
```

**Step 2 — Metro Premium**
- Within 2 km of metro → `+₹800/sqft`
- Within 5 km of metro → `+₹400/sqft`
- Beyond 5 km → `₹0`

**Step 3 — Age Depreciation**
```text
Depreciation = Property Age (years) × ₹120/sqft/year
```

**Step 4 — Speculative Uplift**
```text
Speculative Uplift = Speculation Level (1–5) × ₹500/sqft
```

**Final Formula:**
```text
Market Value  = Base + Metro Premium − Age Depreciation + Speculative Uplift
Variance %    = ((Market Value − Circle Rate) / Circle Rate) × 100

Risk Levels:  < 20% → Safe  |  20–50% → Caution  |  > 50% → High Risk
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS, Vanilla JavaScript (ES Modules) |
| **Backend** | Node.js, Express 5 |
| **Charts** | Chart.js 4 (via CDN with SRI integrity hash) |
| **Security** | Helmet (CSP, HSTS), express-rate-limit, CORS, dotenv |
| **Data** | `backend/data.json` — 62 zones (No database required!) |

---

## Setup & Run

### Prerequisites
- Node.js v18+
- npm

### 1. Clone & Install
```bash
git clone https://github.com/shubhamsharma0707/ValueGuard.git
cd ValueGuard
npm install
```

### 2. Start the Server
```bash
npm run dev
```

The server starts at `http://localhost:3000` and serves the frontend statically. 
> *No build step, no webpack, no bundler required!*

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/locations` | Returns all 62 zone objects |
| `POST` | `/api/valuate` | Computes and returns a valuation result |
| `GET` | `/api/history` | Returns the last 5 valuations (in-memory) |
| `GET` | `/api/trends/:location_id` | Returns 12-month projected price trend |

**Example `POST /api/valuate` Request:**
```json
{
  "location_id": "grg_cyber_city",
  "property_age": 8,
  "metro_distance_km": 1.5,
  "speculation_level": 4
}
```

---

## Security Measures

ValueGuard is built with security in mind from day one:

- **Security Headers**: `helmet()` for CSP, HSTS, X-Frame-Options, and MIME sniffing prevention.
- **Rate Limiting**: 60 requests/minute/IP via `express-rate-limit`.
- **Payload Caps**: Body size capped to 10kb using `express.json()`.
- **XSS Prevention**: Strict HTML escaping on all server data before DOM insertion.

---

## Zone Database

**62 zones · 23 cities · 9 states**

| State | Cities | Zones |
|---|---|---|
| **Haryana** | Gurugram, Faridabad, Panchkula, Ambala, Sonipat, Rohtak, Hisar, Karnal... | 37 |
| **Maharashtra** | Mumbai, Pune | 5 |
| **Karnataka** | Bengaluru | 5 |
| **Uttar Pradesh** | Noida | 4 |
| **Delhi** | Delhi | 3 |
| **Telangana** | Hyderabad | 2 |
| **Tamil Nadu** | Chennai | 2 |
| **West Bengal** | Kolkata | 2 |
| **Gujarat** | Ahmedabad | 2 |

---

## Data Sources

All circle rates are sourced from official government portals for 2024-25:
- Haryana HRERA / Collector Rate Schedule
- Karnataka Kaveri Portal / Guidance Value
- Maharashtra IGR / Ready Reckoner
- Telangana IGRS / SRO Market Value
- ...and more.

---

## License

This project is licensed under the MIT License.
