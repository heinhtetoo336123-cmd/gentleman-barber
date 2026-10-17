# Service Creation Reliability & Real-Time Sync Fix Implementation Plan

Address service creation edge-cases in `ServiceCatalogManager.tsx` and `src/api/client.ts` to guarantee 100% reliable service creation, seamless wizard error navigation, complete preset picker removal, and zero-loss real-time client synchronization.

---

## User Issue & Root Cause Analysis

1. **Validation Jump Issue**: When saving on the final step (Step 5: Review & Confirm), if any preceding step (Name, Category, or Price/Duration) contains invalid input, validation fails silently without redirecting the user to the offending step, leaving the wizard stuck.
2. **Preset Pickers Legacy Cleanup**: Preset image grid pickers must remain completely removed in favor of the unified native photo uploader and `ImageCropModal`.
3. **Firestore Sync & Offline Resilience**: Optimistic local state updates must be preserved when Firestore writes encounter network lag or permission checks, avoiding transient list wipes.

---

## Proposed Changes

### 1. `src/components/ServiceCatalogManager.tsx`
- **Smart Validation Navigation**: Update `handleSave` so that if validation fails for step 1 (Name), step 2 (Category), or step 3 (Price/Duration), the wizard automatically navigates back to the exact step with the error highlighted.
- **Form State Reset**: Ensure `openCreate` properly resets all input state (including category, price, duration, and cropped image URL) for a clean entry.
- **Preset Removal Verification**: Confirm no preset image pickers or stock symbol fallbacks exist in the wizard UI.

### 2. `src/api/client.ts`
- **Robust `addService` Handler**: Ensure `addService` validates payload types, generates unique deterministic IDs (`srv-${timestamp}-${rand}`), saves immediately to `LOCAL_SERVICES_KEY`, notifies subscribers, and handles Firestore `setDoc` seamlessly.
- **Snapshot Merge Shield**: Retain snapshot merging in `subscribeToServices` so locally added services pending background sync are never cleared by Firestore snapshot updates.

### 3. Verification & Build
- Verify app compilation with `compile_applet`.
- Verify zero TypeScript/lint issues with `lint_applet`.

---

## Verification Plan

### Automated Checks
1. Execute `compile_applet` to ensure full build success.
2. Execute `lint_applet` to verify zero type errors.

### Manual Verification Steps
1. **Add Service Success**: Open Admin -> Service Catalog -> Add New Service. Complete all steps and click "Save & Publish". Verify new service appears immediately at the top of its category.
2. **Validation Jump**: Intentionally clear the service name or price, navigate to Step 5, click Save, and verify wizard automatically jumps to Step 1/3 with the error highlighted.
3. **Client Real-Time Sync**: Open Client Home Feed and Booking Modal in another tab/window; verify newly added service appears live.
