import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Check,
  X,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Sliders,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string, blob: Blob) => Promise<void> | void;
  title?: string;
  cropShape?: 'circle' | 'square';
  aspectRatio?: number; // default 1:1
  outputSize?: number; // default 512x512
  defaultBgColor?: 'white' | 'transparent' | 'dark';
}

const VIEWPORT_SIZE = 280; // Standard 280px viewport frame for mobile & desktop

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = 'ဓာတ်ပုံ နေရာညှိခြင်းနှင့် ချုံ့ခြင်း (Crop & Auto-Compress Photo)',
  cropShape = 'circle',
  aspectRatio = 1,
  outputSize = 512,
  defaultBgColor = 'white',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const [bgColor, setBgColor] = useState<'white' | 'transparent' | 'dark'>(defaultBgColor);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number }>({ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE });

  // Reset state and calculate proper base scale when opening new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setBgColor(defaultBgColor);
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

        // Base scale to fit comfortably in the 280px viewport
        const fitScale = Math.min(VIEWPORT_SIZE / nw, VIEWPORT_SIZE / nh);
        const bw = Math.round(nw * fitScale);
        const bh = Math.round(nh * fitScale);

        setBaseSize({ width: bw, height: bh });
        setImageLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc, defaultBgColor]);

  // Pointer drag handlers (supports mouse and touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((prev) => Math.min(3.5, Math.max(0.5, prev + delta)));
  };

  // Zoom handlers
  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.min(3.5, Math.max(0.5, newZoom)));
  };

  // Rotate handler (90 degrees clockwise)
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset positioning
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Perform crop & auto-compression with high-performance canvas
  const handleConfirmCrop = async () => {
    if (!imageElementRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const isTransparent = bgColor === 'transparent';
      const ctx = canvas.getContext('2d', { alpha: isTransparent });

      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      // Background color
      if (bgColor === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputSize, outputSize);
      } else if (bgColor === 'dark') {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, outputSize, outputSize);
      } else {
        ctx.clearRect(0, 0, outputSize, outputSize);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Move coordinate space to center of target canvas
      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale multiplier between screen preview (VIEWPORT_SIZE) and target output (outputSize)
      const scaleMultiplier = outputSize / VIEWPORT_SIZE;

      // Draw the exact scaled and transformed image
      const img = imageElementRef.current;
      const drawWidth = baseSize.width * scaleMultiplier * zoom;
      const drawHeight = baseSize.height * scaleMultiplier * zoom;
      const drawX = position.x * scaleMultiplier - drawWidth / 2;
      const drawY = position.y * scaleMultiplier - drawHeight / 2;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      const mimeType = isTransparent ? 'image/png' : 'image/jpeg';
      const quality = isTransparent ? undefined : 0.88;

      // Auto-compress to high-performance data URL
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);

      // Also generate Blob
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
      <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white border border-stone-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/80 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Crop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-900 font-sans tracking-tight">{title}</h3>
                <p className="text-[10px] sm:text-[11px] text-stone-500">ပုံကို ဆွဲရွှေ့ပြီး လိုအပ်သလို ချဲ့/လှည့် ညှိပါ</p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Crop Viewport Canvas Area */}
          <div className="p-4 flex flex-col items-center bg-stone-950 select-none relative overflow-hidden">
            {/* Viewport Frame */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className={`relative cursor-grab active:cursor-grabbing touch-none overflow-hidden flex items-center justify-center border-2 border-dashed border-emerald-500 shadow-2xl transition-colors duration-200 ${
                bgColor === 'white'
                  ? 'bg-white'
                  : bgColor === 'dark'
                  ? 'bg-stone-900'
                  : 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:12px_12px] bg-stone-950'
              }`}
              style={{
                width: `${VIEWPORT_SIZE}px`,
                height: `${VIEWPORT_SIZE}px`,
                borderRadius: cropShape === 'circle' ? '9999px' : '24px',
              }}
            >
              {/* Loaded Image with Transformations */}
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
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-mono">Loading image...</span>
                </div>
              )}

              {/* Crop Overlay Grid / Mask */}
              <div
                className={`absolute inset-0 pointer-events-none border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${
                  cropShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
                }`}
              >
                {/* Rule-of-thirds grid guides */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                  <div className="border-r border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-b border-white/60" />
                  <div className="border-r border-white/60" />
                  <div className="border-r border-white/60" />
                  <div />
                </div>
              </div>
            </div>

            {/* Instruction tooltip badge */}
            <div className="mt-2.5 flex items-center space-x-1.5 text-stone-400 text-[10px] sm:text-[11px] font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ဆွဲရွှေ့ရန် လက်ဖြင့် ဖိဆွဲပါ • Zoom Slider ဖြင့် ချိန်ပါ</span>
            </div>
          </div>

          {/* Control Panel (Zoom, Rotate, Auto-Compression Info) */}
          <div className="p-4 space-y-3.5 bg-white">
            
            {/* Zoom Slider & Buttons */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                <span className="flex items-center space-x-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Zoom Level:</span>
                </span>
                <span className="font-mono text-emerald-700 font-black">{zoom.toFixed(2)}x</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom - 0.15)}
                  className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-600 h-2 bg-stone-100 rounded-lg cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom + 0.15)}
                  className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Background Color Selector (Crucial for Transparent PNGs) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                <span className="flex items-center space-x-1.5 font-mono">
                  <span>နောက်ခံအရောင် (Background):</span>
                </span>
                <span className="text-[11px] font-mono text-stone-500">
                  {bgColor === 'white' ? 'အဖြူရောင် (White)' : bgColor === 'dark' ? 'အမည်းရောင် (Dark)' : 'ဖောက်ထွင်း (Transparent)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBgColor('white')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                    bgColor === 'white'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-stone-300 shadow-2xs" />
                  <span>အဖြူရောင် (White)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBgColor('transparent')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                    bgColor === 'transparent'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-stone-300 border border-stone-400 bg-[radial-gradient(#555_1px,transparent_1px)] [background-size:3px_3px]" />
                  <span>Transparent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBgColor('dark')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
                    bgColor === 'dark'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-stone-900 border border-stone-700" />
                  <span>အမည်းရောင်</span>
                </button>
              </div>
            </div>

            {/* Transform Action Bar (Rotate, Reset) & Auto-Compression Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer border border-stone-200"
                >
                  <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rotate (90°)</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer border border-stone-200"
                >
                  <RefreshCcw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Compression Badge */}
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {bgColor === 'transparent' ? '512x512 PNG (Transparent)' : '512x512 JPEG (Solid Background)'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2.5 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer transition-colors"
              >
                မလုပ်တော့ပါ (Cancel)
              </button>

              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isProcessing || !imageLoaded}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs cursor-pointer shadow-md flex items-center space-x-1.5 transition-all active:scale-98 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Apply & Save Photo</span>
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

