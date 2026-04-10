'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Move, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BORDER_COLORS, INSCRIPTION_COLORS, INSCRIPTION_PLACEMENTS, getBorderColorHex, getInscriptionColorHex } from '@/lib/order-utils';

export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface CakeImageEditorProps {
  imageUrl: string;
  productName?: string;
  cakeSize?: string;
  itemType?: string;
  borderColor?: string;
  inscriptionColor?: string;
  inscription?: string;
  inscriptionPlacement?: string;
  transform?: ImageTransform;
  onTransformChange?: (t: ImageTransform) => void;
  onBorderColorChange?: (color: string) => void;
  onInscriptionColorChange?: (color: string) => void;
  onInscriptionPlacementChange?: (placement: string) => void;
  readOnly?: boolean;
}

const DEFAULT_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

export function CakeImageEditor({
  imageUrl,
  productName = '',
  cakeSize = '',
  itemType = 'cake',
  borderColor = 'buttercream',
  inscriptionColor = 'red',
  inscription = '',
  inscriptionPlacement = 'bottom',
  transform,
  onTransformChange,
  onBorderColorChange,
  onInscriptionColorChange,
  onInscriptionPlacementChange,
  readOnly = false,
}: CakeImageEditorProps) {
  const [t, setT] = useState<ImageTransform>(transform || DEFAULT_TRANSFORM);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (transform) setT(transform);
  }, [transform]);

  const updateTransform = useCallback((newT: ImageTransform) => {
    setT(newT);
    onTransformChange?.(newT);
  }, [onTransformChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [readOnly]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setT(prev => {
      const newT = { ...prev, x: prev.x + dx, y: prev.y + dy };
      onTransformChange?.(newT);
      return newT;
    });
  }, [onTransformChange]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (readOnly || e.touches.length !== 1) return;
    dragging.current = true;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [readOnly]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setT(prev => {
      const newT = { ...prev, x: prev.x + dx, y: prev.y + dy };
      onTransformChange?.(newT);
      return newT;
    });
  }, [onTransformChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setT(prev => {
      const newScale = Math.min(3, Math.max(0.3, prev.scale + delta));
      const newT = { ...prev, scale: newScale };
      onTransformChange?.(newT);
      return newT;
    });
  }, [readOnly, onTransformChange]);

  const resetTransform = () => updateTransform(DEFAULT_TRANSFORM);
  const zoomIn = () => updateTransform({ ...t, scale: Math.min(3, t.scale + 0.15) });
  const zoomOut = () => updateTransform({ ...t, scale: Math.max(0.3, t.scale - 0.15) });
  const rotate = () => updateTransform({ ...t, rotation: t.rotation + 90 });

  const nameLower = productName.toLowerCase();
  const isCupcake = nameLower.includes('cupcake');
  const isCookie = nameLower.includes('cookie');
  const isSheetCake = !isCupcake && !isCookie;

  const borderHex = getBorderColorHex(borderColor);
  const inscriptionHex = getInscriptionColorHex(inscriptionColor);
  const isFullOrXL = cakeSize === 'FULL_SHEET' || cakeSize === 'XL_SHEET';
  const sheetWidth = isFullOrXL ? 320 : 260;
  const sheetHeight = isFullOrXL ? 220 : 180;

  const imgStyle: React.CSSProperties = {
    transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale}) rotate(${t.rotation}deg)`,
    transition: dragging.current ? 'none' : 'transform 0.2s ease',
    filter: 'saturate(0.9) brightness(1.02)',
    cursor: readOnly ? 'default' : 'grab',
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  };

  const canvasProps = !readOnly ? {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleMouseUp,
    onWheel: handleWheel,
  } : {};

  return (
    <div className="space-y-3">
      {/* Controls toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          📷 {readOnly ? 'Image Preview' : 'Image Editor'} — {isCupcake ? 'Cupcake Top' : isCookie ? 'Cookie Face' : 'Sheet Cake Top'}
        </p>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn} title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut} title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={rotate} title="Rotate 90°">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetTransform}>
              Reset
            </Button>
          </div>
        )}
      </div>

      {!readOnly && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Move className="w-3 h-3" /> Drag to move · Scroll to zoom · Use buttons to rotate
        </p>
      )}

      {/* 3D Scene */}
      <div
        ref={containerRef}
        className="relative rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 overflow-hidden select-none"
        style={{ perspective: '800px', touchAction: 'none' }}
      >
        {isSheetCake && (
          <div className="flex items-center justify-center py-6 px-4">
            <div
              className="relative"
              style={{ width: sheetWidth, height: sheetHeight, transformStyle: 'preserve-3d', transform: 'rotateX(25deg)' }}
            >
              {/* Cake body */}
              <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(180deg, #D4A574 0%, #9E7B55 100%)', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', transform: 'translateZ(-12px)' }} />
              <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(180deg, #E8C89E 0%, #D4A574 100%)', transform: 'translateZ(-6px)' }} />
              {/* Frosting surface */}
              <div className="absolute inset-0 rounded-lg overflow-hidden" style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F0E8 50%, #EDE5D8 100%)',
                boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.1)',
                border: borderColor !== 'none' ? `6px solid ${borderHex}` : '3px solid #E8DCC8',
              }}>
                {/* Image area */}
                <div className="absolute inset-3 flex items-center justify-center overflow-hidden rounded" {...canvasProps}>
                  <img src={imageUrl} alt="Image on cake" className="max-w-full max-h-full object-contain" style={imgStyle} draggable={false} />
                </div>
              </div>
              {/* Inscription preview */}
              {inscription && (() => {
                const placementStyles: Record<string, React.CSSProperties> = {
                  top: { top: -24, left: 0, right: 0, textAlign: 'center' as const },
                  bottom: { bottom: -24, left: 0, right: 0, textAlign: 'center' as const },
                  center: { top: '50%', left: 0, right: 0, textAlign: 'center' as const, transform: 'translateY(-50%)', zIndex: 10 },
                  border: { bottom: 4, left: 8, right: 8, textAlign: 'center' as const, zIndex: 10 },
                };
                return (
                  <div className="absolute" style={{ position: 'absolute', ...placementStyles[inscriptionPlacement] || placementStyles.bottom }}>
                    <span className="text-xs font-semibold italic" style={{ color: inscriptionHex, textShadow: inscriptionPlacement === 'center' || inscriptionPlacement === 'border' ? '0 1px 3px rgba(255,255,255,0.8)' : undefined }}>"{inscription}"</span>
                  </div>
                );
              })()}
              {!inscription && (
                <div className="absolute -bottom-7 left-0 right-0 text-center">
                  <span className="text-[10px] text-muted-foreground font-medium">Sheet Cake — Edible Print</span>
                </div>
              )}
            </div>
          </div>
        )}

        {isCookie && (
          <div className="flex items-center justify-center py-6 px-4">
            <div className="relative" style={{ width: 200, height: 200 }}>
              <div className="absolute inset-0 rounded-full" style={{
                background: 'radial-gradient(circle, #D4A060 0%, #A87C42 100%)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2), inset 0 -3px 8px rgba(0,0,0,0.15)',
              }} />
              <div className="absolute rounded-full overflow-hidden" style={{
                inset: 8,
                background: 'radial-gradient(circle, #FFFFFF 0%, #F0E6D6 100%)',
                border: borderColor !== 'none' ? `5px solid ${borderHex}` : 'none',
              }}>
                <div className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-full" {...canvasProps}>
                  <img src={imageUrl} alt="Image on cookie" className="max-w-full max-h-full object-contain" style={{ ...imgStyle, borderRadius: '50%' }} draggable={false} />
                </div>
              </div>
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground font-medium">Cookie — Edible Print</span>
              </div>
            </div>
          </div>
        )}

        {isCupcake && (
          <div className="flex items-center justify-center py-6 px-4">
            <div className="relative" style={{ width: 160, height: 200 }}>
              {/* Wrapper */}
              <div className="absolute bottom-0 left-1/2" style={{
                width: 120, height: 80, transform: 'translateX(-50%)',
                background: 'linear-gradient(180deg, #8B5E3C 0%, #6B4226 100%)',
                clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
              }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="absolute" style={{ left: `${12 + i * 11}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                ))}
              </div>
              {/* Frosting dome */}
              <div className="absolute left-1/2 overflow-hidden" style={{
                width: 130, height: 130, bottom: 70, transform: 'translateX(-50%)',
                borderRadius: '50% 50% 45% 45%',
                background: 'radial-gradient(circle at 40% 35%, #FFFFFF 0%, #F0E4D2 100%)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                border: borderColor !== 'none' ? `4px solid ${borderHex}` : 'none',
              }}>
                <div className="absolute inset-3 flex items-center justify-center overflow-hidden" style={{ borderRadius: '50% 50% 45% 45%' }} {...canvasProps}>
                  <img src={imageUrl} alt="Image on cupcake" className="max-w-full max-h-full object-contain" style={imgStyle} draggable={false} />
                </div>
              </div>
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground font-medium">Cupcake — Edible Print</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 pb-2 pt-4">
          <p className="text-[10px] text-center text-muted-foreground italic">
            Preview approximation — actual edible ink print may vary in color saturation
          </p>
        </div>
      </div>

      {/* Color pickers — only in edit mode */}
      {!readOnly && (
        <div className="space-y-3">
          {/* Border Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Border Icing Color</label>
            <div className="flex flex-wrap gap-1.5">
              {BORDER_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onBorderColorChange?.(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    borderColor === c.value ? 'ring-2 ring-amber-500 ring-offset-1 scale-110' : 'hover:scale-105'
                  } ${c.value === 'none' ? 'bg-gray-100 flex items-center justify-center' : ''}`}
                  style={{ backgroundColor: c.hex !== 'transparent' ? c.hex : undefined, borderColor: c.value === 'white' || c.value === 'buttercream' ? '#d1d5db' : c.hex !== 'transparent' ? c.hex : '#d1d5db' }}
                  title={c.label}
                >
                  {c.value === 'none' && <span className="text-[8px] text-gray-500">✕</span>}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Selected: {BORDER_COLORS.find(c => c.value === borderColor)?.label || 'None'}</p>
          </div>

          {/* Inscription Color — only if there's an inscription */}
          {inscription && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Inscription Color</label>
              <div className="flex flex-wrap gap-1.5">
                {INSCRIPTION_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onInscriptionColorChange?.(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      inscriptionColor === c.value ? 'ring-2 ring-amber-500 ring-offset-1 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex, borderColor: c.value === 'white' ? '#d1d5db' : c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Selected: {INSCRIPTION_COLORS.find(c => c.value === inscriptionColor)?.label || 'Red'}</p>
            </div>
          )}

          {/* Inscription Placement — only if there's an inscription */}
          {inscription && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Inscription Placement</label>
              <div className="flex flex-wrap gap-1.5">
                {INSCRIPTION_PLACEMENTS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onInscriptionPlacementChange?.(p.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      inscriptionPlacement === p.value
                        ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 ring-offset-1'
                        : 'bg-muted text-foreground border-muted-foreground/20 hover:border-amber-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
