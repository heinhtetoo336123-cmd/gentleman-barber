# Comprehensive App Updates: Service Presets, Client Cropper, Quota-Optimized Reordering & PWA First-Load Fix

Remove preset image pickers, unify Client Profile avatar editing with `ImageCropModal`, hide technical Auth Token cards, enable category-grouped custom service reordering with Firestore quota savings, and fix false PWA "New Version Available" notifications on first-time device visits.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in recent turns and govern this implementation plan:

- **Confirmed Decision 1**: Completely remove "Choose from Image Presets" options and grids across Add/Edit Service flows so users only upload custom service photos via the native image cropper.
- **Confirmed Decision 2**: Use the same universal `ImageCropModal` (pitch zoom, drag pan, aspect-ratio toggles, rotation, and compression) for Client Profile avatar photo uploads.
- **Confirmed Decision 3**: Completely remove technical developer cards ("Client Auth Token & Session", copy token buttons, and debug session panels) from the client-side user profile view, displaying only clean member details (Name, Phone, Tier, Royalty Points).
- **Confirmed Decision 4**: Allow admins to custom reorder services within each category (e.g., Hair Cut, Shampoo, Colour, Perming, Dreadlock). Persist order updates using lightweight batch field updates for shifted `displayOrder` values only, protecting Firestore write/read quotas.
- **Confirmed Decision 5 (New)**: Eliminate duplicate or false "New Version Available" notifications on first-time device loads. Fresh device visits will silently load the latest version directly without triggering update modals.

---

## 1. Overview & Core Concept

### What It Does
1. **PWA First-Load Silent Auto-Activation**: Corrects Service Worker lifecycle handlers in `src/utils/swUpdate.ts`. On brand new devices with no prior SW controller (`!navigator.serviceWorker.controller`), service worker installation completes silently without setting `isUpdateAvailable = true` or popping up "New Version Available" toasts. Users immediately see the latest app version on first visit without annoying popups.
2. **Category-Grouped Service Reordering with Quota Efficiency**: Services on client and admin views remain sorted by standard menu categories (Hair Cut first, Shampoo second, Colour third, etc.). Within each category, admins can reorder services using intuitive **Move Up (▲) / Move Down (▼)** controls or sequence ordering.
   - **Firestore Quota Preservation**: Order updates modify local state instantly and update *only* the specific services whose `displayOrder` index changed in a single, minimal batch update, avoiding costly full-collection rewrites or frequent re-fetches.
3. **Service Catalog Cleanup**: Strips out preset photo grids and default preset image fallbacks when creating or editing salon services. Service creators upload custom photos, which launch the touch-friendly pitch-zoom image cropper.
4. **Client Profile Universal Cropper Integration**: Updates `UserProfileView` so avatar uploads open in the universal `ImageCropModal` for pinch-zoom, panning, aspect-ratio adjustments, and cropping before saving (+100 Royalty Points bonus).
5. **Customer Profile Streamlining**: Purges developer-facing Auth Token and Session debug widgets from `UserProfileView`. Customers see a clean, high-end profile focused on their appointments, member status, phone number, loyalty points, and language/notification settings.

### Target Audience & Persona
- **New & Returning Salon Clients**: Enjoy a smooth first launch without update popups, a structured category-organized service menu, clean member cards, and custom avatar cropping.
- **Salon Admins**: Easily organize service lists within each category while operating within efficient database usage limits.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. First-Time Device Launch (Clean PWA Boot)
1. User opens the app for the first time on a new browser or phone.
2. Service worker registers and activates in the background without raising false `controllerchange` update events.
3. User directly sees the newest app content with **zero update toasts** popping up 2 or 3 times.

#### B. Custom Service Reordering within Category (Admin View)
1. Admin opens **Service Catalog Manager**.
2. Services are grouped under their category headers (e.g. ✂️ Hair Cut, 🧴 Shampoo, 🎨 Colour).
3. Each service item in the list displays quick **Up (▲) / Down (▼)** action buttons within its category block.
4. Clicking **Up** or **Down** instantly swaps the service's position relative to its neighboring service in the same category.
5. The UI animates seamlessly using Framer Motion, while a debounced/batch background API call updates `displayOrder` in Firestore for only the affected items.

#### C. Service Image Upload (Service Catalog)
1. Admin clicks **"Add New Service"** or edits an existing service.
2. Step 4 displays a clean **"Upload Custom Photo"** dropzone without preset grids.
3. Selecting an image file opens `ImageCropModal` for zoom, drag, and crop adjustments.
4. Saving applies the compressed cropped image directly to the service item.

#### D. Client Avatar Cropping & Profile Clean-Up
1. Client navigates to **"Account & Settings"** (`UserProfileView`).
2. Client taps the **Camera badge** on their avatar card or the **"Upload photo for +100 PTS"** pill.
3. The selected image opens in `ImageCropModal` (pinch-zoom, drag-pan, aspect ratios).
4. Confirming crop updates the avatar and awards +100 Royalty Points with an audio chime and notification toast.
5. Technical "Client Auth Token & Session" debug card is completely hidden from customer view.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Service Worker Controller Guard for PWA Updates
- **Chosen Approach**: In `src/utils/swUpdate.ts`, check `if (!navigator.serviceWorker.controller)` during initial registration and `controllerchange` events. If no controller existed previously, ignore the change as a fresh first-time installation rather than an update.
- **Why**: Prevents first-time device visits from erroneously triggering the "New Version Available" toast modal and ensures users are never prompted multiple times when opening a fresh app instance.

### Decision 2: Category-Grouped Ordering & Minimal Firestore Batch Writes
- **Chosen Approach**: Retain fixed category order (1. Hair Cut, 2. Shampoo, 3. Colour, 4. Perming, 5. Dreadlock) while supporting custom `displayOrder` integers within each category group. When reordering, only write `displayOrder` for the shifted items using `writeBatch()`.
- **Why**: Minimizes Firestore write operations (2 document updates per swap) to preserve database quota while giving admins full control over service priority within every category.

### Decision 3: Universal Image Crop Modal (`ImageCropModal.tsx`)
- **Chosen Approach**: Standardize on `ImageCropModal` across all image upload points (Service Catalog, Staff Management, Client Profile).
- **Why**: Provides a unified, touch-and-mouse cropping experience with pinch-zoom, drag-pan, aspect ratios, and client-side canvas compression.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SALON APP / INITIAL LAUNCH & BOOT                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐                     ┌───────────────────────────────┐
│     PWA SW Update Manager     │                     │     ServiceCatalogManager     │
│  - Guard: Check controller    │                     │  - Category-grouped service   │
│    before setting update flag │                     │    reorder controls (▲/▼)     │
│  - First load = Silent init   │                     │  - Minimal batch updates      │
└───────────────────────────────┘                     └───────────────┬───────────────┘
                                                                      │
                                                                      ▼
                                                      ┌───────────────────────────────┐
                                                      │        UserProfileView        │
                                                      │  - Clean Member Details Card  │
                                                      │  - Avatar Camera & Bonus Pill │
                                                      │  - NO Auth Token / Session UI │
                                                      └───────────────┬───────────────┘
                                                                      │
                                                                      ▼
                                                      ┌───────────────────────────────┐
                                                      │       ImageCropModal          │
                                                      │  - Pinch Zoom & Drag Pan      │
                                                      │  - Aspect Ratio Controls      │
                                                      └───────────────────────────────┘
```

### Component & File Workflows

1. **`src/utils/swUpdate.ts`**:
   - Refactor `initializePWAUpdateService()` and `subscribeToAppUpdates()`.
   - Add explicit check `hasExistingController = Boolean(navigator.serviceWorker.controller)`. Only flag `isUpdateAvailable = true` if `hasExistingController` is true AND a new worker is waiting or installed over it.

2. **`src/utils/formatters.ts` (`sortServicesForClient`)**:
   - Update sorting logic to sort first by **Category Priority**, second by **`displayOrder` (ascending)**, and third by **Name (alphabetical tie-breaker)**.

3. **`src/api/client.ts` (`reorderServicesBatch`)**:
   - Add a lightweight `reorderServicesBatch(updates: { id: string; displayOrder: number }[])` function executing a single `writeBatch()` for changed service IDs only.

4. **`src/components/ServiceCatalogManager.tsx`**:
   - Add **Move Up / Move Down** reordering handlers per category group.
   - Update local `displayOrder` state immediately for zero-latency UI updates, then invoke `reorderServicesBatch`.
   - Ensure all preset photo grids and default preset fallbacks are completely removed.

5. **`src/components/UserProfileView.tsx`**:
   - Connect photo upload handler (`handlePhotoUpload`) to `ImageCropModal` with pitch-zoom and crop support.
   - Hide the "Client Auth Token & Session" debug section (lines 563–626) from customer view.

---

## Verification Plan

### Automated Build & Lint Check
- Run `compile_applet` and `lint_applet` to verify TypeScript types and syntax validity.

### Functional Verification
1. **First-Time Device Visit Test**:
   - Open app in clean Incognito / new session context.
   - Verify Service Worker registers silently with **zero "New Version Available" popups**.
2. **Service Category Reordering**:
   - Open Service Catalog Manager as Admin.
   - Under "Hair Cut" category, click **Move Down (▼)** on a service.
   - Verify item moves down within category and updates client view ordering.
   - Verify only 2 document writes occur in Firestore.
3. **Service Catalog Preset Removal**:
   - Open "Add Service" modal -> Step 4 -> Verify zero preset image choices exist, test custom image upload + cropper.
4. **Client Profile Avatar & UI Cleanliness**:
   - Open "Account & Settings" -> Click Avatar Camera icon -> Test pitch-zoom/pan/crop modal.
   - Verify no Auth Token / Session card is visible in client profile view.
