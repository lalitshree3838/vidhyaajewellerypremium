import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  Download,
  Smartphone,
  ShieldCheck,
  Info,
  Sparkles,
  Zap,
  QrCode,
  Upload,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';

interface GooglePayQRCardProps {
  payeeName?: string;
  upiId?: string;
  amount: number;
  orderNumber: string;
  customQrImageUrl?: string;
}

const LOCAL_STORAGE_CUSTOM_QR_KEY = 'vidhyaa_custom_qr_image';

export const GooglePayQRCard: React.FC<GooglePayQRCardProps> = ({
  payeeName = 'neeraj chauhan',
  upiId = 'neerajchauhan2000-1@oksbi',
  amount,
  orderNumber,
  customQrImageUrl
}) => {
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<'dynamic' | 'standard' | 'uploaded'>('dynamic');
  const [showGuide, setShowGuide] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [uploadedQr, setUploadedQr] = useState<string | null>(() => {
    return customQrImageUrl || localStorage.getItem(LOCAL_STORAGE_CUSTOM_QR_KEY) || null;
  });
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customQrImageUrl) {
      setUploadedQr(customQrImageUrl);
    }
  }, [customQrImageUrl]);

  // Dynamic URI pre-fills amount and order note
  const dynamicUpiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Vidhyaa Jewellery Order ${orderNumber}`)}`;

  // Standard static QR matches the user's authentic Google Pay profile
  const standardUpiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&cu=INR`;

  const activeQrUri = qrMode === 'dynamic' ? dynamicUpiUri : standardUpiUri;

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, or WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedQr(result);
      try {
        localStorage.setItem(LOCAL_STORAGE_CUSTOM_QR_KEY, result);
      } catch (err) {
        console.warn('Could not cache custom QR in localStorage:', err);
      }
      setQrMode('uploaded');
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    setUploadedQr(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_CUSTOM_QR_KEY);
    } catch {}
    setQrMode('dynamic');
  };

  const handleDownloadQR = () => {
    if (qrMode === 'uploaded' && uploadedQr) {
      const a = document.createElement('a');
      a.download = `UPI-QR-${orderNumber}.png`;
      a.href = uploadedQr;
      a.click();
      return;
    }

    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 600;
    canvas.height = 600;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 500, 500);

        const a = document.createElement('a');
        a.download = `GooglePay-UPI-QR-${orderNumber}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Hidden file input for custom QR upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-center gap-1.5 p-1 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] text-xs font-semibold">
        <button
          type="button"
          onClick={() => setQrMode('dynamic')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            qrMode === 'dynamic'
              ? 'bg-white text-[#802336] shadow-xs font-bold border border-[#E8DCCF]/60'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Dynamic QR (Auto ₹{amount.toLocaleString('en-IN')})</span>
        </button>
        <button
          type="button"
          onClick={() => setQrMode('standard')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            qrMode === 'standard'
              ? 'bg-white text-[#802336] shadow-xs font-bold border border-[#E8DCCF]/60'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Official GPay QR</span>
        </button>
        {uploadedQr && (
          <button
            type="button"
            onClick={() => setQrMode('uploaded')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              qrMode === 'uploaded'
                ? 'bg-white text-[#802336] shadow-xs font-bold border border-[#E8DCCF]/60'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Custom QR</span>
          </button>
        )}
      </div>

      {/* Main Google Pay QR Card: Replicating authentic UI */}
      <div className="relative bg-white rounded-3xl p-6 sm:p-7 shadow-lg border border-gray-100 flex flex-col items-center text-center">
        {/* Google Pay Official Header Badge */}
        <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#F8FAFD] px-2.5 py-1 rounded-full border border-blue-100">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="text-[11px] font-bold text-gray-700 tracking-tight">
                UPI QR Code
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Verified Payee
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">
              Order Total to Pay
            </span>
            <span className="font-serif text-lg font-bold text-[#802336]">
              ₹{amount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* User Profile Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3B1E22] via-[#802336] to-[#DFB982] p-0.5 shadow-xs">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              <span className="font-serif font-bold text-sm text-[#802336] uppercase">
                {payeeName.charAt(0)}
              </span>
            </div>
          </div>
          <div className="text-left">
            <h3 className="font-sans text-base font-semibold text-gray-900 tracking-tight leading-tight">
              {payeeName}
            </h3>
            <span className="text-[11px] text-gray-500 font-medium">
              Vidhyaa Jewellery Authorized Account ({upiId})
            </span>
          </div>
        </div>

        {/* QR Code Frame with GPay Emblem in Center OR Custom Uploaded QR */}
        <div
          ref={qrRef}
          className="relative p-3.5 bg-white rounded-2xl border-2 border-gray-100 shadow-sm flex items-center justify-center transition-transform hover:scale-[1.01]"
        >
          {qrMode === 'uploaded' && uploadedQr ? (
            <div className="w-[220px] h-[220px] flex items-center justify-center overflow-hidden rounded-xl bg-white">
              <img
                src={uploadedQr}
                alt="Merchant UPI QR Code"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <QRCodeSVG
              value={activeQrUri}
              size={220}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: '/google-pay-mark.svg',
                x: undefined,
                y: undefined,
                height: 44,
                width: 44,
                excavate: true
              }}
            />
          )}
        </div>

        {/* Scan & Pay Instructions Banner */}
        <div className="mt-3 bg-[#FAF7F2] px-4 py-1.5 rounded-full border border-[#DFB982]/60 flex items-center gap-2">
          <QrCode className="w-3.5 h-3.5 text-[#802336]" />
          <span className="text-xs font-bold text-[#3B1E22] tracking-wide">
            Scan & Pay: ₹{amount.toLocaleString('en-IN')} with any UPI app
          </span>
        </div>

        {/* UPI ID Pill with Quick Copy */}
        <div className="mt-4 w-full bg-[#F8FAFD] rounded-xl border border-gray-200 p-2.5 flex items-center justify-between">
          <div className="text-left pl-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-medium">
              Merchant UPI ID
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-gray-900 select-all">
              {upiId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-white hover:bg-gray-50 text-[#802336] border border-[#E8DCCF]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>

        {/* Accepted Payment Apps Row */}
        <div className="mt-3 flex items-center justify-center gap-2 pt-2 border-t border-gray-100 w-full text-[10px] text-gray-400 flex-wrap">
          <span className="font-semibold text-gray-700">Supported UPI Apps:</span>
          <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium">Google Pay</span>
          <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium">PhonePe</span>
          <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium">Paytm</span>
          <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium">BHIM</span>
          <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium">CRED</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={dynamicUpiUri}
          className="bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>Pay via Google Pay</span>
        </a>

        <button
          type="button"
          onClick={handleDownloadQR}
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-gray-500" />
          <span>Save QR to Gallery</span>
        </button>
      </div>

      {/* Optional Upload / Configuration Area for Merchant QR */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#E8DCCF] text-left text-xs space-y-2">
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center justify-between text-gray-700 hover:text-black font-semibold cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-[#802336] uppercase tracking-wider font-bold">
            <Upload className="w-3.5 h-3.5" />
            <span>Merchant QR Code Upload / Configuration (Optional)</span>
          </span>
          <span className="text-[10px] text-gray-400">{showConfig ? 'Hide' : 'Configure'}</span>
        </button>

        {showConfig && (
          <div className="pt-2 border-t border-gray-100 space-y-2.5 animate-fadeIn">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Our website dynamically generates authentic vector UPI QR codes for <strong>{payeeName}</strong> ({upiId}). If you have a custom scanned payment QR code image, you can upload it here directly:
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#3B1E22] border border-[#E8DCCF] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#802336]" />
                <span>Upload Custom QR Image</span>
              </button>

              {uploadedQr && (
                <button
                  type="button"
                  onClick={handleRemoveCustomQr}
                  className="text-red-600 hover:text-red-700 text-xs font-semibold px-2 py-1 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Vector UPI QR</span>
                </button>
              )}
            </div>

            {uploadSuccess && (
              <span className="text-[11px] text-emerald-700 font-semibold block">
                ✓ Custom QR uploaded and active!
              </span>
            )}
          </div>
        )}
      </div>

      {/* How to pay guide dropdown toggle */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="text-[11px] text-[#802336] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showGuide ? 'Hide instructions' : 'How to pay using QR Code?'}</span>
        </button>

        {showGuide && (
          <div className="mt-2.5 p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8DCCF] text-left text-xs space-y-2 text-gray-700 animate-in fade-in duration-200">
            <h4 className="font-bold text-[#3B1E22] uppercase tracking-wider text-[11px]">
              Easy QR Code Payment Steps:
            </h4>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-gray-600">
              <li>Open <strong>Google Pay</strong>, <strong>PhonePe</strong>, <strong>Paytm</strong>, or <strong>BHIM</strong> on your mobile.</li>
              <li>Tap the <strong>Scan QR</strong> button at the top of your app.</li>
              <li>Point your camera at the QR code displayed above (or save the QR to gallery and scan from photos).</li>
              <li>Verify the Payee shows <strong>{payeeName}</strong> ({upiId}).</li>
              <li>Confirm the total payment of <strong>₹{amount.toLocaleString('en-IN')}</strong> and enter your UPI PIN.</li>
              <li>After payment completes, copy the <strong>12-digit UPI Reference ID / UTR</strong> and enter it below to confirm your order.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
