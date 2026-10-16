# Full Image Cropping & Original Ratio Preservation Plan

Enhance `ImageCropModal` with a dedicated **"Original / Full Image" (မူလအရွယ်အပြည့်)** mode, auto-fitting bounds, and a quick **"Use Full Photo"** button so users can crop or upload 100% of their original photos without aggressive clipping or forced square constraints.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions govern this cropper upgrade:

- **Confirmed Decision 1**: Add an **"Original" (မူလအရွယ်)** aspect ratio preset toggle alongside 1:1, 4:3, and 16:9. In "Original" mode, the cropper automatically matches the exact width-to-height ratio of the loaded image (`img.naturalWidth / img.naturalHeight`).
- **Confirmed Decision 2**: Add a direct **"Use Full Photo (မူလပုံအပြည့်သုံးမည်)"** action button. This allows users to immediately apply 100% of their original photo without manual alignment or clipping.
- **Confirmed Decision 3**: Upgrade canvas rendering math so that when "Original" or "Fit" mode is selected, canvas export maps 1:1 to the image's natural dimensions, preventing edge clipping or forced aspect ratio distortion across all upload flows (Client Profile Avatar, Service Catalog, Staff Management).

---

## 1. Overview & Core Concept

### What It Does
1. **Original Aspect Ratio Auto-Detection**: When an image is picked, `ImageCropModal` reads its natural dimensions (`naturalWidth` and `naturalHeight`) and defaults or allows switching to an **Original** ratio mode that matches the photo exactly.
2. **"Use Full Photo" Quick Button**: Users who want their entire un-cropped photo can tap **"Use Full Photo"**. The cropper instantly processes and compresses the full original image without forcing any zoom or crop offsets.
3. **Viewport Auto-Scaling**: The cropper canvas viewport scales dynamic aspect ratio boxes (landscape, portrait, square) so that 100% of the image bounds remain visible inside the dark overlay bounds.
4. **Universal Applicability**: Applies across all photo upload tools in the app (Client Profile, Service Catalog, Staff Management, Walk-in Manager).

### Target Audience & Persona
- **Salon Customers & Admins**: Easily upload full-bleed or original aspect ratio photos without losing important parts of their images (e.g. hair styles, wide banners, tall portraits).

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Uploading Full Original Photos
1. User selects an image file (portrait, landscape, or square).
2. `ImageCropModal` opens and detects the image's original dimensions.
3. The top toolbar presents aspect ratio controls: **Original (မူလ)** | **1:1** | **4:3** | **16:9**.
4. Selecting **Original** fits the crop frame to 100% of the image's natural aspect ratio.
5. Alternatively, clicking the prominent **"Use Full Photo (မူလပုံအပြည့်)"** button at the bottom immediately exports the full unclipped photo.

#### B. Precision Custom Cropping
1. If the user wants to adjust zoom or position, they can pinch-zoom or drag-pan as usual.
2. Selecting **Reset (မူလအတိုင်းပြန်စမည်)** resets zoom to 1 and pan to center (`{x:0, y:0}`).
3. Tapping **Confirm (✓)** crops and compresses the photo cleanly.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: "Original Ratio" State & Dynamic Viewport Calculation
- **Chosen Approach**: In `ImageCropModal.tsx`, maintain an `isOriginalRatio` boolean state. When enabled, `aspectRatio` dynamically computes as `naturalWidth / naturalHeight`.
- **Why**: Allows users to preserve the exact proportions of any photo without forcing 1:1 square crops.

### Decision 2: Direct "Use Full Photo" Export Action
- **Chosen Approach**: Add a dedicated button that bypasses pan/zoom calculations and directly passes the original image element through `compressImageToDataUrl()`.
- **Why**: Gives users a 1-click fallback to keep their exact photo untouched.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMAGE CROP MODAL WORKFLOW                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐                     ┌───────────────────────────────┐
│     Aspect Ratio Options      │                     │     "Use Full Photo" Button   │
│  - [Original] (natural W/H)   │                     │  - Directly processes full    │
│  - [1:1]  [4:3]  [16:9]       │                     │    original image canvas      │
└───────────────┬───────────────┘                     └───────────────┬───────────────┘
                │                                                     │
                └──────────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────┐
                            │    Canvas Crop Calculation  │
                            │  - Scales natural dimensions │
                            │  - Applies rot/zoom/pan     │
                            │  - Compresses for storage   │
                            └──────────────┬──────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────┐
                            │     onCropComplete Callback │
                            │  - Updates Profile Avatar /  │
                            │    Service / Barber Photo   │
                            └─────────────────────────────┘
```

### Component Changes in `src/components/ImageCropModal.tsx`

1. **Natural Dimensions State**: Add `naturalRatio` state captured on `onLoad` of the preview image (`img.naturalWidth / img.naturalHeight`).
2. **Aspect Ratio Controls**:
   - Add **"Original" (မူလ)** button to top ratio bar.
   - Set `aspectRatio` to `naturalRatio` when clicked.
3. **Full Image Quick Button**:
   - Render a **"Use Full Photo" (မူလပုံအပြည့်)** button in the footer controls.
   - Implement `handleUseFullImage()` function that draws the entire `img` on canvas without zoom/pan cutoffs.
4. **Viewport Bounds Calculation**:
   - Adjust viewport overlay CSS (`width` and `height`) so portrait (tall) or landscape (wide) original frames scale smoothly inside the 320px viewport without clipping.

---

## Verification Plan

### Automated Build & Lint Check
- Run `compile_applet` and `lint_applet` to ensure zero compilation or TypeScript errors.

### Functional Verification
1. **Full Image Test**:
   - Select a tall portrait or wide landscape photo.
   - Click "Original" ratio or "Use Full Photo" -> Verify 100% of the original photo is preserved without missing edges.
2. **Standard Ratio Test**:
   - Switch between 1:1, 4:3, 16:9, and Original -> Verify smooth frame transitions and pan/zoom behavior.
3. **Cross-Component Check**:
   - Verify Client Profile avatar, Service Catalog, and Staff Management uploads all support the new Full Image mode seamlessly.
