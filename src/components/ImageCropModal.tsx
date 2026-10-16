import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X, RefreshCw, Square, RectangleHorizontal, Crop } from 'lucide-react';
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
  const [aspectRatio, setAspectRatio] = useState<number>(cropShape === 'circle' ? 1 : initialAspectRatio);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  }, [onClose, onCancel]);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
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

  const handleCrop = async () => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);

    try {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetDim = outputSize || 600;
      const cropWidth = targetDim;
      const cropHeight = aspectRatio > 0 ? Math.round(targetDim / aspectRatio) : targetDim;
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
      const scaleFactor = cropWidth / 280;
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

      // Draw image centered
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      const rawCroppedUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Compress to ensure lightweight data URL (<80KB) and capped resolution
      const compressedUrl = await compressImageToDataUrl(
        rawCroppedUrl,
        Math.min(targetMaxWidth, outputSize),
        Math.min(targetMaxHeight, outputSize),
        0.8
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
      <div className="relative flex flex-col w-full max-w-md mx-4 bg-[#141416] rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#1c1c1e]">
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>

          {!isCircle && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAspectRatio(1)}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  aspectRatio === 1 ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Square className="w-3.5 h-3.5" /> 1:1
              </button>
              <button
                onClick={() => setAspectRatio(4 / 3)}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  aspectRatio === 4 / 3 ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <RectangleHorizontal className="w-3.5 h-3.5" /> 4:3
              </button>
              <button
                onClick={() => setAspectRatio(16 / 9)}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  aspectRatio === 16 / 9 ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Crop className="w-3.5 h-3.5" /> 16:9
              </button>
            </div>
          )}

          <button
            onClick={handleCrop}
            disabled={isProcessing}
            className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
          </button>
        </div>

        {/* Viewport */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="relative w-full h-[320px] bg-black/80 flex items-center justify-center overflow-hidden cursor-move select-none"
        >
          {/* Crop Overlay Area */}
          <div
            className={`relative border-2 border-amber-500/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] pointer-events-none z-10 transition-all duration-200 ${
              isCircle ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{
              width: aspectRatio >= 1 ? '260px' : `${260 * aspectRatio}px`,
              height: aspectRatio >= 1 ? `${260 / aspectRatio}px` : '260px',
            }}
          >
            {/* Grid overlay for non-circle */}
            {!isCircle && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
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

          {/* Manipulated Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop source"
            draggable={false}
            className="absolute max-w-none transition-transform duration-75 origin-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1c1c1e] border-t border-white/10">
          <div className="flex items-center gap-3 w-full max-w-[220px]">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10"
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
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRotate}
              className="p-2 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
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
