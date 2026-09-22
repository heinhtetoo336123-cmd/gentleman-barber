# Project Instructions & Permanent Rules

## Strict Production & Data Integrity Directives

1. **NO SAMPLE / MOCK / DUMMY DATA**:
   - The application is in **LIVE PRODUCTION / USER STATE**.
   - NEVER generate, inject, seed, or fallback to mock/sample/dummy data for Services, Stylists/Barbers, Bookings, Clients, Promos, or Notifications.
   - Initial states and fallback lists for all collections MUST always be empty arrays `[]` or strictly retrieved from live Firestore / active user input.
   - Do NOT create automatic seeding functions that write sample records to Firestore or localStorage.

2. **Respect Pure Firestore Cloud State**:
   - All data displays (services, staff, bookings, history, notifications) must solely reflect user-created records in the live Firestore database.
