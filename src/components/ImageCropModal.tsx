import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X, RefreshCw, Square, RectangleHorizontal, Crop, Maximize2, Image as ImageIcon } from 'lucide-react';
import { compressImageToDataUrl } from '../utils/imageCompressor';

export interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose?: () => void;
  onCancel?: () => void;
  onCropComplete: (croppedDataUrl: string, blob?: Blob) => void;
  title?: string;
  cropShape?: 'square' | 'circle' | 'rect';
  aspectRatio?: number; // width / height, e.g., 1 for square, 1.333 for 4:3
  outputSize?: number;
  targetMaxWidth?: number;
  targetMaxHeight?: number;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCancel,
  onCropComplete,
  cropShape = 'square',
  aspectRatio: initialAspectRatio = 1,
  outputSize = 600,
  targetMaxWidth = 800,
  targetMaxHeight = 800,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [naturalRatio, setNaturalRatio] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<number>(cropShape === 'circle' ? 1 : initialAspectRatio);
  const [isOriginalMode, setIsOriginalMode] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  }, [onClose, onCancel]);

  // Load natural dimensions when image loads
  const handleImageLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth > 0 && naturalHeight > 0) {
        const ratio = naturalWidth / naturalHeight;
        setNaturalRatio(ratio);
        // Default to original ratio if rect/square requested or image loaded
        if (cropShape !== 'circle' && initialAspectRatio === 1) {
          setAspectRatio(ratio);
          setIsOriginalMode(true);
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setIsOriginalMode(cropShape !== 'circle' && initialAspectRatio === 1);
      setAspectRatio(cropShape === 'circle' ? 1 : initialAspectRatio);
      setIsProcessing(false);
    }
  }, [isOpen, imageSrc, initialAspectRatio, cropShape]);

  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchPinchDist(dist);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setTouchPinchDist(null);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && touchPinchDist !== null) {
        if (e.cancelable) e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = currentDist / touchPinchDist;
        setZoom((prev) => Math.min(3.5, Math.max(0.5, prev * ratio)));
        setTouchPinchDist(currentDist);
      } else if (e.touches.length === 1 && isDragging) {
        setPan({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, touchPinchDist]
  );

  useEffect(() => {
    if (isDragging || touchPinchDist !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, touchPinchDist, handleMouseMove, handleTouchMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(3, Math.max(0.5, prev + zoomDelta)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Directly export 100% full original image without clipping
  const handleUseFullOriginalImage = async () => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);

    try {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 800;
      canvas.width = w;
      canvas.height = h;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      if (rotation !== 0) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }

      const rawCroppedUrl = canvas.toDataURL('image/jpeg', 0.88);
      const compressedUrl = await compressImageToDataUrl(
        rawCroppedUrl,
        targetMaxWidth,
        targetMaxHeight,
        0.82
      );

      const finalUrl = compressedUrl || rawCroppedUrl;
      const res = await fetch(finalUrl);
      const blob = await res.blob();

      onCropComplete(finalUrl, blob);
      handleClose();
    } catch (err) {
      console.error('Full image export error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCrop = async () => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);

    try {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetDim = outputSize || 600;
      const cropWidth = isOriginalMode ? (img.naturalWidth || targetDim) : targetDim;
      const cropHeight = isOriginalMode 
        ? (img.naturalHeight || targetDim)
        : (aspectRatio > 0 ? Math.round(targetDim / aspectRatio) : targetDim);

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Fill background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cropWidth, cropHeight);

      ctx.save();
      // Translate to canvas center
      ctx.translate(cropWidth / 2, cropHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Pan translation
      const scaleFactor = cropWidth / 260;
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

      // Draw image centered
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      const rawCroppedUrl = canvas.toDataURL('image/jpeg', 0.88);

      // Compress to ensure lightweight data URL (<80KB) and capped resolution
      const compressedUrl = await compressImageToDataUrl(
        rawCroppedUrl,
        targetMaxWidth,
        targetMaxHeight,
        0.82
      );

      const finalUrl = compressedUrl || rawCroppedUrl;

      // Convert to blob for components expecting blob
      const res = await fetch(finalUrl);
      const blob = await res.blob();

      onCropComplete(finalUrl, blob);
      handleClose();
    } catch (err) {
      console.error('Cropping error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  const isCircle = cropShape === 'circle';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-opacity">
      <div className="relative flex flex-col w-full max-w-md mx-4 bg-[#141416] rounded-2xl border border-emerald-500/30 shadow-2xl overflow-hidden font-sans">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1e]">
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>

          {!isCircle && (
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <button
                onClick={() => {
                  setAspectRatio(naturalRatio);
                  setIsOriginalMode(true);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className={`p-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  isOriginalMode ? 'bg-emerald-500 text-black shadow-xs' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Maximize2 className="w-3 h-3" /> မူလ (Original)
              </button>

              <button
                onClick={() => {
                  setAspectRatio(1);
                  setIsOriginalMode(false);
                }}
                className={`p-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  !isOriginalMode && aspectRatio === 1 ? 'bg-emerald-500 text-black shadow-xs' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Square className="w-3 h-3" /> 1:1
              </button>

              <button
                onClick={() => {
                  setAspectRatio(4 / 3);
                  setIsOriginalMode(false);
                }}
                className={`p-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  !isOriginalMode && aspectRatio === 4 / 3 ? 'bg-emerald-500 text-black shadow-xs' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <RectangleHorizontal className="w-3 h-3" /> 4:3
              </button>

              <button
                onClick={() => {
                  setAspectRatio(16 / 9);
                  setIsOriginalMode(false);
                }}
                className={`p-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  !isOriginalMode && aspectRatio === 16 / 9 ? 'bg-emerald-500 text-black shadow-xs' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Crop className="w-3 h-3" /> 16:9
              </button>
            </div>
          )}

          <button
            onClick={handleCrop}
            disabled={isProcessing}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Crop</span>
              </>
            )}
          </button>
        </div>

        {/* Viewport Canvas */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="relative w-full h-[320px] bg-black/85 flex items-center justify-center overflow-hidden cursor-move select-none"
        >
          {/* Crop Overlay Frame */}
          <div
            className={`relative border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] pointer-events-none z-10 transition-all duration-200 ${
              isCircle ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{
              width: aspectRatio >= 1 ? '260px' : `${260 * aspectRatio}px`,
              height: aspectRatio >= 1 ? `${260 / aspectRatio}px` : '260px',
            }}
          >
            {/* Grid overlay for non-circle */}
            {!isCircle && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            )}
          </div>

          {/* Image Under Manipulation */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop source"
            onLoad={handleImageLoad}
            draggable={false}
            className="absolute max-w-none transition-transform duration-75 origin-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              maxWidth: isOriginalMode ? '260px' : undefined,
              maxHeight: isOriginalMode ? '260px' : undefined,
            }}
          />
        </div>

        {/* Direct "Use Full Photo" Action Bar */}
        <div className="px-4 py-2 bg-[#18181b] border-t border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleUseFullOriginalImage}
            disabled={isProcessing}
            className="w-full py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>⚡ မူလပုံ အပြည့်သုံးမည် (Use Full Original Photo)</span>
          </button>
        </div>

        {/* Zoom & Rotate Controls Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1c1c1e] border-t border-white/10">
          <div className="flex items-center gap-2 w-full max-w-[210px]">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRotate}
              className="p-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Reset"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
