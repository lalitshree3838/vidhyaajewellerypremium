import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Radio,
  Users,
  Heart,
  Sparkles,
  ShoppingBag,
  Send,
  X,
  Share2,
  Copy,
  Check,
  Flame,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  Tag,
  MessageSquare,
  Gift
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, ProductVariation, LiveChatMessage, LiveProductShowcase } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { MetadataManager } from '../components/MetadataManager';
import { isGenuineProduct, isGenuineImageUrl } from '../lib/sampleData';

interface GoLiveViewProps {
  products: Product[];
  onSelectProduct: (product: Product, variation?: ProductVariation) => void;
  onNavigateCheckout: () => void;
  onNavigateShop: () => void;
}

interface FloatingHeart {
  id: number;
  emoji: string;
  left: number;
}

const INITIAL_CHAT_MESSAGES: LiveChatMessage[] = [
  {
    id: 'msg-1',
    senderName: 'VIDHYAA Atelier Host',
    isHost: true,
    message: 'Namaste & Welcome to our Live Studio! Today showcasing 24K gold polki chokers and certified 92.5 silver heirlooms from our Roorkee, District Haridwar atelier.',
    timestamp: 'Just now'
  },
  {
    id: 'msg-2',
    senderName: 'Priya Sharma',
    isHost: false,
    message: 'Can you please show the Padmavati Kundan Choker under natural light?',
    timestamp: '1m ago'
  },
  {
    id: 'msg-3',
    senderName: 'Ananya Verma',
    isHost: false,
    message: 'Is the 92.5 stamp hallmarked on the back of the pendant?',
    timestamp: 'Just now'
  }
];

export const GoLiveView: React.FC<GoLiveViewProps> = ({
  products,
  onSelectProduct,
  onNavigateCheckout,
  onNavigateShop
}) => {
  const { addToCart, openCart } = useCart();
  const { user, isAdmin } = useAuth();

  // Mode: Host or Viewer
  const [isHostMode, setIsHostMode] = useState<boolean>(isAdmin);
  const [isLiveBroadcasting, setIsLiveBroadcasting] = useState<boolean>(true);

  // Audio / Video stream state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(true);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stream Metrics
  const [viewerCount, setViewerCount] = useState<number>(142);
  const [streamDuration, setStreamDuration] = useState<number>(412); // seconds

  const verifiedProducts = useMemo(() => {
    return products.filter((p) => isGenuineProduct(p) && p.images && p.images.some(isGenuineImageUrl));
  }, [products]);

  // Pinned Product for Live Shopping
  const [pinnedProduct, setPinnedProduct] = useState<Product>(() => {
    return products.find((p) => isGenuineProduct(p) && p.images && p.images.some(isGenuineImageUrl)) || products[0];
  });
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | undefined>(
    pinnedProduct?.variations?.[0]
  );
  const [showProductSelector, setShowProductSelector] = useState<boolean>(false);

  // Chat & Interactions
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [messageInput, setMessageInput] = useState<string>('');
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Promo Code State
  const [copiedPromo, setCopiedPromo] = useState<boolean>(false);

  // Showcase request by viewers
  const [requestedPiece, setRequestedPiece] = useState<string>('');
  const [requestSubmitted, setRequestSubmitted] = useState<boolean>(false);

  // Start Camera for Host
  const startCamera = async () => {
    try {
      setCameraPermissionError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });
        mediaStreamRef.current = stream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setCameraPermissionError('Camera device not available in this browser environment.');
      }
    } catch (err: any) {
      console.warn('Camera access error or permission denied:', err);
      setCameraPermissionError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Falling back to the Studio High-Def Feed.'
          : 'Could not access local webcam. Utilizing Studio Master Broadcast feed.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const toggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !micActive));
    }
    setMicActive(!micActive);
  };

  useEffect(() => {
    if (isHostMode && isLiveBroadcasting) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isHostMode, isLiveBroadcasting]);

  // Duration Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Viewer Count gentle fluctuation
  useEffect(() => {
    const viewerInterval = setInterval(() => {
      setViewerCount((prev) => Math.max(85, prev + Math.floor(Math.random() * 5) - 2));
    }, 4000);
    return () => clearInterval(viewerInterval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const newMsg: LiveChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      senderName: isHostMode
        ? 'VIDHYAA Atelier Host'
        : user?.displayName || 'Valued Patron',
      isHost: isHostMode,
      message: messageInput.trim(),
      timestamp: 'Just now'
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setMessageInput('');
  };

  const handleTriggerReaction = (emoji: string) => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      emoji,
      left: Math.floor(Math.random() * 60) + 20 // 20% to 80%
    };
    setFloatingHearts((prev) => [...prev.slice(-15), newHeart]);

    // trigger mini confetti for luxury feel
    if (emoji === '💎' || emoji === '✨') {
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.8, x: 0.7 }
      });
    }

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText('LIVESTUDIO15');
    setCopiedPromo(true);
    setTimeout(() => setCopiedPromo(false), 2500);
  };

  const handlePinProduct = (prod: Product) => {
    setPinnedProduct(prod);
    setSelectedVariation(prod.variations[0]);
    setShowProductSelector(false);

    // Announce in chat
    const announceMsg: LiveChatMessage = {
      id: `announce_${Date.now()}`,
      senderName: 'VIDHYAA Atelier Host',
      isHost: true,
      message: `Now showcasing: ${prod.name} (${prod.categoryName})! Live Deal active.`,
      timestamp: 'Just now'
    };
    setChatMessages((prev) => [...prev, announceMsg]);
  };

  const handleAddToCartFromLive = () => {
    if (!pinnedProduct) return;
    const variationToUse = selectedVariation || pinnedProduct.variations[0] || {
      id: `${pinnedProduct.id}-default`,
      name: 'Standard Finish',
      colorFinish: 'Yellow Gold',
      hexCode: '#D4AF37',
      sku: 'VDH-LIVE',
      price: pinnedProduct.price,
      mrp: pinnedProduct.mrp,
      stock: pinnedProduct.stock,
      image: pinnedProduct.images[0],
      active: true
    };

    addToCart(pinnedProduct, variationToUse, 1);

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 }
    });

    openCart();
  };

  const handleBuyNowDirect = () => {
    handleAddToCartFromLive();
    onNavigateCheckout();
  };

  const handleRequestShowcase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedPiece.trim()) return;

    const requestMsg: LiveChatMessage = {
      id: `req_${Date.now()}`,
      senderName: user?.displayName || 'Patron Request',
      isHost: false,
      message: `Requested showcase: "${requestedPiece.trim()}" ✨`,
      timestamp: 'Just now'
    };
    setChatMessages((prev) => [...prev, requestMsg]);
    setRequestSubmitted(true);
    setRequestedPiece('');
    setTimeout(() => setRequestSubmitted(false), 3000);
  };

  return (
    <div className="bg-[#1C1615] text-[#FAF7F2] min-h-[92vh] pb-12 animate-fadeIn relative overflow-hidden">
      <MetadataManager
        title="Go Live | Real-Time Interactive Jewellery Studio Shopping"
        description="Join VIDHYAA Jewellery Studio live broadcast from our Roorkee, District Haridwar atelier. Watch master karigars showcase 24K gold polki, 92.5 hallmarked silver, and exclusive live discounts."
      />

      {/* Floating Animated Hearts & Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="absolute bottom-20 text-3xl animate-floatUp select-none"
            style={{ left: `${heart.left}%` }}
          >
            {heart.emoji}
          </div>
        ))}
      </div>

      {/* Top Stream Control Bar */}
      <div className="bg-[#241C1A] border-b border-[#3B1E22] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-[#802336] text-white px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              LIVE
            </span>
            <div>
              <h1 className="font-serif text-base sm:text-lg font-bold text-white tracking-wide">
                VIDHYAA Atelier Live Broadcast
              </h1>
              <p className="text-[11px] text-[#DFB982]">
                Roorkee Studio HQ • Interactive Jewellery Showcase
              </p>
            </div>
          </div>

          {/* Mode Switch & Stream Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 text-gray-300">
              <Users className="w-3.5 h-3.5 text-[#DFB982]" />
              <span className="font-bold text-white">{viewerCount}</span>
              <span>watching</span>
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono">{formatDuration(streamDuration)}</span>
            </div>

            {/* Toggle Host Mode */}
            <button
              onClick={() => setIsHostMode(!isHostMode)}
              className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer border ${
                isHostMode
                  ? 'bg-[#DFB982] text-[#241C1A] border-[#DFB982]'
                  : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'
              }`}
            >
              {isHostMode ? 'Broadcaster (Host Mode)' : 'Switch to Host View'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Broadcast Stage Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Video Player Stage (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="relative aspect-[16/9] sm:aspect-[16/10] bg-black rounded-3xl overflow-hidden border border-[#3B1E22] shadow-2xl group">
              {/* Actual WebRTC Camera Video if Active */}
              {isHostMode && cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={!micActive}
                  onError={(e) => {
                    e.preventDefault();
                    setCameraActive(false);
                  }}
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                /* High-Definition Studio Showcase Feed */
                <div className="relative w-full h-full">
                  <img
                    src={pinnedProduct?.images[0] || products.find(p => p.images && p.images.length > 0)?.images[0] || '/hero-section-image-final.jpg'}
                    alt="Live Studio Stream"
                    className="w-full h-full object-cover transition-all duration-700 filter brightness-95"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

                  {/* Studio Host Hologram Badge */}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-semibold text-white">
                      Studio Master Feed • 1080p 60FPS
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Permission Alert if Denied */}
              {cameraPermissionError && isHostMode && (
                <div className="absolute top-16 left-4 right-4 p-3 bg-black/80 border border-amber-500/50 rounded-xl text-amber-300 text-xs flex items-center justify-between z-20">
                  <span>{cameraPermissionError}</span>
                  <button
                    onClick={startCamera}
                    className="bg-amber-500 text-black px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {/* Top Right Live Exclusive Flash Offer Banner */}
              <div className="absolute top-4 right-4 bg-[#802336]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#DFB982]/60 shadow-lg flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#DFB982]" />
                <div className="text-right">
                  <span className="text-[10px] text-gray-200 block uppercase font-bold tracking-wider">
                    Live Deal: 15% OFF
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs font-mono font-bold text-[#DFB982] hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>LIVESTUDIO15</span>
                    {copiedPromo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Host Broadcast Controls Overlay (Bottom of Video) */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 z-20">
                <div className="flex items-center gap-2">
                  {isHostMode && (
                    <>
                      <button
                        onClick={cameraActive ? stopCamera : startCamera}
                        className={`p-3 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                          cameraActive
                            ? 'bg-emerald-600/90 text-white border-emerald-400'
                            : 'bg-black/60 text-gray-300 border-white/20 hover:bg-black/80'
                        }`}
                        title={cameraActive ? 'Turn off camera' : 'Turn on camera'}
                      >
                        {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={toggleMic}
                        className={`p-3 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                          micActive
                            ? 'bg-emerald-600/90 text-white border-emerald-400'
                            : 'bg-red-600/90 text-white border-red-400'
                        }`}
                        title={micActive ? 'Mute microphone' : 'Unmute microphone'}
                      >
                        {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setShowProductSelector(true)}
                        className="bg-[#3B1E22]/90 hover:bg-[#802336] text-[#DFB982] px-3.5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-[#DFB982]/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Pin Design</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Floating Reaction Triggers */}
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <button
                    onClick={() => handleTriggerReaction('❤️')}
                    className="p-1 hover:scale-125 transition-transform text-lg cursor-pointer"
                    title="Love"
                  >
                    ❤️
                  </button>
                  <button
                    onClick={() => handleTriggerReaction('✨')}
                    className="p-1 hover:scale-125 transition-transform text-lg cursor-pointer"
                    title="Sparkle"
                  >
                    ✨
                  </button>
                  <button
                    onClick={() => handleTriggerReaction('💎')}
                    className="p-1 hover:scale-125 transition-transform text-lg cursor-pointer"
                    title="Diamond"
                  >
                    💎
                  </button>
                  <button
                    onClick={() => handleTriggerReaction('🔥')}
                    className="p-1 hover:scale-125 transition-transform text-lg cursor-pointer"
                    title="Fire"
                  >
                    🔥
                  </button>
                </div>
              </div>
            </div>

            {/* Pinned Featured Jewellery Card ("Shop The Stream") */}
            {pinnedProduct && (
              <div className="bg-[#241C1A] rounded-2xl border border-[#3B1E22] p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5 animate-fadeIn">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#DFB982]/40 flex-shrink-0">
                    {(selectedVariation?.image || pinnedProduct.images?.[0]) ? (
                      <img
                        src={selectedVariation?.image || pinnedProduct.images[0]}
                        alt={pinnedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#181113] flex items-center justify-center text-[#DFB982]">
                        <Sparkles className="w-6 h-6 text-[#DFB982]" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-[#802336] text-[9px] font-bold text-white px-1.5 py-0.2 rounded uppercase">
                      ON AIR
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#DFB982] uppercase text-[10px] tracking-wider font-bold">
                        {pinnedProduct.categoryName}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-emerald-400 font-semibold text-[11px]">
                        {selectedVariation?.stock || pinnedProduct.stock} left in stock
                      </span>
                    </div>

                    <h3 className="font-serif text-sm sm:text-base font-bold text-white line-clamp-1">
                      {pinnedProduct.name}
                    </h3>

                    {/* Variation Swatches */}
                    {pinnedProduct.variations.length > 1 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-gray-400">Finish:</span>
                        {pinnedProduct.variations.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariation(v)}
                            className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                              selectedVariation?.id === v.id
                                ? 'scale-125 border-white ring-1 ring-[#DFB982]'
                                : 'border-black/40 hover:scale-110'
                            }`}
                            style={{ backgroundColor: v.hexCode }}
                            title={v.name}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-baseline gap-2 pt-0.5">
                      <span className="text-base sm:text-lg font-bold text-[#DFB982]">
                        ₹{Math.round((selectedVariation?.price || pinnedProduct.price) * 0.85).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 line-through">
                        ₹{(selectedVariation?.mrp || pinnedProduct.mrp).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] bg-[#802336] text-white px-1.5 py-0.2 rounded font-bold">
                        15% LIVE OFF
                      </span>
                    </div>
                  </div>
                </div>

                {/* Instant Actions */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handleAddToCartFromLive}
                    className="flex-1 sm:flex-none px-4 py-2.5 btn-teak-green-outline text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span>Add to Bag</span>
                  </button>

                  <button
                    onClick={handleBuyNowDirect}
                    className="flex-1 sm:flex-none px-6 py-2.5 btn-teak-green text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <span>Instant UPI Buy</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Live Interactive Chat & Q&A (4 cols) */}
          <div className="lg:col-span-4 bg-[#241C1A] rounded-3xl border border-[#3B1E22] shadow-2xl flex flex-col h-[650px] overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-[#3B1E22] flex items-center justify-between bg-[#1C1615]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#DFB982]" />
                <h3 className="font-serif text-sm font-bold text-white tracking-wide">
                  Live Atelier Chat & Q&A
                </h3>
              </div>
              <span className="text-[10px] text-gray-400">
                {chatMessages.length} messages
              </span>
            </div>

            {/* Request a Piece Widget */}
            <div className="p-3 bg-[#2F2422] border-b border-[#3B1E22] text-xs">
              <form onSubmit={handleRequestShowcase} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Request piece to showcase..."
                  value={requestedPiece}
                  onChange={(e) => setRequestedPiece(e.target.value)}
                  className="flex-1 bg-[#1C1615] border border-[#3B1E22] rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982]"
                />
                <button
                  type="submit"
                  className="bg-[#802336] hover:bg-[#68192a] text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Request
                </button>
              </form>
              {requestSubmitted && (
                <span className="text-[10px] text-emerald-400 block mt-1">
                  ✓ Request sent to host!
                </span>
              )}
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl border ${
                    msg.isHost
                      ? 'bg-[#3B1E22]/90 border-[#DFB982]/40 text-white'
                      : 'bg-[#1C1615] border-[#332523] text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        msg.isHost ? 'text-[#DFB982]' : 'text-gray-300'
                      }`}
                    >
                      {msg.senderName}
                      {msg.isHost && (
                        <span className="bg-[#DFB982] text-[#241C1A] text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                          Host
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{msg.message}</p>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-[#3B1E22] bg-[#1C1615] flex gap-2"
            >
              <input
                type="text"
                required
                placeholder={
                  isHostMode ? 'Broadcast message to viewers...' : 'Ask about designs, stones, sizes...'
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 bg-[#241C1A] border border-[#3B1E22] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#DFB982]"
              />
              <button
                type="submit"
                className="bg-[#802336] hover:bg-[#68192a] text-white p-2.5 rounded-xl transition-colors cursor-pointer"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PRODUCT PIN SELECTOR MODAL (HOST ONLY) */}
      {/* ======================================================== */}
      {showProductSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-[#241C1A] w-full max-w-2xl rounded-2xl border border-[#3B1E22] shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3B1E22] pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-white">
                  Pin Jewellery Piece to Live Stream
                </h3>
                <p className="text-xs text-gray-400">
                  Select a product to showcase in the pinned shopping drawer for all viewers.
                </p>
              </div>
              <button
                onClick={() => setShowProductSelector(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-[#3B1E22] flex-1 pr-1">
              {verifiedProducts.map((prod: Product) => (
                <div
                  key={prod.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-[#2F2422] p-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {prod.images?.[0] ? (
                      <img
                        src={prod.images[0]}
                        alt=""
                        className="w-12 h-12 object-cover rounded-lg border border-[#3B1E22]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#181113] border border-[#3B1E22] flex items-center justify-center text-[#DFB982] flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-[#DFB982]" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-white text-xs">{prod.name}</h4>
                      <span className="text-[11px] text-gray-400">
                        {prod.categoryName} • ₹{prod.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePinProduct(prod)}
                    className="bg-[#802336] hover:bg-[#68192a] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    Pin Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
