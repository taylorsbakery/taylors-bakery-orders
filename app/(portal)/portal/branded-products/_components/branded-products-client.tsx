'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Palette, Cookie, Cake, CakeSlice, Check, Loader2, Sparkles, X, Info, ZoomIn, ZoomOut, RotateCcw, Move, Type, Maximize2, Circle, Square, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

type ProductType = 'cookie' | 'cake' | 'cupcake';

interface ProductConfig {
  label: string;
  description: string;
  icon: typeof Cookie;
  shape: 'circle' | 'rectangle' | 'dome';
  allowInscription: boolean;
}

const PRODUCTS: Record<ProductType, ProductConfig> = {
  cookie: {
    label: 'Branded Cookies',
    description: 'Your logo printed on delicious sugar cookies with custom icing border',
    icon: Cookie,
    shape: 'circle',
    allowInscription: false,
  },
  cake: {
    label: 'Branded Cake',
    description: 'Your image on a sheet cake with edible ink, custom icing & inscription',
    icon: Cake,
    shape: 'rectangle',
    allowInscription: true,
  },
  cupcake: {
    label: 'Branded Cupcakes',
    description: 'Logo toppers on frosted cupcakes with custom icing color',
    icon: CakeSlice,
    shape: 'dome',
    allowInscription: false,
  },
};

const ICING_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Buttercream', value: '#F5E6C8' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Navy Blue', value: '#1e3a5f' },
  { name: 'Royal Blue', value: '#2563EB' },
  { name: 'Light Blue', value: '#60A5FA' },
  { name: 'Pink', value: '#F472B6' },
  { name: 'Hot Pink', value: '#EC4899' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Gold', value: '#D4A017' },
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Brown', value: '#92400E' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Coral', value: '#FB7185' },
];

const INSCRIPTION_COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Black', value: '#1F2937' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Gold', value: '#D4A017' },
  { name: 'Navy', value: '#1e3a5f' },
];

const PLACEMENTS = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'center', label: 'Center' },
  { value: 'border', label: 'Along Border' },
];

export default function BrandedProductsClient() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [productType, setProductType] = useState<ProductType>('cookie');
  const [icingColor, setIcingColor] = useState(ICING_COLORS[0]);
  const [borderColor, setBorderColor] = useState(ICING_COLORS[0]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Image transform controls
  const [imgScale, setImgScale] = useState(1);
  const [imgRoundness, setImgRoundness] = useState(0);
  const [imgX, setImgX] = useState(0);
  const [imgY, setImgY] = useState(0);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 3D rotation
  const [rotX, setRotX] = useState(20);
  const [rotY, setRotY] = useState(0);
  const rotating = useRef(false);
  const rotLastPos = useRef({ x: 0, y: 0 });

  // Inscription (cakes only)
  const [inscription, setInscription] = useState('');
  const [inscriptionColor, setInscriptionColor] = useState(INSCRIPTION_COLORS[0]);
  const [inscriptionPlacement, setInscriptionPlacement] = useState('bottom');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/portal/login');
    }
  }, [status, router]);

  // Reset transforms when switching products
  useEffect(() => {
    setImgScale(1);
    setImgRoundness(productType === 'cookie' ? 50 : 0);
    setImgX(0);
    setImgY(0);
    setRotX(20);
    setRotY(0);
    setInscription('');
  }, [productType]);

  // Image drag handlers
  const handleImgMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleImgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setImgX(prev => prev + dx);
    setImgY(prev => prev + dy);
  }, []);

  const handleImgMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Image touch handlers
  const handleImgTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragging.current = true;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleImgTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setImgX(prev => prev + dx);
    setImgY(prev => prev + dy);
  }, []);

  // 3D rotation drag on the preview container background
  const handleRotMouseDown = useCallback((e: React.MouseEvent) => {
    // Only if clicking the background, not the image
    if ((e.target as HTMLElement).closest('.img-drag-area')) return;
    e.preventDefault();
    rotating.current = true;
    rotLastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleRotMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rotating.current) return;
    const dx = e.clientX - rotLastPos.current.x;
    const dy = e.clientY - rotLastPos.current.y;
    rotLastPos.current = { x: e.clientX, y: e.clientY };
    setRotY(prev => Math.max(-45, Math.min(45, prev + dx * 0.5)));
    setRotX(prev => Math.max(-10, Math.min(60, prev - dy * 0.5)));
  }, []);

  const handleRotMouseUp = useCallback(() => { rotating.current = false; }, []);

  // Touch 3D rotation
  const handleRotTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.img-drag-area')) return;
    if (e.touches.length !== 1) return;
    rotating.current = true;
    rotLastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleRotTouchMove = useCallback((e: React.TouchEvent) => {
    if (!rotating.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - rotLastPos.current.x;
    const dy = e.touches[0].clientY - rotLastPos.current.y;
    rotLastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setRotY(prev => Math.max(-45, Math.min(45, prev + dx * 0.5)));
    setRotX(prev => Math.max(-10, Math.min(60, prev - dy * 0.5)));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!uploadedFile || !uploadedImage) {
      toast.error('Please upload an image first');
      return;
    }
    setSubmitting(true);
    try {
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: uploadedFile.name, contentType: uploadedFile.type, isPublic: true }),
      });
      if (!presignedRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, cloudStoragePath, publicUrl } = await presignedRes.json();

      const uploadHeaders: Record<string, string> = { 'Content-Type': uploadedFile.type };
      try {
        const urlObj = new URL(uploadUrl);
        const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') || '';
        if (signedHeaders.includes('content-disposition')) {
          uploadHeaders['Content-Disposition'] = 'attachment';
        }
      } catch {}
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: uploadedFile });
      if (!uploadRes.ok) throw new Error('Failed to upload image');

      const submitRes = await fetch('/api/portal/branded-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          borderColor: borderColor.value,
          borderColorName: borderColor.name,
          icingColor: icingColor.value,
          icingColorName: icingColor.name,
          inscription: inscription || undefined,
          inscriptionColor: inscriptionColor.value,
          inscriptionColorName: inscriptionColor.name,
          inscriptionPlacement,
          quantity,
          notes,
          imageUrl: publicUrl,
          imageCloudPath: cloudStoragePath,
        }),
      });
      if (!submitRes.ok) throw new Error('Failed to submit request');
      setSubmitted(true);
      toast.success('Your branded product request has been submitted!');
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a1a3e]" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: '#1a1a3e', fontFamily: 'Georgia, serif' }}>Request Submitted!</h1>
        <p className="text-gray-600 mb-2">Your branded {productType} request has been sent to our team.</p>
        <p className="text-gray-500 text-sm mb-8">We&apos;ll review your design and follow up at the email on file. Typical turnaround is 2-3 business days.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setSubmitted(false); handleRemoveImage(); setNotes(''); setQuantity(''); setInscription(''); }}
            className="px-6 py-3 rounded-full text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Submit Another
          </button>
          <button
            onClick={() => router.push('/portal/dashboard')}
            className="px-6 py-3 rounded-full text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const config = PRODUCTS[productType];

  // Helper to darken/lighten color for gradient
  const darken = (hex: string, amt: number) => {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r - amt));
    g = Math.max(0, Math.min(255, g - amt));
    b = Math.max(0, Math.min(255, b - amt));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const icingGrad = `radial-gradient(circle at 40% 35%, ${icingColor.value} 0%, ${darken(icingColor.value, 15)} 100%)`;
  const borderHex = borderColor.value;
  const borderDark = darken(borderColor.value, 30);

  // Inscription style (piped icing look)
  const pipedStyle: React.CSSProperties = {
    color: inscriptionColor.value,
    fontFamily: "'Georgia', serif",
    fontWeight: 700,
    fontStyle: 'italic',
    fontSize: productType === 'cake' ? '16px' : '12px',
    letterSpacing: '0.5px',
    textShadow: `
      0 1px 0 ${darken(inscriptionColor.value, 40)},
      0 2px 2px rgba(0,0,0,0.15),
      0 0 4px rgba(255,255,255,0.3)
    `,
    filter: 'url(#piped-text)',
    WebkitTextStroke: inscriptionColor.value === '#FFFFFF' ? '0.3px #ccc' : undefined,
  };

  // Placement position for inscription on cake
  const placementPos: Record<string, React.CSSProperties> = {
    top: { top: 10, left: 0, right: 0, textAlign: 'center' as const },
    bottom: { bottom: 10, left: 0, right: 0, textAlign: 'center' as const },
    center: { top: '50%', left: 0, right: 0, textAlign: 'center' as const, transform: 'translateY(-50%)' },
    border: { bottom: 6, left: 10, right: 10, textAlign: 'center' as const },
  };

  const renderPreview = () => {
    const imgTransform = `translate(${imgX}px, ${imgY}px) scale(${imgScale})`;
    const imgBorderRadius = `${imgRoundness}%`;
    const imgDragProps = {
      onMouseDown: handleImgMouseDown,
      onMouseMove: handleImgMouseMove,
      onMouseUp: handleImgMouseUp,
      onMouseLeave: handleImgMouseUp,
      onTouchStart: handleImgTouchStart,
      onTouchMove: handleImgTouchMove,
      onTouchEnd: handleImgMouseUp,
    };

    if (productType === 'cookie') {
      return (
        <div className="relative" style={{ width: 220, height: 220, transformStyle: 'preserve-3d' }}>
          {/* Cookie base */}
          <div className="absolute inset-0 rounded-full" style={{
            background: 'radial-gradient(circle at 45% 40%, #D4A060 0%, #B8894A 60%, #A87C42 100%)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 -3px 8px rgba(0,0,0,0.15)',
            transform: 'translateZ(-4px)',
          }} />
          {/* Icing surface */}
          <div className="absolute rounded-full overflow-hidden" style={{
            inset: 10,
            background: icingGrad,
            boxShadow: `inset 0 2px 8px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.08)`,
          }}>
            {/* Piped icing border */}
            <div className="absolute inset-0 rounded-full" style={{
              border: `8px solid ${borderHex}`,
              boxShadow: `inset 0 0 0 2px ${borderDark}, 0 0 0 2px ${borderDark}`,
              borderRadius: '50%',
            }} />
            {/* Decorative dots along the border */}
            <div className="absolute inset-0 rounded-full" style={{ overflow: 'hidden' }}>
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i / 16) * Math.PI * 2;
                const r = 86;
                const cx = 90 + Math.cos(angle) * r;
                const cy = 90 + Math.sin(angle) * r;
                return (
                  <div key={i} className="absolute" style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: borderHex,
                    boxShadow: `0 1px 2px rgba(0,0,0,0.2)`,
                    left: cx - 3.5, top: cy - 3.5,
                  }} />
                );
              })}
            </div>
            {/* Customer image */}
            <div className="img-drag-area absolute flex items-center justify-center overflow-hidden rounded-full" style={{ inset: 22, cursor: 'grab' }} {...imgDragProps}>
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Your logo on cookie"
                  className="max-w-full max-h-full object-contain pointer-events-none select-none"
                  style={{ transform: imgTransform, borderRadius: imgBorderRadius, transition: dragging.current ? 'none' : 'transform 0.2s' }}
                  draggable={false}
                />
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Your logo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (productType === 'cupcake') {
      return (
        <div className="relative" style={{ width: 200, height: 250, transformStyle: 'preserve-3d' }}>
          {/* Cupcake liner/wrapper */}
          <div className="absolute bottom-0 left-1/2" style={{
            width: 120, height: 90, transform: 'translateX(-50%)',
            background: `linear-gradient(180deg, #8B5E3C 0%, #6B4226 100%)`,
            clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="absolute" style={{ left: `${10 + i * 9}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          {/* Frosting dome */}
          <div className="absolute left-1/2 overflow-hidden" style={{
            width: 160, height: 150, bottom: 78, transform: 'translateX(-50%)',
            borderRadius: '50% 50% 44% 44%',
            background: icingGrad,
            boxShadow: `0 6px 20px rgba(0,0,0,0.2), inset 0 4px 12px rgba(255,255,255,0.3)`,
          }}>
            {/* Swirl lines on frosting */}
            <div className="absolute inset-0" style={{ opacity: 0.12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="absolute" style={{
                  width: '100%', height: 2,
                  background: `linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 50%, transparent 100%)`,
                  top: 25 + i * 22, transform: `rotate(${-5 + i * 3}deg)`,
                }} />
              ))}
            </div>
            {/* Icing border ring */}
            <div className="absolute inset-0" style={{
              borderRadius: '50% 50% 44% 44%',
              border: `6px solid ${borderHex}`,
              boxShadow: `inset 0 0 0 2px ${borderDark}`,
            }} />
            {/* Customer image */}
            <div className="img-drag-area absolute flex items-center justify-center overflow-hidden" style={{
              inset: 20,
              borderRadius: '50% 50% 44% 44%',
              cursor: 'grab',
            }} {...imgDragProps}>
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Your logo on cupcake"
                  className="max-w-full max-h-full object-contain pointer-events-none select-none"
                  style={{ transform: imgTransform, borderRadius: imgBorderRadius, transition: dragging.current ? 'none' : 'transform 0.2s' }}
                  draggable={false}
                />
              ) : (
                <div className="text-center">
                  <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-[9px] text-gray-400">Your logo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Sheet cake
    return (
      <div className="relative" style={{ width: 320, height: 240, transformStyle: 'preserve-3d' }}>
        {/* Cake body (side) */}
        <div className="absolute" style={{
          left: 4, right: 4, bottom: 0, height: 50,
          background: 'linear-gradient(180deg, #D4A574 0%, #9E7B55 100%)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          transform: 'translateZ(-10px)',
        }} />
        {/* Cake layer lines */}
        <div className="absolute" style={{
          left: 4, right: 4, bottom: 15, height: 2,
          background: '#C4946A',
          transform: 'translateZ(-10px)',
        }} />
        {/* Frosting surface (top) */}
        <div className="absolute overflow-hidden" style={{
          inset: 0, bottom: 30,
          borderRadius: 10,
          background: icingGrad,
          boxShadow: `inset 0 3px 10px rgba(255,255,255,0.5), 0 2px 8px rgba(0,0,0,0.12)`,
        }}>
          {/* Border — piped icing along edges */}
          <div className="absolute inset-0" style={{
            borderRadius: 10,
            border: `8px solid ${borderHex}`,
            boxShadow: `inset 0 0 0 2px ${borderDark}`,
          }} />
          {/* Decorative corner rosettes */}
          {[[14, 14], [14, 'auto'], ['auto', 14], ['auto', 'auto']].map((pos, i) => (
            <div key={i} className="absolute" style={{
              width: 14, height: 14, borderRadius: '50%',
              background: borderHex, boxShadow: `0 1px 3px rgba(0,0,0,0.2), inset 0 1px 2px ${borderDark}`,
              ...(pos[0] !== 'auto' ? { left: pos[0] as number } : { right: 14 }),
              ...(pos[1] !== 'auto' ? { top: pos[1] as number } : { bottom: 14 }),
            }} />
          ))}
          {/* Inner piped line */}
          <div className="absolute" style={{
            inset: 18, borderRadius: 6,
            border: `3px dashed ${borderHex}`, opacity: 0.6,
          }} />
          {/* Customer image */}
          <div className="img-drag-area absolute flex items-center justify-center overflow-hidden" style={{
            inset: 28, borderRadius: 4, cursor: 'grab',
          }} {...imgDragProps}>
            {uploadedImage ? (
              <img
                src={uploadedImage}
                alt="Your image on cake"
                className="max-w-full max-h-full object-contain pointer-events-none select-none"
                style={{ transform: imgTransform, borderRadius: imgBorderRadius, transition: dragging.current ? 'none' : 'transform 0.2s' }}
                draggable={false}
              />
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Your image here</p>
              </div>
            )}
          </div>
          {/* Inscription */}
          {inscription && (
            <div className="absolute pointer-events-none" style={{ ...placementPos[inscriptionPlacement] || placementPos.bottom, zIndex: 10 }}>
              <span style={pipedStyle}>&ldquo;{inscription}&rdquo;</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-200px)]" style={{ background: 'linear-gradient(180deg, #f8f9fc 0%, #fff 40%)' }}>
      {/* SVG filter for piped text effect */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="piped-text">
            <feMorphology operator="dilate" radius="0.5" in="SourceGraphic" result="dilated" />
            <feGaussianBlur in="dilated" stdDeviation="0.3" result="blurred" />
            <feMerge>
              <feMergeNode in="blurred" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Hero Section */}
      <div className="text-center py-10 px-4" style={{ background: 'linear-gradient(135deg, #1a1a3e 0%, #2d2d6b 100%)' }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span className="text-xs font-semibold tracking-widest text-yellow-300 uppercase">Company Branded Products</span>
          <Sparkles className="w-5 h-5 text-yellow-300" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Put Your Brand on Our Baked Goods
        </h1>
        <p className="text-gray-300 max-w-lg mx-auto text-sm">
          Upload your logo, customize colors &amp; icing, preview in 3D, and submit!
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Controls */}
          <div className="space-y-5">
            {/* Step 1: Choose Product */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>1</span>
                <h2 className="font-semibold text-gray-900">Choose Product Type</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(PRODUCTS) as [ProductType, ProductConfig][]).map(([key, prod]) => {
                  const Icon = prod.icon;
                  const isSelected = productType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setProductType(key)}
                      className={`relative p-4 rounded-xl border-2 transition-all text-center ${
                        isSelected
                          ? 'border-[#1a1a3e] bg-[#1a1a3e]/5 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#1a1a3e] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-[#1a1a3e]' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${isSelected ? 'text-[#1a1a3e]' : 'text-gray-600'}`}>{prod.label}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-3">{config.description}</p>
            </div>

            {/* Step 2: Upload Image */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>2</span>
                <h2 className="font-semibold text-gray-900">Upload Your Image</h2>
              </div>
              {uploadedImage ? (
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-green-300 flex-shrink-0">
                    <Image src={uploadedImage} alt="Uploaded" fill className="object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{uploadedFile?.name}</p>
                    <p className="text-xs text-green-600">{uploadedFile ? (uploadedFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
                  </div>
                  <button onClick={handleRemoveImage} className="p-1.5 rounded-full hover:bg-green-100 text-green-700 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#1a1a3e] hover:bg-gray-50 transition-all">
                  <Upload className="w-10 h-10 text-gray-400 mb-3" />
                  <span className="text-sm font-medium text-gray-700">Click to upload your logo or image</span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, SVG up to 10MB</span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Step 3: Image Adjustments */}
            {uploadedImage && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>3</span>
                  <h2 className="font-semibold text-gray-900">Adjust Image</h2>
                </div>
                <div className="space-y-4">
                  {/* Size */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700 flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Size</label>
                      <span className="text-xs text-gray-500">{Math.round(imgScale * 100)}%</span>
                    </div>
                    <input
                      type="range" min="30" max="200" value={Math.round(imgScale * 100)}
                      onChange={(e) => setImgScale(parseInt(e.target.value) / 100)}
                      className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1a1a3e]"
                    />
                  </div>
                  {/* Roundness */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700 flex items-center gap-1"><Circle className="w-3 h-3" /> Roundness</label>
                      <span className="text-xs text-gray-500">{imgRoundness}%</span>
                    </div>
                    <input
                      type="range" min="0" max="50" value={imgRoundness}
                      onChange={(e) => setImgRoundness(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1a1a3e]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setImgScale(1); setImgRoundness(productType === 'cookie' ? 50 : 0); setImgX(0); setImgY(0); }} className="text-xs text-[#1a1a3e] hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Reset Position
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Move className="w-3 h-3" /> Drag image in the preview to reposition
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Icing & Border Colors */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>{uploadedImage ? '4' : '3'}</span>
                <h2 className="font-semibold text-gray-900">Icing &amp; Border Colors</h2>
              </div>
              <div className="space-y-4">
                {/* Icing (frosting surface) color */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">Icing Color (frosting surface)</label>
                  <div className="grid grid-cols-9 gap-2">
                    {ICING_COLORS.map((color) => (
                      <button
                        key={`ic-${color.value}`}
                        onClick={() => setIcingColor(color)}
                        title={color.name}
                        className={`w-full aspect-square rounded-full transition-all relative ${
                          icingColor.value === color.value
                            ? 'ring-2 ring-[#1a1a3e] ring-offset-2 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value, border: color.value === '#FFFFFF' || color.value === '#F5E6C8' ? '2px solid #d1d5db' : '2px solid transparent' }}
                      >
                        {icingColor.value === color.value && (
                          <Check className={`w-3 h-3 absolute inset-0 m-auto ${['#FFFFFF', '#EAB308', '#D4A017', '#F5E6C8', '#60A5FA'].includes(color.value) ? 'text-gray-800' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Surface: <span className="font-medium">{icingColor.name}</span>
                  </p>
                </div>
                {/* Border (piped) color */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">Border Color (piped icing trim)</label>
                  <div className="grid grid-cols-9 gap-2">
                    {ICING_COLORS.map((color) => (
                      <button
                        key={`bc-${color.value}`}
                        onClick={() => setBorderColor(color)}
                        title={color.name}
                        className={`w-full aspect-square rounded-full transition-all relative ${
                          borderColor.value === color.value
                            ? 'ring-2 ring-[#1a1a3e] ring-offset-2 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value, border: color.value === '#FFFFFF' || color.value === '#F5E6C8' ? '2px solid #d1d5db' : '2px solid transparent' }}
                      >
                        {borderColor.value === color.value && (
                          <Check className={`w-3 h-3 absolute inset-0 m-auto ${['#FFFFFF', '#EAB308', '#D4A017', '#F5E6C8', '#60A5FA'].includes(color.value) ? 'text-gray-800' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Border: <span className="font-medium">{borderColor.name}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 5: Inscription (cakes only) */}
            {config.allowInscription && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>{uploadedImage ? '5' : '4'}</span>
                  <h2 className="font-semibold text-gray-900">Inscription</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Text (piped icing)</label>
                    <input
                      type="text" value={inscription} onChange={(e) => setInscription(e.target.value)}
                      placeholder="e.g. Congratulations!, Happy Birthday"
                      maxLength={40}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a1a3e] focus:border-transparent outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{inscription.length}/40 characters</p>
                  </div>
                  {inscription && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-2">Inscription Color</label>
                        <div className="flex flex-wrap gap-2">
                          {INSCRIPTION_COLORS.map((color) => (
                            <button
                              key={`insc-${color.value}`}
                              onClick={() => setInscriptionColor(color)}
                              title={color.name}
                              className={`w-7 h-7 rounded-full transition-all relative ${
                                inscriptionColor.value === color.value
                                  ? 'ring-2 ring-[#1a1a3e] ring-offset-2 scale-110'
                                  : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: color.value, border: color.value === '#FFFFFF' ? '2px solid #d1d5db' : '2px solid transparent' }}
                            >
                              {inscriptionColor.value === color.value && (
                                <Check className={`w-3 h-3 absolute inset-0 m-auto ${['#FFFFFF', '#EAB308', '#D4A017'].includes(color.value) ? 'text-gray-800' : 'text-white'}`} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-2">Placement</label>
                        <div className="flex flex-wrap gap-2">
                          {PLACEMENTS.map((p) => (
                            <button
                              key={p.value}
                              onClick={() => setInscriptionPlacement(p.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                inscriptionPlacement === p.value
                                  ? 'bg-[#1a1a3e] text-white border-[#1a1a3e]'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#1a1a3e]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Details & Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1a1a3e' }}>✓</span>
                <h2 className="font-semibold text-gray-900">Details &amp; Notes</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Estimated Quantity</label>
                  <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 48 cookies, 1 half sheet cake"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a1a3e] focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Special Instructions</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="Color matching notes, size preferences, event date, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a1a3e] focus:border-transparent outline-none resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Preview */}
          <div className="lg:sticky lg:top-24 space-y-5" style={{ alignSelf: 'start' }}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1a1a3e]" />
                3D Live Preview
              </h2>
              <p className="text-xs text-gray-500 mb-4">Drag background to rotate · Drag image to reposition</p>

              <div
                ref={previewRef}
                className="flex justify-center items-center rounded-xl p-8 border border-gray-200 cursor-grab select-none"
                style={{
                  background: 'radial-gradient(ellipse at center, #f0f0f5 0%, #e2e2ea 100%)',
                  minHeight: 340,
                  perspective: '900px',
                  touchAction: 'none',
                }}
                onMouseDown={handleRotMouseDown}
                onMouseMove={handleRotMouseMove}
                onMouseUp={handleRotMouseUp}
                onMouseLeave={handleRotMouseUp}
                onTouchStart={handleRotTouchStart}
                onTouchMove={handleRotTouchMove}
                onTouchEnd={handleRotMouseUp}
              >
                <div style={{
                  transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: rotating.current ? 'none' : 'transform 0.3s ease',
                }}>
                  {renderPreview()}
                </div>
              </div>

              {/* 3D rotation controls */}
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => { setRotX(20); setRotY(0); }}
                  className="text-xs text-[#1a1a3e] hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset View
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setRotY(prev => prev - 15)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-xs">←</button>
                  <button onClick={() => setRotX(prev => prev + 10)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-xs">↑</button>
                  <button onClick={() => setRotX(prev => prev - 10)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-xs">↓</button>
                  <button onClick={() => setRotY(prev => prev + 15)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-xs">→</button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  This preview is an approximation. Our team will create a professional proof for your approval before production.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!uploadedImage || submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1a1a3e' }}
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Request...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Submit Branded Product Request</>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Your image will be sent to our design team for review. We&apos;ll contact you with pricing and a proof.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
