'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface CakeImagePreviewProps {
  imageUrl: string;
  productName?: string;
  cakeSize?: string;
  itemType?: string; // 'cake', 'standard' (for cookies/cupcakes detect by name)
}

export function CakeImagePreview({ imageUrl, productName = '', cakeSize = '', itemType = 'cake' }: CakeImagePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const nameLower = productName.toLowerCase();
  const isCupcake = nameLower.includes('cupcake');
  const isCookie = nameLower.includes('cookie');
  const isSheetCake = !isCupcake && !isCookie;

  // Determine aspect ratio based on cake size
  const isFullOrXL = cakeSize === 'FULL_SHEET' || cakeSize === 'XL_SHEET';
  const sheetWidth = isFullOrXL ? 320 : 260;
  const sheetHeight = isFullOrXL ? 220 : 180;

  const resetTransform = () => { setZoom(1); setRotation(0); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          📷 Image Preview — {isCupcake ? 'Cupcake Top' : isCookie ? 'Cookie Face' : 'Sheet Cake Top'}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(z + 0.15, 2))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setRotation(r => r + 90)}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetTransform}>
            Reset
          </Button>
        </div>
      </div>

      {/* 3D Scene Container */}
      <div className="relative rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 overflow-hidden" style={{ perspective: '800px' }}>

        {isSheetCake && (
          <div className="flex items-center justify-center py-6 px-4">
            {/* Sheet cake — top-down 3D perspective */}
            <div
              className="relative"
              style={{
                width: sheetWidth,
                height: sheetHeight,
                transformStyle: 'preserve-3d',
                transform: 'rotateX(25deg)',
              }}
            >
              {/* Cake body shadow */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(180deg, #D4A574 0%, #B8956A 50%, #9E7B55 100%)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25), inset 0 -3px 8px rgba(0,0,0,0.15)',
                  transform: 'translateZ(-12px)',
                }}
              />
              {/* Cake side */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(180deg, #E8C89E 0%, #D4A574 100%)',
                  boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.1)',
                  transform: 'translateZ(-6px)',
                }}
              />
              {/* Frosting surface */}
              <div
                className="absolute inset-0 rounded-lg overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F0E8 50%, #EDE5D8 100%)',
                  boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.1)',
                  border: '3px solid #E8DCC8',
                }}
              >
                {/* Frosting border decoration */}
                <div className="absolute inset-0 rounded-lg" style={{ border: '8px solid transparent', borderImage: 'repeating-linear-gradient(90deg, #F0D4A8 0px, #F0D4A8 6px, transparent 6px, transparent 12px) 8' }} />
                {/* Customer image on cake */}
                <div className="absolute inset-3 flex items-center justify-center overflow-hidden rounded">
                  <img
                    src={imageUrl}
                    alt="Image on cake"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.3s ease',
                      filter: 'saturate(0.9) brightness(1.02)',
                    }}
                  />
                </div>
              </div>
              {/* Cake label */}
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground font-medium">Sheet Cake — Edible Print</span>
              </div>
            </div>
          </div>
        )}

        {isCookie && (
          <div className="flex items-center justify-center py-6 px-4">
            {/* Round cookie */}
            <div className="relative" style={{ width: 200, height: 200 }}>
              {/* Cookie shadow */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #D4A060 0%, #C4914F 60%, #A87C42 100%)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2), inset 0 -3px 8px rgba(0,0,0,0.15), inset 0 3px 8px rgba(255,255,255,0.2)',
                }}
              />
              {/* Frosted top */}
              <div
                className="absolute rounded-full overflow-hidden"
                style={{
                  inset: 8,
                  background: 'radial-gradient(circle, #FFFFFF 0%, #F8F2E8 60%, #F0E6D6 100%)',
                  boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8), 0 1px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-full">
                  <img
                    src={imageUrl}
                    alt="Image on cookie"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.3s ease',
                      filter: 'saturate(0.85) brightness(1.02)',
                      borderRadius: '50%',
                    }}
                  />
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
              {/* Cupcake wrapper */}
              <div
                className="absolute bottom-0 left-1/2"
                style={{
                  width: 120,
                  height: 80,
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(180deg, #8B5E3C 0%, #6B4226 100%)',
                  clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
                  boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.2)',
                }}
              >
                {/* Wrapper ridges */}
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="absolute" style={{ left: `${12 + i * 11}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                ))}
              </div>
              {/* Frosting dome */}
              <div
                className="absolute left-1/2 overflow-hidden"
                style={{
                  width: 130,
                  height: 130,
                  bottom: 70,
                  transform: 'translateX(-50%)',
                  borderRadius: '50% 50% 45% 45%',
                  background: 'radial-gradient(circle at 40% 35%, #FFFFFF 0%, #F8F0E4 40%, #F0E4D2 100%)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15), inset 0 3px 8px rgba(255,255,255,0.8)',
                }}
              >
                <div className="absolute inset-3 flex items-center justify-center overflow-hidden" style={{ borderRadius: '50% 50% 45% 45%' }}>
                  <img
                    src={imageUrl}
                    alt="Image on cupcake"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.3s ease',
                      filter: 'saturate(0.85) brightness(1.02)',
                    }}
                  />
                </div>
              </div>
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground font-medium">Cupcake — Edible Print</span>
              </div>
            </div>
          </div>
        )}

        {/* Edible ink disclaimer */}
        <div className="px-3 pb-2 pt-4">
          <p className="text-[10px] text-center text-muted-foreground italic">
            Preview approximation — actual edible ink print may vary in color saturation
          </p>
        </div>
      </div>
    </div>
  );
}
