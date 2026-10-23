import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Package,
  ShoppingBag,
  Settings,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  CheckCircle,
  AlertCircle,
  Truck,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Search,
  Layers,
  X,
  Save,
  Printer,
  Star,
  MessageSquare,
  Check,
  ArrowRight,
  Clock,
  ShieldCheck,
  TrendingUp,
  Tag,
  Radio,
  Users,
  Shield,
  KeyRound,
  CreditCard,
  LogOut,
  Menu,
  ChevronRight,
  Gem,
  Lock,
  Smartphone,
  History,
  DollarSign,
  Upload,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { Product, ProductVariation, Order, OrderStatus, Category, StoreSettings, Review } from '../types';
import { CategoryCMSPanel } from '../components/admin/CategoryCMSPanel';
import { VideoDropzoneUploader } from '../components/admin/VideoDropzoneUploader';
import { AdminLoginView } from '../components/admin/AdminLoginView';
import { AdminSecurityDashboard } from '../components/admin/AdminSecurityDashboard';
import { AdminManagementPanel } from '../components/admin/AdminManagementPanel';
import { AdminMarketingPanel } from '../components/admin/AdminMarketingPanel';
import { AdminJewelleryPanel } from '../components/admin/AdminJewelleryPanel';
import { AdminSmsSettingsPanel } from '../components/admin/AdminSmsSettingsPanel';
import { AdminCashfreeSettingsPanel } from '../components/admin/AdminCashfreeSettingsPanel';
import { AdminSensitiveActionModal } from '../components/admin/AdminSensitiveActionModal';
import { logAuditEvent } from '../lib/securityService';
import {
  saveProduct,
  deleteProduct,
  fetchAllOrders,
  updateOrderStatus,
  saveCategory,
  deleteCategory,
  updateStoreSettings,
  forceReseedCatalog,
  fetchAllReviews,
  deleteReview
} from '../lib/dbService';
import { useAuth } from '../context/AuthContext';
import { isGenuineImageUrl } from '../lib/sampleData';
import { calculateDiscountPercent, formatPrice, validatePrices } from '../lib/priceUtils';
import { uploadProductImageToStorage } from '../lib/storageService';

interface AdminViewProps {
  products: Product[];
  categories: Category[];
  storeSettings: StoreSettings;
  onRefreshData: () => Promise<void>;
  onExitAdmin: () => void;
  onNavigateGoLive?: () => void;
  onNavigateCategory?: (categoryId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  products,
  categories,
  storeSettings,
  onRefreshData,
  onExitAdmin,
  onNavigateGoLive,
  onNavigateCategory
}) => {
  const { user, isAdmin, adminSessionActive, adminUser, logoutAdminSession, signOut } = useAuth();

  // Authentication session state for dedicated /admin/login gate
  const [adminAuthSession, setAdminAuthSession] = useState<boolean>(() => {
    return Boolean(isAdmin || adminSessionActive);
  });

  useEffect(() => {
    if (isAdmin || adminSessionActive) {
      setAdminAuthSession(true);
    }
  }, [isAdmin, adminSessionActive]);

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Inactivity auto-lock and warning state (15 min policy with 60s countdown)
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(60);

  const handleAdminLogout = async (reason = 'ADMIN_MANUAL_LOGOUT') => {
    setInactivityWarning(false);
    setAdminAuthSession(false);
    await logoutAdminSession();
    await signOut();
    await logAuditEvent({
      adminId: user?.uid || adminUser?.email || 'super_admin',
      adminEmail: user?.email || adminUser?.email || 'anavneeraj2003@gmail.com',
      action: reason === 'SESSION_INACTIVITY_AUTOLOCK' ? 'SESSION_EXPIRED_AUTOLOCK' : 'ADMIN_LOGOUT',
      category: 'auth',
      ipAddress: '103.212.144.20',
      userAgent: navigator.userAgent,
      result: 'success',
      details: reason === 'SESSION_INACTIVITY_AUTOLOCK'
        ? 'Executive admin session secured following 15 minutes of inactivity.'
        : 'Administrator manual logout from Executive Portal.'
    });
  };

  useEffect(() => {
    if (!adminAuthSession) return;

    let warningTimer: any;
    let autoLockTimer: any;
    let countdownInterval: any;

    const INACTIVITY_LIMIT_MS = 14 * 60 * 1000; // 14 mins until warning
    const WARNING_DURATION_MS = 60 * 1000; // 60s warning countdown

    const resetInactivityTimers = () => {
      setInactivityWarning(false);
      setCountdownSeconds(60);
      clearTimeout(warningTimer);
      clearTimeout(autoLockTimer);
      clearInterval(countdownInterval);

      warningTimer = setTimeout(() => {
        setInactivityWarning(true);
        setCountdownSeconds(60);

        countdownInterval = setInterval(() => {
          setCountdownSeconds((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        autoLockTimer = setTimeout(async () => {
          await handleAdminLogout('SESSION_INACTIVITY_AUTOLOCK');
        }, WARNING_DURATION_MS);
      }, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      if (!inactivityWarning) {
        resetInactivityTimers();
      }
    };

    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity));
    resetInactivityTimers();

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
      clearTimeout(warningTimer);
      clearTimeout(autoLockTimer);
      clearInterval(countdownInterval);
    };
  }, [adminAuthSession, inactivityWarning]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'products'
    | 'orders'
    | 'categories'
    | 'customers'
    | 'marketing'
    | 'jewellery'
    | 'payments'
    | 'reviews'
    | 'analytics'
    | 'admin_management'
    | 'security'
    | 'settings'
  >('overview');

  // Sensitive action confirmation modal state
  const [sensitiveModal, setSensitiveModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    isDestructive: true,
    onConfirm: () => {}
  });

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [courierInput, setCourierInput] = useState('');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [updatingFulfillment, setUpdatingFulfillment] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Local reactive states for instantaneous catalog & category updates
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Ensure Admin Panel fetches the absolute latest database records upon mount
  useEffect(() => {
    onRefreshData().catch((err) => {
      console.warn('[AdminView] Auto-refresh catalog notice:', err);
    });

    const handleProductsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLocalProducts(e.detail);
      }
    };
    window.addEventListener('vidhyaa_products_updated', handleProductsUpdated);
    return () => window.removeEventListener('vidhyaa_products_updated', handleProductsUpdated);
  }, []);

  const handleManualRefreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      await onRefreshData();
    } catch (err: any) {
      console.error('[AdminView] Manual refresh error:', err);
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  // Product Deletion Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [deleteProductError, setDeleteProductError] = useState<string | null>(null);
  const [deleteProductSuccess, setDeleteProductSuccess] = useState<string | null>(null);

  // Product Filter & Edit Modal State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [saveProductError, setSaveProductError] = useState<string | null>(null);
  const [saveProductSuccess, setSaveProductSuccess] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  
  // Dedicated Image Upload State (Only "Upload Image" & "Add Image")
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<{
    file: File;
    previewUrl: string;
    base64: string;
    name: string;
    size: number;
  } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Category Modal State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [subcatInput, setSubcatInput] = useState('');

  // Settings State
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(storeSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Seeding Status
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Packing slip printable preview
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
    loadReviews();
  }, []);

  useEffect(() => {
    setSettingsForm(storeSettings);
  }, [storeSettings]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const all = await fetchAllOrders();
      setOrders(all);
    } catch (e) {
      console.error('Error fetching orders for admin:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const all = await fetchAllReviews();
      setReviews(all);
    } catch (e) {
      console.warn('Error fetching reviews:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Metrics
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
  const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const todayDateString = new Date().toISOString().split('T')[0];
  const todaySales = paidOrders
    .filter((o) => o.createdAt.startsWith(todayDateString))
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'Pending' || o.orderStatus === 'Confirmed').length;
  const processingCount = orders.filter((o) => o.orderStatus === 'Processing' || o.orderStatus === 'Shipped').length;
  const completedOrdersCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
  const lowStockProducts = localProducts.filter((p) => p.stock <= 5);

  // Reseed Catalog
  const handleReseed = async () => {
    if (!window.confirm('Reset/seed initial luxury jewellery catalog in Firebase Firestore? This will refresh all products and categories.')) return;
    setIsSeeding(true);
    try {
      await forceReseedCatalog();
      await onRefreshData();
      await loadOrders();
      await loadReviews();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
    } catch (e) {
      alert('Error reseeding catalog: ' + String(e));
    } finally {
      setIsSeeding(false);
    }
  };

  // -------------------------------------------------------------
  // Product Operations
  // -------------------------------------------------------------
  const handleOpenNewProduct = () => {
    const defaultCat = categories[0] || { id: 'necklaces', name: 'Necklaces & Necklace Sets', subcategories: ['Necklaces', 'Chokers'] };
    const newProd: Product = {
      id: `prod_${Date.now()}`,
      name: '',
      slug: '',
      categoryId: defaultCat.id,
      categoryName: defaultCat.name,
      subcategory: defaultCat.subcategories[0] || 'Necklaces',
      description: '',
      shortDescription: '',
      material: '22K Micro Gold Plated Brass & Heritage Kundan',
      price: 1999,
      mrp: 3999,
      discountPercent: 50,
      images: [],
      stock: 10,
      inStock: true,
      active: true,
      isFeatured: true,
      isBestseller: false,
      isNewArrival: true,
      rating: 5.0,
      reviewCount: 1,
      specifications: { 'Plating': '24K Micro Gold Plated', 'Craft': 'Handcrafted Heirlooms' },
      careInstructions: 'Keep away from water and perfumes. Store in airtight pouch.',
      variations: [
        {
          id: `var_${Date.now()}_1`,
          name: 'Imperial Yellow Gold',
          colorFinish: 'Yellow Gold',
          hexCode: '#D4AF37',
          sku: `VDH-PROD-${Math.floor(100 + Math.random() * 900)}-YG`,
          price: 1999,
          mrp: 3999,
          stock: 8,
          image: '',
          active: true
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingProduct(newProd);
    setIsCreatingNewProduct(true);
    setSelectedFileForUpload(null);
    setImageUploadStatus(null);
    setSaveProductError(null);
    setSaveProductSuccess(null);
    setImageUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditProduct = (prod: Product) => {
    // Deep clone product to prevent mutation of existing state
    setEditingProduct(JSON.parse(JSON.stringify(prod)));
    setIsCreatingNewProduct(false);
    setSelectedFileForUpload(null);
    setImageUploadStatus(null);
    setSaveProductError(null);
    setSaveProductSuccess(null);
    setImageUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSaveProductError(null);
    setSaveProductSuccess(null);

    // Validate title
    if (!editingProduct.name || !editingProduct.name.trim()) {
      setSaveProductError('Design Title is required.');
      return;
    }

    // Validate that prices are non-negative and selling price does not exceed MRP
    const priceCheck = validatePrices(editingProduct.mrp, editingProduct.price);
    if (!priceCheck.valid) {
      setSaveProductError(priceCheck.error || 'Selling price cannot exceed Original MRP.');
      return;
    }

    setSavingProduct(true);
    try {
      const sellingPrice = Number(editingProduct.price) || 0;
      const originalMrp = Number(editingProduct.mrp) || sellingPrice;
      const discount = calculateDiscountPercent(originalMrp, sellingPrice);

      const updatedVariations = (editingProduct.variations || []).map((v) => ({
        ...v,
        price: sellingPrice,
        mrp: originalMrp
      }));

      const updated: Product = {
        ...editingProduct,
        name: editingProduct.name.trim(),
        slug: (editingProduct.slug || editingProduct.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `prod-${Date.now()}`,
        discountPercent: discount,
        stock: Number(editingProduct.stock) >= 0 ? Number(editingProduct.stock) : 0,
        inStock: Number(editingProduct.stock) > 0,
        price: sellingPrice,
        mrp: originalMrp,
        variations: updatedVariations,
        active: editingProduct.active !== false,
        updatedAt: new Date().toISOString()
      };

      const saved = await saveProduct(updated);
      setLocalProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx !== -1) {
          const clone = [...prev];
          clone[idx] = saved;
          return clone;
        }
        return [saved, ...prev];
      });
      setSaveProductSuccess(`✓ Product "${saved.name}" successfully saved to database!`);

      // Refresh parent database data
      await onRefreshData();

      // Close modal after brief confirmation so admin sees backend confirmed
      setTimeout(() => {
        setEditingProduct(null);
        setIsCreatingNewProduct(false);
        setSaveProductSuccess(null);
      }, 700);
    } catch (e: any) {
      console.error('Failed to save product in AdminView:', e);
      setSaveProductError('Failed to save product to database: ' + (e?.message || String(e)));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDuplicateProduct = async (prod: Product) => {
    const copy: Product = {
      ...prod,
      id: `prod_${Date.now()}`,
      name: `${prod.name} (Copy)`,
      slug: `${prod.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveProduct(copy);
    await onRefreshData();
  };

  const handleRequestDeleteProduct = (prod: Product) => {
    setDeleteProductError(null);
    setProductToDelete(prod);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    setDeleteProductError(null);
    const targetId = productToDelete.id;
    const targetName = productToDelete.name;

    try {
      // 1. Immediately remove from local list for instant visual feedback
      setLocalProducts((prev) => prev.filter((p) => p.id !== targetId));

      // 2. Delete from database & persistent store
      await deleteProduct(targetId);

      // 3. Show clear success message
      setDeleteProductSuccess(`"${targetName}" was successfully removed from the store catalog.`);
      setTimeout(() => setDeleteProductSuccess(null), 4000);

      // 4. Close confirmation dialog
      setProductToDelete(null);

      // 5. Sync parent catalog
      await onRefreshData();
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setDeleteProductError(err?.message || 'Failed to delete product. Please try again.');
      setLocalProducts(products); // Rollback if error
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Quick inline stock adjustment (+ / -)
  const handleAdjustStock = async (prod: Product, delta: number) => {
    const newStock = Math.max(0, prod.stock + delta);
    const updated: Product = {
      ...prod,
      stock: newStock,
      inStock: newStock > 0,
      updatedAt: new Date().toISOString()
    };
    await saveProduct(updated);
    await onRefreshData();
  };

  const handleToggleProductActive = async (prod: Product) => {
    const updated: Product = {
      ...prod,
      active: !prod.active,
      updatedAt: new Date().toISOString()
    };
    await saveProduct(updated);
    await onRefreshData();
  };

  // Variation helper within edit product
  const handleAddVariation = () => {
    if (!editingProduct) return;
    const newVar: ProductVariation = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: 'New Color Finish',
      colorFinish: 'Rose Gold',
      hexCode: '#E0A996',
      sku: `VDH-VAR-${Math.floor(100 + Math.random() * 900)}`,
      price: editingProduct.price,
      mrp: editingProduct.mrp,
      stock: 5,
      image: editingProduct.images[0] || '',
      active: true
    };
    setEditingProduct({
      ...editingProduct,
      variations: [...editingProduct.variations, newVar]
    });
  };

  const handleUpdateVariation = (index: number, field: keyof ProductVariation, value: any) => {
    if (!editingProduct) return;
    const vars = [...editingProduct.variations];
    vars[index] = { ...vars[index], [field]: value };
    setEditingProduct({ ...editingProduct, variations: vars });
  };

  const handleRemoveVariation = (index: number) => {
    if (!editingProduct) return;
    const vars = editingProduct.variations.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, variations: vars });
  };

  // -------------------------------------------------------------
  // Dedicated Product Image Handlers (Upload Image & Add Image)
  // -------------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploadStatus(null);

    // Validate image format: JPG, JPEG, PNG, WEBP
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validTypes.includes(file.type) && (!ext || !validExts.includes(ext))) {
      setImageUploadStatus({
        type: 'error',
        message: 'Unsupported format. Please select a JPG, JPEG, PNG, or WebP photo.'
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Size limit (25MB)
    if (file.size > 25 * 1024 * 1024) {
      setImageUploadStatus({
        type: 'error',
        message: 'File size exceeds 25MB limit. Please choose a smaller photo.'
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (selectedFileForUpload?.previewUrl) {
        URL.revokeObjectURL(selectedFileForUpload.previewUrl);
      }
      setSelectedFileForUpload({
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        name: file.name,
        size: file.size
      });
      setImageUploadStatus({
        type: 'success',
        message: `Photo selected: "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Click "Add Image" to save it to this product.`
      });
    };
    reader.onerror = () => {
      setImageUploadStatus({
        type: 'error',
        message: 'Failed to read selected image file. Please try again.'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearSelectedFile = () => {
    if (selectedFileForUpload?.previewUrl) {
      URL.revokeObjectURL(selectedFileForUpload.previewUrl);
    }
    setSelectedFileForUpload(null);
    setImageUploadStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddImageToProduct = async () => {
    if (!editingProduct) return;

    if (!selectedFileForUpload) {
      setImageUploadStatus({
        type: 'error',
        message: 'Please click "Upload Image" first to select a photo from your gallery or computer.'
      });
      return;
    }

    setUploadingImage(true);
    setImageUploadStatus(null);

    try {
      // Upload directly to persistent Firebase Cloud Storage (with optimized data URI fallback)
      const uploadedUrl = await uploadProductImageToStorage(
        selectedFileForUpload.file,
        editingProduct.name
      );

      // Add to product images
      const updatedImages = [...(editingProduct.images || []), uploadedUrl];

      // If variations don't have an image or first variation matches empty, set it
      const updatedVariations = (editingProduct.variations || []).map((v, idx) => {
        if (idx === 0 && (!v.image || v.image === '')) {
          return { ...v, image: uploadedUrl };
        }
        return v;
      });

      setEditingProduct({
        ...editingProduct,
        images: updatedImages,
        variations: updatedVariations
      });

      // Clear pending selection
      if (selectedFileForUpload.previewUrl) {
        URL.revokeObjectURL(selectedFileForUpload.previewUrl);
      }
      setSelectedFileForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setImageUploadStatus({
        type: 'success',
        message: `✓ Image "${selectedFileForUpload.name}" attached permanently and added to product gallery! Click "Save Jewellery Product" to record your changes.`
      });
    } catch (err: any) {
      console.error('Image attachment failed:', err);
      setImageUploadStatus({
        type: 'error',
        message: `Upload Failed: ${err.message || 'Could not process image. Please try again.'}`
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImageFromProduct = (index: number) => {
    if (!editingProduct) return;
    const imgs = editingProduct.images.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, images: imgs });
  };

  const handleSetPrimaryImage = (index: number) => {
    if (!editingProduct || index === 0) return;
    const imgs = [...editingProduct.images];
    const [selected] = imgs.splice(index, 1);
    imgs.unshift(selected);
    setEditingProduct({ ...editingProduct, images: imgs });
  };

  // -------------------------------------------------------------
  // Order Operations
  // -------------------------------------------------------------
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    trackingNumber?: string,
    courierName?: string
  ) => {
    try {
      await updateOrderStatus(orderId, status, trackingNumber, courierName);
      await loadOrders();
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails({
          ...selectedOrderDetails,
          orderStatus: status,
          trackingNumber: trackingNumber || selectedOrderDetails.trackingNumber,
          courierName: courierName || selectedOrderDetails.courierName
        });
      }
    } catch (e) {
      alert('Failed to update status: ' + String(e));
    }
  };

  const handleSaveFulfillment = async () => {
    if (!selectedOrderDetails) return;
    setUpdatingFulfillment(true);
    try {
      await handleUpdateOrderStatus(
        selectedOrderDetails.id,
        selectedOrderDetails.orderStatus === 'Pending' || selectedOrderDetails.orderStatus === 'Confirmed'
          ? 'Shipped'
          : selectedOrderDetails.orderStatus,
        trackingNumberInput.trim() || selectedOrderDetails.trackingNumber,
        courierInput.trim() || selectedOrderDetails.courierName
      );
      alert('Tracking and fulfillment saved successfully!');
    } finally {
      setUpdatingFulfillment(false);
    }
  };

  // -------------------------------------------------------------
  // Category Operations
  // -------------------------------------------------------------
  const handleOpenNewCategory = () => {
    setEditingCategory({
      id: `cat_${Date.now()}`,
      name: '',
      slug: '',
      description: '',
      image: '',
      subcategories: ['Necklaces', 'Earrings', 'Sets'],
      active: true,
      order: categories.length + 1
    });
    setIsCreatingNewCategory(true);
    setSubcatInput('');
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory({ ...cat });
    setIsCreatingNewCategory(false);
    setSubcatInput('');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const slug = editingCategory.slug || editingCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const finalCat: Category = {
        ...editingCategory,
        slug,
        id: editingCategory.id || slug
      };
      await saveCategory(finalCat);
      await onRefreshData();
      setEditingCategory(null);
      setIsCreatingNewCategory(false);
    } catch (e) {
      alert('Failed to save category: ' + String(e));
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm('Delete this category? Products in this category will still remain.')) return;
    try {
      await deleteCategory(catId);
      await onRefreshData();
    } catch (e) {
      alert('Failed to delete category: ' + String(e));
    }
  };

  const handleAddSubcatToCategory = () => {
    if (!editingCategory || !subcatInput.trim()) return;
    if (editingCategory.subcategories.includes(subcatInput.trim())) return;
    setEditingCategory({
      ...editingCategory,
      subcategories: [...editingCategory.subcategories, subcatInput.trim()]
    });
    setSubcatInput('');
  };

  const handleRemoveSubcat = (sc: string) => {
    if (!editingCategory) return;
    setEditingCategory({
      ...editingCategory,
      subcategories: editingCategory.subcategories.filter((s) => s !== sc)
    });
  };

  // -------------------------------------------------------------
  // Review Moderation
  // -------------------------------------------------------------
  const handleDeleteReview = async (revId: string) => {
    if (!window.confirm('Remove this customer review?')) return;
    try {
      await deleteReview(revId);
      await loadReviews();
    } catch (e) {
      alert('Error deleting review: ' + String(e));
    }
  };

  // -------------------------------------------------------------
  // Settings Save
  // -------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateStoreSettings(settingsForm);
      setSettingsSaved(true);
      await onRefreshData();
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (e) {
      alert('Error updating settings: ' + String(e));
    }
  };

  // Filtered products
  const filteredProducts = localProducts.filter((p) => {
    if (productCategoryFilter !== 'all' && p.categoryId !== productCategoryFilter) return false;
    if (productStockFilter === 'in_stock' && p.stock <= 0) return false;
    if (productStockFilter === 'low_stock' && (p.stock <= 0 || p.stock > 5)) return false;
    if (productStockFilter === 'out_of_stock' && p.stock > 0) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.material.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      p.subcategory.toLowerCase().includes(q)
    );
  });

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) return false;
    if (!orderSearchQuery.trim()) return true;
    const q = orderSearchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      (o.upiReference && o.upiReference.includes(q))
    );
  });

  if (!adminAuthSession) {
    return (
      <AdminLoginView
        onSuccessLogin={() => setAdminAuthSession(true)}
        onNavigateHome={onExitAdmin}
      />
    );
  }

  return (
    <div className="bg-[#FAF7F2] min-h-screen pb-20">
      {/* Top Admin Header Bar */}
      <header className="bg-[#241C1A] text-white border-b border-[#3B1E22] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#D4AF37] text-xl">✦</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-bold tracking-wider">
                  VIDHYAA Jewellery Studio
                </span>
                <span className="bg-[#802336] text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white tracking-widest">
                  ADMIN PANEL
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Atelier Operations, Inventory & Live Order Fulfillment • Roorkee, District Haridwar, Uttarakhand
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {/* Launch Go Live Stream Studio */}
            {onNavigateGoLive && (
              <button
                onClick={onNavigateGoLive}
                className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                title="Launch Live Atelier Broadcast"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Go Live Studio</span>
              </button>
            )}

            {/* Verified Admin Security Status Badge */}
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              title="Verified Administrator Session"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin: Verified</span>
            </div>

            {/* Reseed Button */}
            <button
              onClick={handleReseed}
              disabled={isSeeding}
              className="bg-[#3B1E22] hover:bg-[#802336] text-white border border-[#D4AF37]/40 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restore / seed initial catalog"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Seeding...' : 'Reseed Catalog'}</span>
            </button>

            {/* Lock / Logout Portal */}
            <button
              onClick={() => handleAdminLogout('ADMIN_MANUAL_LOGOUT')}
              className="bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Lock admin session and log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Portal</span>
            </button>

            {/* Exit to Storefront */}
            <button
              onClick={onExitAdmin}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="bg-white border-b border-[#E8DCCF] sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex overflow-x-auto space-x-1 sm:space-x-3 text-xs font-bold uppercase tracking-wider py-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products ({localProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Orders ({orders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="bg-[#802336] text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Categories ({localCategories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('jewellery')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'jewellery'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Gem className="w-4 h-4" />
            <span>Atelier & Crafts</span>
          </button>

          <button
            onClick={() => setActiveTab('marketing')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'marketing'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Coupons & Marketing</span>
          </button>

          <button
            onClick={() => setActiveTab('admin_management')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'admin_management'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team & RBAC</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#DFB982]" />
            <span>Security & Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Reviews ({reviews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-[#3B1E22] text-[#FAF7F2] shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Store Settings</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {seedSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Luxury catalogue and store settings successfully reset and synchronized with Firestore!</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-[#E8DCCF] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
                  <span>Gross Revenue</span>
                  <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#802336]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-serif font-bold text-[#3B1E22]">
                  ₹{totalSales.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">
                  {paidOrders.length} verified paid UPI transactions
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8DCCF] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
                  <span>Pending Fulfillment</span>
                  <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center text-amber-700">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-serif font-bold text-amber-700">
                  {pendingOrdersCount}
                </div>
                <p className="text-[11px] text-gray-500">
                  Requires packaging & dispatch
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8DCCF] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
                  <span>In Transit / Dispatched</span>
                  <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#802336]">
                    <Truck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-serif font-bold text-[#802336]">
                  {processingCount}
                </div>
                <p className="text-[11px] text-gray-500">
                  {completedOrdersCount} total orders delivered
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8DCCF] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
                  <span>Low Stock Warnings</span>
                  <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center text-red-600">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-serif font-bold text-red-600">
                  {lowStockProducts.length}
                </div>
                <p className="text-[11px] text-gray-500">
                  Designs with 5 or fewer items
                </p>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 shadow-xs">
              <h3 className="font-serif text-base font-bold text-[#3B1E22] mb-3">
                Quick Atelier Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                {onNavigateGoLive && (
                  <button
                    onClick={onNavigateGoLive}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>Host Live Stream Studio</span>
                  </button>
                )}

                <button
                  onClick={handleOpenNewProduct}
                  className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4 text-[#DFB982]" />
                  <span>Add New Jewellery Design</span>
                </button>

                <button
                  onClick={handleOpenNewCategory}
                  className="bg-white hover:bg-gray-50 text-[#3B1E22] border border-[#E8DCCF] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Layers className="w-4 h-4 text-[#802336]" />
                  <span>Add Store Category</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className="bg-white hover:bg-gray-50 text-[#3B1E22] border border-[#E8DCCF] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Truck className="w-4 h-4 text-[#802336]" />
                  <span>Manage Live Orders ({orders.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-white hover:bg-gray-50 text-[#3B1E22] border border-[#E8DCCF] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span>Configure UPI & Free Delivery</span>
                </button>
              </div>
            </div>

            {/* Low Stock Alerts & Recent Orders Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Low Stock Alert List */}
              <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-[#3B1E22] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Low Stock Inventory Alerts</span>
                  </h3>
                  <span className="text-xs text-gray-500">{lowStockProducts.length} items</span>
                </div>

                {lowStockProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-500 bg-[#FAF7F2] rounded-xl border border-dashed border-[#E8DCCF]">
                    All jewellery items are healthy in stock!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
                    {lowStockProducts.map((prod) => (
                      <div key={prod.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {prod.images?.[0] ? (
                            <img
                              src={prod.images[0]}
                              alt=""
                              className="w-10 h-10 object-contain bg-white p-0.5 rounded-lg border border-[#E8DCCF]"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#E8DCCF] flex items-center justify-center text-xs text-[#802336] font-bold">
                              VDH
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-[#3B1E22] truncate max-w-[180px]">
                              {prod.name}
                            </h4>
                            <span className="text-[10px] text-gray-500 block">
                              {prod.categoryName} • ₹{prod.price.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            {prod.stock} left
                          </span>
                          <button
                            onClick={() => handleAdjustStock(prod, 10)}
                            className="text-[10px] bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#802336] px-2 py-1 rounded font-bold border border-[#E8DCCF] cursor-pointer"
                            title="Quick replenish +10 items"
                          >
                            +10 Stock
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders Overview */}
              <div className="bg-white rounded-2xl border border-[#E8DCCF] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-[#3B1E22] flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#802336]" />
                    <span>Recent Customer Orders</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-bold text-[#802336] hover:underline cursor-pointer"
                  >
                    View All ({orders.length}) →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-500 bg-[#FAF7F2] rounded-xl border border-dashed border-[#E8DCCF]">
                    No orders placed yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
                    {orders.slice(0, 5).map((ord) => (
                      <div key={ord.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#3B1E22]">
                              {ord.orderNumber}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded ${
                              ord.orderStatus === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.orderStatus === 'Shipped'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ord.orderStatus}
                            </span>
                          </div>
                          <span className="text-gray-500 text-[11px] block mt-0.5">
                            {ord.customerName} • {ord.items.length} item(s)
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-[#802336] block">
                            ₹{ord.totalAmount.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedOrderDetails(ord);
                              setCourierInput(ord.courierName || 'BlueDart Express');
                              setTrackingNumberInput(ord.trackingNumber || '');
                            }}
                            className="text-[10px] text-gray-500 underline hover:text-black cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PRODUCTS & INVENTORY MANAGEMENT */}
        {/* ======================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                  Jewellery Catalog & Inventory
                </h2>
                <p className="text-xs text-gray-500">
                  Manage designs, pricing, specifications, image galleries, and multi-color variations.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleManualRefreshCatalog}
                  disabled={isRefreshingCatalog}
                  className="bg-white hover:bg-gray-50 text-[#3B1E22] border border-[#E8DCCF] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  title="Force re-fetch all products from database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#802336] ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingCatalog ? 'Syncing...' : 'Sync Database'}</span>
                </button>

                <button
                  onClick={handleOpenNewProduct}
                  className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-md w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4 text-[#DFB982]" />
                  <span>Add New Jewellery Design</span>
                </button>
              </div>
            </div>

            {/* Product Deletion Feedback */}
            {deleteProductSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-fadeIn shadow-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{deleteProductSuccess}</span>
              </div>
            )}

            {/* Product Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8DCCF] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search design, material, style..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none"
                >
                  <option value="all">All Categories ({localProducts.length})</option>
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={productStockFilter}
                  onChange={(e) => setProductStockFilter(e.target.value as any)}
                  className="bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in_stock">In Stock (&gt;0)</option>
                  <option value="low_stock">Low Stock (≤5)</option>
                  <option value="out_of_stock">Out of Stock (0)</option>
                </select>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-[#E8DCCF] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-[#FAF7F2] text-[#3B1E22] font-serif border-b border-[#E8DCCF]">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Piece & Image</th>
                      <th className="py-3.5 px-4 font-bold">Category & Style</th>
                      <th className="py-3.5 px-4 font-bold">Variations</th>
                      <th className="py-3.5 px-4 font-bold">Price & MRP</th>
                      <th className="py-3.5 px-4 font-bold">Stock Inventory</th>
                      <th className="py-3.5 px-4 font-bold">Status</th>
                      <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-gray-500">
                          No jewellery products found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => (
                        <tr key={prod.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {prod.images?.[0] ? (
                                <img
                                  src={prod.images[0]}
                                  alt=""
                                  className="w-12 h-12 object-contain bg-white p-0.5 rounded-xl border border-[#E8DCCF] flex-shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E8DCCF] flex items-center justify-center flex-shrink-0 text-xs text-[#802336] font-bold">
                                  VDH
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-[#241C1A] text-xs max-w-xs truncate">
                                  {prod.name}
                                </h4>
                                <span className="text-[11px] text-gray-500 block truncate max-w-[200px]">
                                  {prod.material}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-gray-800 block">
                              {prod.categoryName}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {prod.subcategory}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                              {prod.variations.map((v) => (
                                <span
                                  key={v.id}
                                  className="inline-flex items-center gap-1 text-[10px] bg-[#FAF7F2] border border-[#E8DCCF] px-1.5 py-0.5 rounded"
                                  title={`${v.name} (${v.colorFinish}) - SKU: ${v.sku}`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                                    style={{ backgroundColor: v.hexCode }}
                                  />
                                  <span>{v.colorFinish}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#802336] text-sm block">
                              {formatPrice(prod.price)}
                            </span>
                            {prod.mrp > prod.price ? (
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[11px] text-gray-400 line-through">
                                  {formatPrice(prod.mrp)}
                                </span>
                                <span className="text-[10px] bg-[#D4AF37] text-[#3B1E22] font-bold px-1.5 py-0.5 rounded leading-none">
                                  {calculateDiscountPercent(prod.mrp, prod.price)}% OFF
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400">Regular Price</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustStock(prod, -1)}
                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold cursor-pointer"
                                title="Decrease stock"
                              >
                                -
                              </button>
                              <span
                                className={`font-bold px-2 py-0.5 rounded text-xs min-w-8 text-center ${
                                  prod.stock <= 0
                                    ? 'bg-red-100 text-red-800'
                                    : prod.stock <= 5
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {prod.stock}
                              </span>
                              <button
                                onClick={() => handleAdjustStock(prod, 1)}
                                className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold cursor-pointer"
                                title="Increase stock"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleProductActive(prod)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                prod.active
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {prod.active ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditProduct(prod)}
                                className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#3B1E22] transition-colors cursor-pointer"
                                title="Edit jewellery design"
                              >
                                <Edit className="w-4 h-4 text-[#802336]" />
                              </button>

                              <button
                                onClick={() => handleDuplicateProduct(prod)}
                                className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F4EBE1] text-gray-600 transition-colors cursor-pointer"
                                title="Duplicate product"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleRequestDeleteProduct(prod)}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: LIVE ORDERS & FULFILLMENT */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                  Orders & Shipping Fulfillment
                </h2>
                <p className="text-xs text-gray-500">
                  Manage real-time UPI orders, assign BlueDart/Delhivery tracking AWB numbers, and update delivery statuses.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadOrders}
                  className="bg-white border border-[#E8DCCF] text-gray-700 hover:text-black px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                  <span>Refresh Orders</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8DCCF] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search order number, customer name, phone, UTR..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                {['all', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      orderStatusFilter === st
                        ? 'bg-[#3B1E22] text-white shadow-xs'
                        : 'bg-[#FAF7F2] text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {st === 'all' ? `All (${orders.length})` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-[#E8DCCF] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-[#FAF7F2] text-[#3B1E22] font-serif border-b border-[#E8DCCF]">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Order #</th>
                      <th className="py-3.5 px-4 font-bold">Date & Time</th>
                      <th className="py-3.5 px-4 font-bold">Customer Details</th>
                      <th className="py-3.5 px-4 font-bold">Items & Variations</th>
                      <th className="py-3.5 px-4 font-bold">UPI Reference (UTR)</th>
                      <th className="py-3.5 px-4 font-bold">Amount Paid</th>
                      <th className="py-3.5 px-4 font-bold">Fulfillment Status</th>
                      <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-500">
                          No customer orders match the current criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#3B1E22]">
                            {ord.orderNumber}
                          </td>

                          <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                            <span className="block text-gray-400">
                              {new Date(ord.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#241C1A] block">
                              {ord.customerName}
                            </span>
                            <span className="text-[11px] text-gray-500 block truncate max-w-[150px]">
                              {ord.customerEmail}
                            </span>
                            <span className="text-[11px] text-gray-600 font-mono">
                              {ord.customerPhone}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              {ord.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-800 truncate max-w-[140px]">
                                    {it.productName}
                                  </span>
                                  <span className="text-[10px] bg-[#FAF7F2] px-1.5 py-0.2 rounded border border-[#E8DCCF] text-[#802336]">
                                    {it.variationName}
                                  </span>
                                  <span className="text-[10px] text-gray-400">x{it.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-gray-700">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                              {ord.upiReference || 'VERIFIED'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-sm text-[#802336]">
                            ₹{ord.totalAmount.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              value={ord.orderStatus}
                              onChange={(e) =>
                                handleUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                              }
                              className={`border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer focus:outline-none ${
                                ord.orderStatus === 'Delivered'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : ord.orderStatus === 'Shipped'
                                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                                  : ord.orderStatus === 'Cancelled'
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : 'bg-amber-50 border-amber-300 text-amber-800'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedOrderDetails(ord);
                                  setCourierInput(ord.courierName || 'BlueDart Express');
                                  setTrackingNumberInput(ord.trackingNumber || '');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#3B1E22] hover:bg-[#802336] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </button>

                              <button
                                onClick={() => setPrintOrder(ord)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                                title="Print Packing Slip"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CATEGORIES MANAGEMENT CMS */}
        {/* ======================================================== */}
        {activeTab === 'categories' && (
          <CategoryCMSPanel
            categories={localCategories}
            products={localProducts}
            onCategoriesUpdated={async (updatedCats) => {
              if (updatedCats) {
                setLocalCategories(updatedCats);
              }
              await onRefreshData();
            }}
            onPreviewCategory={(cat) => {
              if (onNavigateCategory) {
                onNavigateCategory(cat.id);
              } else {
                onExitAdmin();
              }
            }}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 5: REVIEWS MODERATION */}
        {/* ======================================================== */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                  Customer Reviews & Testimonials
                </h2>
                <p className="text-xs text-gray-500">
                  Moderate customer feedback submitted across product detail pages.
                </p>
              </div>

              <button
                onClick={loadReviews}
                className="bg-white border border-[#E8DCCF] text-gray-700 hover:text-black px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingReviews ? 'animate-spin' : ''}`} />
                <span>Refresh Reviews</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8DCCF] shadow-xs overflow-hidden">
              <div className="divide-y divide-gray-100">
                {reviews.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    No customer reviews found.
                  </div>
                ) : (
                  reviews.map((rev) => {
                    const prod = products.find((p) => p.id === rev.productId);
                    return (
                      <div key={rev.id} className="p-5 flex flex-col sm:flex-row items-start justify-between gap-4 hover:bg-[#FAF7F2]/40 transition-colors">
                        <div className="space-y-1.5 text-xs flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#3B1E22] text-sm">
                              {rev.userName}
                            </span>
                            <div className="flex text-[#D4AF37]">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    i < rev.rating ? 'fill-[#D4AF37]' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            {rev.verifiedPurchase && (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                Verified Purchase
                              </span>
                            )}
                          </div>

                          <p className="text-gray-700 italic">
                            "{rev.comment}"
                          </p>

                          <div className="text-[11px] text-gray-400 flex items-center gap-2">
                            <span>Product: <strong className="text-gray-600">{prod?.name || rev.productId}</strong></span>
                            <span>•</span>
                            <span>{new Date(rev.createdAt).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: GLOBAL STORE SETTINGS */}
        {/* ======================================================== */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-[#E8DCCF] p-8 shadow-xs max-w-3xl animate-fadeIn space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                Store Settings & Delivery Parameters
              </h2>
              <p className="text-xs text-gray-500">
                Configure UPI checkout receiver credentials, delivery fees, and headquarters contact details.
              </p>
            </div>

            {settingsSaved && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Store configuration saved successfully to Firestore!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Free Delivery Threshold (INR) *
                  </label>
                  <input
                    type="number"
                    required
                    value={settingsForm.freeDeliveryThreshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, freeDeliveryThreshold: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Cart subtotal above which shipping is automatically FREE across India.
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Standard Delivery Fee (INR) *
                  </label>
                  <input
                    type="number"
                    required
                    value={settingsForm.deliveryCharge}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, deliveryCharge: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Applied only on orders below the threshold (e.g., ₹60).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Merchant UPI VPA ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.upiVpa}
                    onChange={(e) => setSettingsForm({ ...settingsForm, upiVpa: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    The UPI VPA for Google Pay, PhonePe, Paytm, and BHIM QR code generation.
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    UPI Payee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.upiPayeeName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, upiPayeeName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Top Announcement Bar Text *
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.announcementText}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, announcementText: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Studio Contact Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.contactPhone}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, contactPhone: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Studio Customer Care Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={settingsForm.contactEmail}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, contactEmail: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Business Owner *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.businessOwner || 'Neeraj Chauhan'}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, businessOwner: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.pincode || '247667'}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, pincode: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Studio Headquarters Address *
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.contactAddress}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, contactAddress: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-[#E8DCCF] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-8 py-3 rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4 text-[#DFB982]" />
                  <span>Save Store Configuration</span>
                </button>
              </div>
            </form>

            {/* SMS OTP Gateway & Mobile Login Configuration */}
            <AdminSmsSettingsPanel />

            {/* Cashfree Payments Gateway (Credit / Debit Cards) Configuration */}
            <AdminCashfreeSettingsPanel />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: FINE JEWELLERY ATELIER */}
        {/* ======================================================== */}
        {activeTab === 'jewellery' && (
          <div className="animate-fadeIn">
            <AdminJewelleryPanel
              products={products}
              onEditProduct={(p) => setEditingProduct(p)}
              onOpenNewProduct={handleOpenNewProduct}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: COUPONS & MARKETING */}
        {/* ======================================================== */}
        {activeTab === 'marketing' && (
          <div className="animate-fadeIn">
            <AdminMarketingPanel />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: TEAM & RBAC MANAGEMENT */}
        {/* ======================================================== */}
        {activeTab === 'admin_management' && (
          <div className="animate-fadeIn">
            <AdminManagementPanel />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 10: SECURITY DASHBOARD & AUDIT LOGS */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="animate-fadeIn">
            <AdminSecurityDashboard />
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* ORDER DETAILS & FULFILLMENT MODAL */}
      {/* ======================================================== */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E8DCCF] max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[#E8DCCF] flex items-center justify-between bg-[#FAF7F2]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                  Order #{selectedOrderDetails.orderNumber}
                </h3>
                <span className="text-[11px] text-gray-500">
                  Placed on {new Date(selectedOrderDetails.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1 rounded-full text-gray-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Customer & Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF]">
                <div>
                  <h4 className="font-bold text-[#3B1E22] uppercase tracking-wider text-[11px] mb-1">
                    Patron Information
                  </h4>
                  <p className="font-semibold text-gray-800">{selectedOrderDetails.customerName}</p>
                  <p className="text-gray-600">{selectedOrderDetails.customerEmail}</p>
                  <p className="text-gray-600 font-mono">{selectedOrderDetails.customerPhone}</p>
                </div>

                <div>
                  <h4 className="font-bold text-[#3B1E22] uppercase tracking-wider text-[11px] mb-1">
                    Shipping Address
                  </h4>
                  <p className="text-gray-800">
                    {selectedOrderDetails.shippingAddress.street}
                    {selectedOrderDetails.shippingAddress.landmark && `, ${selectedOrderDetails.shippingAddress.landmark}`}
                  </p>
                  <p className="text-gray-800">
                    {selectedOrderDetails.shippingAddress.city}, {selectedOrderDetails.shippingAddress.state} - {selectedOrderDetails.shippingAddress.pincode}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-[#3B1E22] uppercase tracking-wider text-[11px] mb-2">
                  Items Ordered
                </h4>
                <div className="divide-y divide-gray-100 border border-[#E8DCCF] rounded-xl overflow-hidden">
                  {selectedOrderDetails.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {Boolean(item.image && isGenuineImageUrl(item.image)) ? (
                          <img
                            src={item.image}
                            alt=""
                            className="w-12 h-12 object-contain rounded-lg border border-[#E8DCCF] bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg border border-[#E8DCCF] bg-[#FAF7F2] flex items-center justify-center text-[#802336]">
                            <ShoppingBag className="w-5 h-5 opacity-70" />
                          </div>
                        )}
                        <div>
                          <h5 className="font-bold text-gray-900">{item.productName}</h5>
                          <span className="text-[10px] text-[#802336] bg-[#FAF7F2] px-1.5 py-0.2 rounded border border-[#E8DCCF]">
                            {item.variationName}
                          </span>
                          <span className="text-gray-400 block text-[11px] mt-0.5">
                            Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-[#802336]">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Info */}
              <div className={`flex items-center justify-between p-4 border rounded-xl ${
                selectedOrderDetails.paymentStatus === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div>
                  <span className={`text-[10px] font-bold uppercase block ${
                    selectedOrderDetails.paymentStatus === 'paid' ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    Payment Method: {selectedOrderDetails.paymentMethod || 'UPI'} ({selectedOrderDetails.paymentStatus === 'paid' ? 'Paid' : 'Pending Verification'})
                  </span>
                  <span className="font-mono text-xs text-gray-800">
                    UTR: <strong>{selectedOrderDetails.upiReference || 'Pending'}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-gray-500 block">Total Amount</span>
                  <span className="font-serif font-bold text-lg text-[#802336]">
                    ₹{selectedOrderDetails.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Courier & Tracking Fulfillment Form */}
              <div className="p-4 border border-[#E8DCCF] rounded-xl bg-white space-y-3">
                <h4 className="font-bold text-[#3B1E22] uppercase tracking-wider text-[11px]">
                  Fulfillment & Tracking Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Courier Partner
                    </label>
                    <select
                      value={courierInput}
                      onChange={(e) => setCourierInput(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg text-xs"
                    >
                      <option value="BlueDart Express">BlueDart Express</option>
                      <option value="Delhivery Logistics">Delhivery Logistics</option>
                      <option value="DTDC Express">DTDC Express</option>
                      <option value="India Post Speed Post">India Post Speed Post</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      AWB / Tracking Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BD98712345IN"
                      value={trackingNumberInput}
                      onChange={(e) => setTrackingNumberInput(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-700">Status:</label>
                    <select
                      value={selectedOrderDetails.orderStatus}
                      onChange={(e) =>
                        setSelectedOrderDetails({
                          ...selectedOrderDetails,
                          orderStatus: e.target.value as OrderStatus
                        })
                      }
                      className="px-2 py-1 border rounded-lg text-xs font-bold"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveFulfillment}
                    disabled={updatingFulfillment}
                    className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition-colors"
                  >
                    {updatingFulfillment ? 'Saving...' : 'Save Tracking & Status'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E8DCCF] bg-[#FAF7F2] flex items-center justify-between">
              <button
                onClick={() => setPrintOrder(selectedOrderDetails)}
                className="px-4 py-2 border border-[#E8DCCF] rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-white cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Packing Slip</span>
              </button>

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRODUCT ADD / EDIT MODAL */}
      {/* ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-[#E8DCCF] max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[#E8DCCF] flex items-center justify-between bg-[#FAF7F2]">
              <h3 className="font-serif text-xl font-bold text-[#3B1E22]">
                {isCreatingNewProduct ? 'Add New Jewellery Design' : `Edit: ${editingProduct.name}`}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-full text-gray-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Product Save Status Banners */}
              {saveProductSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2.5 animate-fadeIn shadow-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold flex-1">{saveProductSuccess}</span>
                </div>
              )}

              {saveProductError && (
                <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-xl flex items-center gap-2.5 animate-fadeIn shadow-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold flex-1">{saveProductError}</span>
                  <button
                    type="button"
                    onClick={() => setSaveProductError(null)}
                    className="text-red-400 hover:text-red-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Design Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        name: e.target.value,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                      })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                    placeholder="e.g. Royal Padmavati Kundan Choker Set"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Store Category *
                  </label>
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        categoryId: e.target.value,
                        categoryName: cat?.name || e.target.value,
                        subcategory: cat?.subcategories[0] || 'Necklaces'
                      });
                    }}
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Subcategory Style
                  </label>
                  <input
                    type="text"
                    value={editingProduct.subcategory}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, subcategory: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                    placeholder="e.g. Chokers, Bangles, Rings"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold uppercase tracking-wider text-gray-700">
                      Selling Price (INR) *
                    </label>
                    <span className="text-xs font-semibold text-[#802336]">
                      {formatPrice(editingProduct.price)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg font-bold text-sm bg-white"
                    placeholder="e.g. 1499"
                  />
                  <span className="text-[11px] text-gray-500 mt-0.5 block">
                    Actual customer checkout price
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold uppercase tracking-wider text-gray-700">
                      Original MRP (INR) *
                    </label>
                    <span className="text-xs font-semibold text-gray-600">
                      {formatPrice(editingProduct.mrp)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.mrp}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, mrp: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg text-sm bg-white"
                    placeholder="e.g. 2499"
                  />
                  <span className="text-[11px] text-gray-500 mt-0.5 block">
                    Maximum Retail Price before discount
                  </span>
                </div>
              </div>

              {/* Price Calculation & Validation Indicator */}
              <div className="p-3 rounded-xl border bg-gray-50/80 transition-all text-xs">
                {editingProduct.price < 0 || editingProduct.mrp < 0 ? (
                  <div className="text-red-600 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Prices must be non-negative (₹0 or greater).</span>
                  </div>
                ) : editingProduct.price > editingProduct.mrp ? (
                  <div className="text-red-600 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Selling price ({formatPrice(editingProduct.price)}) cannot exceed Original MRP ({formatPrice(editingProduct.mrp)}).
                    </span>
                  </div>
                ) : editingProduct.mrp > editingProduct.price ? (
                  <div className="flex items-center justify-between flex-wrap gap-2 text-emerald-800">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        Automatic Discount: <strong>{calculateDiscountPercent(editingProduct.mrp, editingProduct.price)}% OFF</strong> (Customer saves {formatPrice(editingProduct.mrp - editingProduct.price)})
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-[#802336]">{formatPrice(editingProduct.price)}</span>
                      <span className="line-through text-gray-400">{formatPrice(editingProduct.mrp)}</span>
                      <span className="bg-[#D4AF37] text-[#3B1E22] text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {calculateDiscountPercent(editingProduct.mrp, editingProduct.price)}% OFF
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>
                      MRP and Selling Price are equal ({formatPrice(editingProduct.price)}). No discount badge or strikethrough will be displayed.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: Number(e.target.value),
                        inStock: Number(e.target.value) > 0
                      })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Material Composition *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.material}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, material: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                    placeholder="e.g. 24K Micro Gold Plating, 92.5 Hallmarked Silver"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Product Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Jewellery Care Instructions
                </label>
                <input
                  type="text"
                  value={editingProduct.careInstructions || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, careInstructions: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                />
              </div>

              {/* Product Status & Merchandising Badges */}
              <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] space-y-3">
                <label className="block font-bold uppercase tracking-wider text-gray-700 text-xs">
                  Store Visibility & Merchandising Badges
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={editingProduct.active !== false}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, active: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#0F5B46] focus:ring-[#0F5B46] cursor-pointer"
                    />
                    <span>Active in Store</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.isFeatured)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#802336] focus:ring-[#802336] cursor-pointer"
                    />
                    <span>Featured Piece</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.isBestseller)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, isBestseller: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#802336] focus:ring-[#802336] cursor-pointer"
                    />
                    <span>Best Seller</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.isNewArrival)}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, isNewArrival: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#802336] focus:ring-[#802336] cursor-pointer"
                    />
                    <span>New Arrival</span>
                  </label>
                </div>
              </div>

              {/* Product Images Manager - ONLY "Upload Image" & "Add Image" */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-gray-700 text-xs">
                      Product Images
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Upload jewellery photos from mobile gallery or computer (JPG, JPEG, PNG, WebP)
                    </p>
                  </div>
                  {editingProduct.images && editingProduct.images.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#0F5B46] bg-[#0F5B46]/10 px-2.5 py-0.5 rounded-full">
                      {editingProduct.images.length} {editingProduct.images.length === 1 ? 'Image' : 'Images'} attached
                    </span>
                  )}
                </div>

                {/* Hidden Native File & Gallery Picker */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                {/* Action Buttons: ONLY "Upload Image" and "Add Image" */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Button 1: Upload Image (Opens gallery/file picker) */}
                  <button
                    type="button"
                    onClick={() => {
                      setImageUploadStatus(null);
                      fileInputRef.current?.click();
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white hover:bg-[#FAF7F2] text-[#241C1A] border-2 border-[#E8DCCF] hover:border-[#0F5B46] px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-[#0F5B46]" />
                    <span>Upload Image</span>
                  </button>

                  {/* Button 2: Add Image (Uploads selected photo to product) */}
                  <button
                    type="button"
                    onClick={handleAddImageToProduct}
                    disabled={uploadingImage || !selectedFileForUpload}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95 ${
                      uploadingImage || !selectedFileForUpload
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : 'btn-teak-green text-white shadow-[#0F5B46]/20'
                    }`}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Uploading Image...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-white" />
                        <span>Add Image</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Direct Image URL input for quick web image attachment */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or enter direct image URL (https://...)"
                    className="flex-1 px-3 py-2 border border-[#E8DCCF] rounded-xl text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingProduct || !imageUrlInput.trim()) return;
                      const url = imageUrlInput.trim();
                      const updatedImages = [...(editingProduct.images || []), url];
                      const updatedVariations = (editingProduct.variations || []).map((v, idx) => {
                        if (idx === 0 && (!v.image || v.image === '')) {
                          return { ...v, image: url };
                        }
                        return v;
                      });
                      setEditingProduct({
                        ...editingProduct,
                        images: updatedImages,
                        variations: updatedVariations
                      });
                      setImageUrlInput('');
                      setImageUploadStatus({
                        type: 'success',
                        message: '✓ Image URL attached to product gallery!'
                      });
                    }}
                    disabled={!imageUrlInput.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                      !imageUrlInput.trim()
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-[#FAF7F2] text-[#3B1E22] border-[#E8DCCF]'
                    }`}
                  >
                    Attach URL
                  </button>
                </div>

                {/* Selected Image Preview (Before Adding) */}
                {selectedFileForUpload && (
                  <div className="bg-[#FAF7F2] border-2 border-dashed border-[#0F5B46]/40 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-16 h-16 rounded-lg bg-white border border-[#E8DCCF] overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-sm">
                        <img
                          src={selectedFileForUpload.previewUrl}
                          alt="Selected preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#0F5B46] text-white">
                            Selected
                          </span>
                          <span className="text-xs font-semibold text-[#241C1A] truncate max-w-[180px] sm:max-w-[240px]">
                            {selectedFileForUpload.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Size: {(selectedFileForUpload.size / 1024).toFixed(1)} KB • Ready to add. Click "Add Image" above to save.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-[11px] font-semibold text-[#0F5B46] hover:bg-white rounded-lg border border-[#0F5B46]/30 transition-colors cursor-pointer"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSelectedFile}
                        className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Message (Success / Error feedback) */}
                {imageUploadStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn ${
                      imageUploadStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {imageUploadStatus.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span className="flex-1 font-medium">{imageUploadStatus.message}</span>
                    <button
                      type="button"
                      onClick={() => setImageUploadStatus(null)}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Attached Product Images Gallery */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span className="font-semibold text-gray-700">Current Product Gallery</span>
                    <span className="text-[11px] text-gray-400">First photo is used as main thumbnail</span>
                  </div>

                  {editingProduct.images && editingProduct.images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {editingProduct.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative group aspect-square rounded-xl overflow-hidden border-2 border-[#E8DCCF] bg-white p-1.5 shadow-sm hover:border-[#0F5B46] transition-all flex items-center justify-center"
                        >
                          <img
                            src={img}
                            alt={`Product photo ${idx + 1}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />

                          {/* Primary Badge */}
                          {idx === 0 ? (
                            <span className="absolute top-1.5 left-1.5 bg-[#0F5B46] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                              Primary
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)}
                              className="absolute top-1.5 left-1.5 bg-black/70 hover:bg-[#0F5B46] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Set as primary thumbnail"
                            >
                              Set Main
                            </button>
                          )}

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveImageFromProduct(idx)}
                            className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                            title="Remove image from product"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            #{idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-[#E8DCCF] rounded-xl p-6 text-center bg-[#FAF7F2]/60">
                      <div className="w-10 h-10 rounded-full bg-[#E8DCCF]/50 flex items-center justify-center text-gray-500 mx-auto mb-2">
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">No images added to this product yet</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Click <strong className="text-[#0F5B46]">Upload Image</strong> to pick a photo, then click <strong className="text-[#0F5B46]">Add Image</strong> to save it.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Video Showcase (Direct Drag & Drop) */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between text-xs">
                  <span>Product Video Demonstration (360° or Reel)</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase">MP4, MOV, WebM</span>
                </label>
                <VideoDropzoneUploader
                  currentVideoUrl={editingProduct.videoUrl}
                  onVideoUploaded={(res) => {
                    setEditingProduct({ ...editingProduct, videoUrl: res.url });
                  }}
                  onClearVideo={() => {
                    setEditingProduct({ ...editingProduct, videoUrl: undefined });
                  }}
                />
                <p className="text-[11px] text-gray-500">
                  When you upload a video for this piece, it will automatically appear in the 360° Reel showcase on the homepage and product page.
                </p>
              </div>

              {/* Variations Manager */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold uppercase tracking-wider text-gray-700">
                    Product Variations (Finish, Color & Stock)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddVariation}
                    className="bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#802336] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-[#E8DCCF] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Variation</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {editingProduct.variations.map((v, idx) => (
                    <div key={v.id || idx} className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-gray-500 block">Finish Name</label>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => handleUpdateVariation(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-[#E8DCCF] rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 block">Color & Hex</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={v.hexCode}
                            onChange={(e) => handleUpdateVariation(idx, 'hexCode', e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="text"
                            value={v.colorFinish}
                            onChange={(e) => handleUpdateVariation(idx, 'colorFinish', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white border border-[#E8DCCF] rounded text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 block">SKU</label>
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => handleUpdateVariation(idx, 'sku', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-[#E8DCCF] rounded text-xs font-mono text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 block">Stock</label>
                        <input
                          type="number"
                          value={v.stock}
                          onChange={(e) => handleUpdateVariation(idx, 'stock', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#E8DCCF] rounded text-xs font-bold"
                        />
                      </div>

                      <div className="text-right pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariation(idx)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                          title="Remove variation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="bg-[#3B1E22] hover:bg-[#802336] disabled:bg-gray-400 text-[#FAF7F2] px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-md transition-colors flex items-center gap-2"
                >
                  {savingProduct && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>
                    {savingProduct
                      ? 'Saving to Database...'
                      : isCreatingNewProduct
                      ? 'Save New Product'
                      : 'Save Changes'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-red-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-600 border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                  Delete Jewellery Design
                </h3>
                <p className="text-xs text-gray-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E8DCCF] flex items-center gap-3">
              {productToDelete.images?.[0] ? (
                <img
                  src={productToDelete.images[0]}
                  alt={productToDelete.name}
                  className="w-12 h-12 object-cover rounded-xl border border-[#E8DCCF]"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400">
                  <Package className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-[#3B1E22] truncate">
                  {productToDelete.name}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatPrice(productToDelete.price)} • {productToDelete.categoryName}
                </p>
              </div>
            </div>

            {deleteProductError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span className="font-medium">{deleteProductError}</span>
              </div>
            )}

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to permanently remove <span className="font-semibold text-gray-900">"{productToDelete.name}"</span> from the catalog? It will be deleted from the database and will no longer appear in the store.
            </p>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isDeletingProduct ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Product</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY ADD / EDIT MODAL */}
      {/* ======================================================== */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E8DCCF] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E8DCCF] pb-3">
              <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                {isCreatingNewCategory ? 'Create New Store Category' : `Edit Category: ${editingCategory.name}`}
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-gray-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    })
                  }
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                  placeholder="e.g. Temple Kundan Heirlooms"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Banner / Thumbnail Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={editingCategory.image}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, image: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Subcategories (Style filters)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Chokers, Bangles, Jhumkas"
                    value={subcatInput}
                    onChange={(e) => setSubcatInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-[#E8DCCF] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcatToCategory}
                    className="bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#3B1E22] px-3 py-1.5 rounded-lg font-bold border border-[#E8DCCF] cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {editingCategory.subcategories.map((sc) => (
                    <span
                      key={sc}
                      className="bg-[#FAF7F2] text-[#802336] text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[#E8DCCF] flex items-center gap-1"
                    >
                      <span>{sc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcat(sc)}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8DCCF] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#3B1E22] hover:bg-[#802336] text-[#FAF7F2] px-5 py-2 rounded-xl font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRINTABLE PACKING SLIP MODAL */}
      {/* ======================================================== */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-8 space-y-6 text-xs text-gray-800 border border-gray-300">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
                  VIDHYAA Jewellery Studio
                </h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                  Official Atelier Packing Slip • Roorkee, District Haridwar, Uttarakhand
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  Vidhya Villa, 152/9, Solani Puram West, Near IIT Roorkee - 247667
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-[#802336]">
                  #{printOrder.orderNumber}
                </span>
                <span className="text-[10px] text-gray-400 block">
                  {new Date(printOrder.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Ship To:</span>
                <p className="font-bold">{printOrder.customerName}</p>
                <p>{printOrder.shippingAddress.street}</p>
                <p>{printOrder.shippingAddress.city}, {printOrder.shippingAddress.state} - {printOrder.shippingAddress.pincode}</p>
                <p className="font-mono mt-1">{printOrder.customerPhone}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Logistics:</span>
                <p className="font-semibold text-emerald-800">{printOrder.courierName || 'BlueDart Express'}</p>
                <p className="font-mono">AWB: {printOrder.trackingNumber || 'Pending Generation'}</p>
                <p className="mt-1">Payment: <strong>UPI Paid (UTR: {printOrder.upiReference || 'Verified'})</strong></p>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2">Finish</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {printOrder.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-medium">{it.productName}</td>
                    <td className="p-2 text-gray-600">{it.variationName}</td>
                    <td className="p-2 text-center font-bold">{it.quantity}</td>
                    <td className="p-2 text-right">₹{(it.price * it.quantity).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t pt-3 flex justify-between font-bold text-sm">
              <span>Total Paid Amount:</span>
              <span className="text-[#802336]">₹{printOrder.totalAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={() => window.print()}
                className="bg-[#3B1E22] text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice / Slip</span>
              </button>
              <button
                onClick={() => setPrintOrder(null)}
                className="px-5 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Inactivity Warning Modal */}
      {inactivityWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1215] border border-[#DFB982]/50 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-white">
                Session Inactivity Timeout
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                To protect customer records and payment transactions, this administrator workstation will auto-lock in:
              </p>
              <div className="mt-3 font-mono text-3xl font-extrabold text-[#DFB982]">
                {countdownSeconds}s
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleAdminLogout('SESSION_INACTIVITY_AUTOLOCK')}
                className="flex-1 py-3 border border-red-800 text-red-300 hover:bg-red-950/60 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Lock Session Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setInactivityWarning(false);
                  setCountdownSeconds(60);
                }}
                className="flex-1 bg-[#0F4C4A] hover:bg-[#0A3635] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md"
              >
                Keep Active
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Action Authorization Modal */}
      <AdminSensitiveActionModal
        isOpen={sensitiveModal.isOpen}
        title={sensitiveModal.title}
        description={sensitiveModal.description}
        actionLabel={sensitiveModal.actionLabel}
        isDestructive={sensitiveModal.isDestructive}
        onConfirm={sensitiveModal.onConfirm}
        onCancel={() => setSensitiveModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
