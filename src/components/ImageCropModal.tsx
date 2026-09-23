import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Loader2,
  RefreshCcw,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string, blob: Blob) => Promise<void> | void;
  title?: string;
  cropShape?: 'circle' | 'square';
  aspectRatio?: number;
  outputSize?: number;
  defaultBgColor?: 'white' | 'transparent' | 'dark';
}

const VIEWPORT_SIZE = 280;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = 'Crop Image',
  cropShape = 'circle',
  outputSize = 512,
  defaultBgColor = 'white',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number }>({ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE });

  // Multi-touch pinch zoom & drag tracking
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartZoomRef = useRef<number>(1);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset and calculate base scale when opening image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsProcessing(false);
      setImageLoaded(false);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageElementRef.current = img;
        const nw = img.naturalWidth || VIEWPORT_SIZE;
        const nh = img.naturalHeight || VIEWPORT_SIZE;

        const fitScale = Math.min(VIEWPORT_SIZE / nw, VIEWPORT_SIZE / nh);
        const bw = Math.round(nw * fitScale);
        const bh = Math.round(nh * fitScale);

        setBaseSize({ width: bw, height: bh });
        setImageLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Pointer event handlers with full Pinch-to-Zoom support
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pointers = Array.from(activePointersRef.current.values());

    if (pointers.length === 1) {
      initialPointerPosRef.current = { x: e.clientX, y: e.clientY };
      dragStartPosRef.current = { ...position };
    } else if (pointers.length === 2) {
      const p1 = pointers[0];
      const p2 = pointers[1];
      pinchStartDistRef.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchStartZoomRef.current = zoom;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pointers = Array.from(activePointersRef.current.values());

    // 2-finger Pinch Zoom gesture
    if (pointers.length === 2) {
      const p1 = pointers[0];
      const p2 = pointers[1];
      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (pinchStartDistRef.current > 0) {
        const scaleFactor = currentDist / pinchStartDistRef.current;
        const newZoom = Math.min(4, Math.max(0.5, pinchStartZoomRef.current * scaleFactor));
        setZoom(newZoom);
      }
    } else if (pointers.length === 1) {
      // 1-finger / Mouse Pan drag
      const deltaX = e.clientX - initialPointerPosRef.current.x;
      const deltaY = e.clientY - initialPointerPosRef.current.y;
      setPosition({
        x: dragStartPosRef.current.x + deltaX,
        y: dragStartPosRef.current.y + deltaY,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}

    const remaining = Array.from(activePointersRef.current.values());
    if (remaining.length === 1) {
      initialPointerPosRef.current = { x: remaining[0].x, y: remaining[0].y };
      dragStartPosRef.current = { ...position };
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((prev) => Math.min(4, Math.max(0.5, prev + delta)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Canvas Crop & Auto-compress
  const handleConfirmCrop = async () => {
    if (!imageElementRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const isTransparent = defaultBgColor === 'transparent';
      const ctx = canvas.getContext('2d', { alpha: isTransparent });

      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      if (defaultBgColor === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputSize, outputSize);
      } else if (defaultBgColor === 'dark') {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, outputSize, outputSize);
      } else {
        ctx.clearRect(0, 0, outputSize, outputSize);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const scaleMultiplier = outputSize / VIEWPORT_SIZE;
      const img = imageElementRef.current;
      const drawWidth = baseSize.width * scaleMultiplier * zoom;
      const drawHeight = baseSize.height * scaleMultiplier * zoom;
      const drawX = position.x * scaleMultiplier - drawWidth / 2;
      const drawY = position.y * scaleMultiplier - drawHeight / 2;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      const mimeType = isTransparent ? 'image/png' : 'image/jpeg';
      const quality = isTransparent ? undefined : 0.88;

      const compressedDataUrl = canvas.toDataURL(mimeType, quality);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b || new Blob()),
          mimeType,
          quality
        );
      });

      await onCropComplete(compressedDataUrl, blob);
      onClose();
    } catch (err) {
      console.error('Error during image crop & compression:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Minimal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
            <div className="flex items-center space-x-2 text-white">
              <Crop className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Crop Viewport with Pinch-Zoom */}
          <div className="p-4 flex flex-col items-center bg-black select-none relative overflow-hidden">
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className="relative cursor-grab active:cursor-grabbing touch-none overflow-hidden flex items-center justify-center border-2 border-emerald-500 shadow-2xl bg-stone-950"
              style={{
                width: `${VIEWPORT_SIZE}px`,
                height: `${VIEWPORT_SIZE}px`,
                borderRadius: cropShape === 'circle' ? '9999px' : '20px',
              }}
            >
              {imageLoaded && (
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  className="max-w-none transition-none pointer-events-none select-none"
                  style={{
                    width: `${baseSize.width}px`,
                    height: `${baseSize.height}px`,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                />
              )}

              {!imageLoaded && (
                <div className="flex flex-col items-center justify-center space-y-2 text-stone-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              )}

              {/* Minimal Crop Mask Overlay */}
              <div
                className={`absolute inset-0 pointer-events-none border border-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${
                  cropShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
                }`}
              />
            </div>
          </div>

          {/* Minimal Controls Toolbar */}
          <div className="p-3 bg-stone-900 border-t border-stone-800 flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.15))}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                title="Reset"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isProcessing || !imageLoaded}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Apply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


