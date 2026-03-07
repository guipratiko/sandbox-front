import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from './Button';

interface ImageCropProps {
  imageSrc: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
  circular?: boolean;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragType = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null;

const ImageCrop: React.FC<ImageCropProps> = ({
  imageSrc,
  onCrop,
  onCancel,
  aspectRatio = 1,
  circular = true,
}) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const [dragType, setDragType] = useState<DragType>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
      
      setTimeout(() => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;
          
          const cropSize = Math.min(containerWidth * 0.7, containerHeight * 0.7, 350);
          const x = (containerWidth - cropSize) / 2;
          const y = (containerHeight - cropSize) / 2;
          
          setCropArea({
            x,
            y,
            width: cropSize,
            height: cropSize,
          });
        }
      }, 100);
    };
    img.onerror = () => {
      setImageLoaded(false);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!containerRef.current || !imageLoaded) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    const imgAspectRatio = imageSize.width / imageSize.height;
    let displayWidth = containerWidth * 0.95;
    let displayHeight = displayWidth / imgAspectRatio;
    
    if (displayHeight > containerHeight * 0.95) {
      displayHeight = containerHeight * 0.95;
      displayWidth = displayHeight * imgAspectRatio;
    }
    
    displayWidth *= scale;
    displayHeight *= scale;
    
    const x = (containerWidth - displayWidth) / 2;
    const y = (containerHeight - displayHeight) / 2;
    
    setImagePosition({ x, y, width: displayWidth, height: displayHeight });
  }, [scale, imageSize, imageLoaded]);

  const updatePreview = useCallback(() => {
    if (!previewCanvasRef.current || !imageRef.current || !imageLoaded) return;
    
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = imageRef.current;
    canvas.width = 200;
    canvas.height = 200;
    
    const scaleX = imageSize.width / imagePosition.width;
    const scaleY = imageSize.height / imagePosition.height;
    
    const cropX = Math.max(0, (cropArea.x - imagePosition.x) * scaleX);
    const cropY = Math.max(0, (cropArea.y - imagePosition.y) * scaleY);
    const cropWidth = Math.min(imageSize.width - cropX, cropArea.width * scaleX);
    const cropHeight = Math.min(imageSize.height - cropY, cropArea.height * scaleY);
    
    ctx.save();
    if (circular) {
      ctx.beginPath();
      ctx.arc(100, 100, 100, 0, Math.PI * 2);
      ctx.clip();
    }
    
    if (rotation !== 0) {
      ctx.translate(100, 100);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-100, -100);
    }
    
    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      200,
      200
    );
    ctx.restore();
  }, [cropArea, imagePosition, imageSize, rotation, circular, imageLoaded]);

  useEffect(() => {
    if (!imageLoaded || !previewCanvasRef.current || !imageRef.current) return;
    updatePreview();
  }, [cropArea, imagePosition, scale, rotation, imageLoaded, updatePreview]);

  const constrainCropArea = useCallback((area: CropArea): CropArea => {
    if (!containerRef.current) return area;
    
    const maxX = containerRef.current.clientWidth;
    const maxY = containerRef.current.clientHeight;
    
    let { x, y, width, height } = area;
    
    if (aspectRatio) {
      if (width / height > aspectRatio) {
        height = width / aspectRatio;
      } else {
        width = height * aspectRatio;
      }
    }
    
    const minSize = 50;
    if (width < minSize) width = minSize;
    if (height < minSize) height = minSize;
    
    if (aspectRatio) {
      if (width / height > aspectRatio) {
        height = width / aspectRatio;
      } else {
        width = height * aspectRatio;
      }
    }
    
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > maxX) x = maxX - width;
    if (y + height > maxY) y = maxY - height;
    
    return { x, y, width, height };
  }, [aspectRatio]);

  useEffect(() => {
    if (!dragType) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let newCropArea = { ...cropArea };
      
      if (dragType === 'move') {
        const deltaX = mouseX - dragStart.x;
        const deltaY = mouseY - dragStart.y;
        newCropArea = {
          x: dragStart.cropX + deltaX,
          y: dragStart.cropY + deltaY,
          width: dragStart.cropW,
          height: dragStart.cropH,
        };
      } else if (dragType?.startsWith('resize-')) {
        const deltaX = mouseX - dragStart.x;
        const deltaY = mouseY - dragStart.y;
        
        if (dragType === 'resize-nw') {
          newCropArea = {
            x: dragStart.cropX + deltaX,
            y: dragStart.cropY + deltaY,
            width: dragStart.cropW - deltaX,
            height: dragStart.cropH - deltaY,
          };
        } else if (dragType === 'resize-ne') {
          newCropArea = {
            x: dragStart.cropX,
            y: dragStart.cropY + deltaY,
            width: dragStart.cropW + deltaX,
            height: dragStart.cropH - deltaY,
          };
        } else if (dragType === 'resize-sw') {
          newCropArea = {
            x: dragStart.cropX + deltaX,
            y: dragStart.cropY,
            width: dragStart.cropW - deltaX,
            height: dragStart.cropH + deltaY,
          };
        } else if (dragType === 'resize-se') {
          newCropArea = {
            x: dragStart.cropX,
            y: dragStart.cropY,
            width: dragStart.cropW + deltaX,
            height: dragStart.cropH + deltaY,
          };
        }
      }
      
      setCropArea(constrainCropArea(newCropArea));
    };

    const handleMouseUp = () => {
      setDragType(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragType, dragStart, cropArea, constrainCropArea]);

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    setDragType('move');
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropW: cropArea.width,
      cropH: cropArea.height,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, type: DragType) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current || !type) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    setDragType(type);
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropW: cropArea.width,
      cropH: cropArea.height,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(0.3, Math.min(3, scale + delta));
    setScale(newScale);
  };

  const handleRotate = (direction: 'left' | 'right') => {
    setRotation((prev) => {
      const newRotation = direction === 'right' ? prev + 90 : prev - 90;
      return newRotation % 360;
    });
  };

  const handleApplyCrop = () => {
    if (!imageRef.current || !canvasRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    const scaleX = imageSize.width / imagePosition.width;
    const scaleY = imageSize.height / imagePosition.height;
    
    const cropX = Math.max(0, (cropArea.x - imagePosition.x) * scaleX);
    const cropY = Math.max(0, (cropArea.y - imagePosition.y) * scaleY);
    const cropWidth = Math.min(imageSize.width - cropX, cropArea.width * scaleX);
    const cropHeight = Math.min(imageSize.height - cropY, cropArea.height * scaleY);
    
    const finalSize = 500;
    canvas.width = finalSize;
    canvas.height = finalSize;
    
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(finalSize / 2, finalSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-finalSize / 2, -finalSize / 2);
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        finalSize,
        finalSize
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        finalSize,
        finalSize
      );
    }
    
    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92);
    onCrop(croppedBase64);
  };

  if (!imageLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const containerHeight = containerRef.current?.clientHeight || 400;
  const containerWidth = containerRef.current?.clientWidth || 600;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
        {t('settings.cropInstructions')}
      </p>

      <div className="flex gap-4">
        <div
          ref={containerRef}
          className="relative flex-1 h-96 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden"
          onWheel={handleWheel}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop"
            className="absolute pointer-events-none"
            style={{
              left: `${imagePosition.x}px`,
              top: `${imagePosition.y}px`,
              width: `${imagePosition.width}px`,
              height: `${imagePosition.height}px`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center',
            }}
            draggable={false}
          />

          <div className="absolute inset-0 pointer-events-none">
            {cropArea.y > 0 && (
              <div
                className="absolute bg-black/60"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${cropArea.y}px`,
                }}
              />
            )}
            {cropArea.y + cropArea.height < containerHeight && (
              <div
                className="absolute bg-black/60"
                style={{
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${containerHeight - cropArea.y - cropArea.height}px`,
                }}
              />
            )}
            {cropArea.x > 0 && (
              <div
                className="absolute bg-black/60"
                style={{
                  top: `${cropArea.y}px`,
                  left: 0,
                  width: `${cropArea.x}px`,
                  height: `${cropArea.height}px`,
                }}
              />
            )}
            {cropArea.x + cropArea.width < containerWidth && (
              <div
                className="absolute bg-black/60"
                style={{
                  top: `${cropArea.y}px`,
                  right: 0,
                  width: `${containerWidth - cropArea.x - cropArea.width}px`,
                  height: `${cropArea.height}px`,
                }}
              />
            )}
          </div>

          <div
            className={`absolute border-2 border-white shadow-2xl ${circular ? 'rounded-full' : 'rounded-lg'} cursor-move select-none`}
            style={{
              left: `${cropArea.x}px`,
              top: `${cropArea.y}px`,
              width: `${cropArea.width}px`,
              height: `${cropArea.height}px`,
            }}
            onMouseDown={handleCropMouseDown}
          >
            <div
              className="absolute -top-2 -left-2 w-5 h-5 bg-white rounded-full border-2 border-clerky-backendButton cursor-nwse-resize shadow-lg hover:scale-110 transition-transform"
              onMouseDown={(e) => handleResizeMouseDown(e, 'resize-nw')}
            />
            <div
              className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full border-2 border-clerky-backendButton cursor-nesw-resize shadow-lg hover:scale-110 transition-transform"
              onMouseDown={(e) => handleResizeMouseDown(e, 'resize-ne')}
            />
            <div
              className="absolute -bottom-2 -left-2 w-5 h-5 bg-white rounded-full border-2 border-clerky-backendButton cursor-nesw-resize shadow-lg hover:scale-110 transition-transform"
              onMouseDown={(e) => handleResizeMouseDown(e, 'resize-sw')}
            />
            <div
              className="absolute -bottom-2 -right-2 w-5 h-5 bg-white rounded-full border-2 border-clerky-backendButton cursor-nwse-resize shadow-lg hover:scale-110 transition-transform"
              onMouseDown={(e) => handleResizeMouseDown(e, 'resize-se')}
            />
          </div>
        </div>

        {circular && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-clerky-backendButton shadow-lg bg-gray-200 dark:bg-gray-700">
              <canvas
                ref={previewCanvasRef}
                className="w-full h-full"
                style={{ display: 'block' }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.preview')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-smooth shadow-sm"
            title={t('settings.zoomOut')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[4rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-smooth shadow-sm"
            title={t('settings.zoomIn')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRotate('left')}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-smooth shadow-sm"
            title={t('settings.rotateLeft')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
            {rotation}°
          </span>
          <button
            type="button"
            onClick={() => handleRotate('right')}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-smooth shadow-sm"
            title={t('settings.rotateRight')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleApplyCrop}>
          {t('settings.applyCrop')}
        </Button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ImageCrop;
