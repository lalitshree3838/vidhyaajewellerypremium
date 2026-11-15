import React, { useState, useRef, useEffect } from 'react';
import {
  Category,
  Product,
  CategoryImage,
  CategoryVideo,
  CategoryPromoBanner,
  CategoryCustomSection,
  CategorySectionKey
} from '../../types';
import {
  saveCategory,
  deleteCategory,
  duplicateCategory,
  saveProduct
} from '../../lib/dbService';
import { VideoDropzoneUploader } from './VideoDropzoneUploader';
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Layout,
  Type,
  Globe,
  Tag,
  Star,
  Play,
  X,
  Edit2,
  Check,
  ChevronRight,
  GripVertical,
  CheckSquare,
  Square,
  Send,
  SlidersHorizontal,
  RefreshCw,
  FolderPlus,
  Layers,
  ShoppingBag,
  TrendingUp,
  Award,
  Flame,
  MessageCircle,
  Maximize2,
  Loader2
} from 'lucide-react';

interface CategoryCMSPanelProps {
  categories: Category[];
  products: Product[];
  onCategoriesUpdated: (updatedCategories: Category[]) => void;
  onPreviewCategory: (category: Category) => void;
}

export type CMSTab = 'page' | 'images' | 'videos' | 'content' | 'seo' | 'publish';

export const CategoryCMSPanel: React.FC<CategoryCMSPanelProps> = ({
  categories,
  products,
  onCategoriesUpdated,
  onPreviewCategory
}) => {
  // Local categories state for instantaneous UI responsiveness
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Selected Category
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<CMSTab>('page');

  // Search, Filters & Sorting for Category Selector
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [sortOption, setSortOption] = useState<'order' | 'name' | 'products'>('order');

  // Working copy of current category for safe editing
  const selectedCategory = localCategories.find((c) => c.id === selectedCategoryId) || localCategories[0];
  const [categoryForm, setCategoryForm] = useState<Category | null>(selectedCategory || null);

  // Sync working copy when selection changes or categories update
  useEffect(() => {
    if (selectedCategory) {
      setCategoryForm(JSON.parse(JSON.stringify(selectedCategory)));
    }
  }, [selectedCategoryId, localCategories]);

  // Notifications
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categorySuccessMessage, setCategorySuccessMessage] = useState<string | null>(null);

  // Add Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatSubtitle, setNewCatSubtitle] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [newCatSubcategories, setNewCatSubcategories] = useState<string[]>(['All', 'Featured']);
  const [newCatSubcatInput, setNewCatSubcatInput] = useState('');
  const [newCatActive, setNewCatActive] = useState(true);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Delete Category Confirmation Modal State
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);

  // Subcategory input state
  const [newSubcategory, setNewSubcategory] = useState('');

  // Image Upload, Drag-and-Drop & Edit State
  const [isDraggingOverImages, setIsDraggingOverImages] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');
  const [bulkUrlsInput, setBulkUrlsInput] = useState('');
  const [showBulkUrlModal, setShowBulkUrlModal] = useState(false);
  const [editingImage, setEditingImage] = useState<CategoryImage | null>(null);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  // Section Drag-and-drop state
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);

  // Video Form State
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CategoryVideo | null>(null);
  const [videoCategoryId, setVideoCategoryId] = useState('');
  const [videoLinkedProductId, setVideoLinkedProductId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoSeoTags, setVideoSeoTags] = useState('');
  const [videoIsFeatured, setVideoIsFeatured] = useState(false);
  const [videoValidationError, setVideoValidationError] = useState<string | null>(null);
  const [videoIsSaving, setVideoIsSaving] = useState(false);
  const [videoPreviewPlayer, setVideoPreviewPlayer] = useState<CategoryVideo | null>(null);
  const [draggedVideoIndex, setDraggedVideoIndex] = useState<number | null>(null);

  // Promotional Banner Form State
  const [promoBannerModalOpen, setPromoBannerModalOpen] = useState(false);
  const [editingPromoBanner, setEditingPromoBanner] = useState<CategoryPromoBanner | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoSubtitle, setPromoSubtitle] = useState('');
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoLinkText, setPromoLinkText] = useState('');
  const [promoLinkUrl, setPromoLinkUrl] = useState('');

  // Custom Text Section Form State
  const [customSectionModalOpen, setCustomSectionModalOpen] = useState(false);
  const [editingCustomSection, setEditingCustomSection] = useState<CategoryCustomSection | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionSubtitle, setSectionSubtitle] = useState('');
  const [sectionContent, setSectionContent] = useState('');
  const [sectionImageUrl, setSectionImageUrl] = useState('');
  const [sectionBtnText, setSectionBtnText] = useState('');
  const [sectionBtnLink, setSectionBtnLink] = useState('');

  // Client-side image compression helper via HTML5 Canvas
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Filtered and sorted categories in sidebar
  const filteredCategories = localCategories
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase());
      if (statusFilter === 'published') return matchesSearch && c.active;
      if (statusFilter === 'draft') return matchesSearch && !c.active;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'name') return a.name.localeCompare(b.name);
      if (sortOption === 'products') {
        const countA = products.filter((p) => p.categoryId === a.id).length;
        const countB = products.filter((p) => p.categoryId === b.id).length;
        return countB - countA;
      }
      return (a.order || 0) - (b.order || 0);
    });

  // Save current category
  const handleSaveCategory = async () => {
    if (!categoryForm) return;
    setIsSaving(true);
    try {
      await saveCategory(categoryForm);
      const updatedList = localCategories.map((c) => (c.id === categoryForm.id ? categoryForm : c));
      setLocalCategories(updatedList);
      onCategoriesUpdated(updatedList);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Open the Add Category creation form/modal
  const handleOpenAddCategoryModal = () => {
    setNewCatName('');
    setNewCatSlug('');
    setNewCatSubtitle('Luxury Handcrafted Heirlooms & Contemporary Elegance');
    setNewCatDescription('');
    setNewCatImage('');
    setNewCatSubcategories(['All Styles', 'Featured', 'Royal Timepieces']);
    setNewCatSubcatInput('');
    setNewCatActive(true);
    setAddCategoryError(null);
    setIsAddCategoryModalOpen(true);
  };

  // Auto-generate slug while typing category name
  const handleCategoryNameChange = (val: string) => {
    setNewCatName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setNewCatSlug(autoSlug);
  };

  const handleAddSubcatToNewCategory = () => {
    const trimmed = newCatSubcatInput.trim();
    if (!trimmed) return;
    if (newCatSubcategories.includes(trimmed)) return;
    setNewCatSubcategories([...newCatSubcategories, trimmed]);
    setNewCatSubcatInput('');
  };

  const handleRemoveSubcatFromNewCategory = (sub: string) => {
    setNewCatSubcategories(newCatSubcategories.filter((s) => s !== sub));
  };

  // Submit new category form
  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCategoryError(null);

    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      setAddCategoryError('Category Name cannot be empty.');
      return;
    }

    const cleanSlug = (newCatSlug.trim() || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      setAddCategoryError('Category Slug cannot be empty.');
      return;
    }

    // Check duplicate category name (case-insensitive)
    const duplicateName = localCategories.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      setAddCategoryError(`A category named "${trimmedName}" already exists.`);
      return;
    }

    // Check duplicate slug (case-insensitive)
    const duplicateSlug = localCategories.some(
      (c) => c.slug.trim().toLowerCase() === cleanSlug.toLowerCase() || c.id.toLowerCase() === cleanSlug.toLowerCase()
    );
    if (duplicateSlug) {
      setAddCategoryError(`A category with slug "${cleanSlug}" already exists.`);
      return;
    }

    setIsCreatingCategory(true);
    try {
      const newCategory: Category = {
        id: cleanSlug,
        name: trimmedName,
        slug: cleanSlug,
        subtitle: newCatSubtitle.trim() || 'Exclusive Artisan Heirlooms & Contemporary Elegance',
        description:
          newCatDescription.trim() ||
          `${trimmedName} collection celebrating timeless Indian heritage and luxury artisanal jewellery.`,
        image: newCatImage.trim() || '',
        heroBannerUrl: newCatImage.trim() || '',
        subcategories: newCatSubcategories.length > 0 ? newCatSubcategories : ['All Styles', 'Featured'],
        active: newCatActive,
        order: localCategories.length + 1,
        sectionsOrder: ['banner', 'description', 'gallery', 'videos', 'featured_products', 'products', 'custom_story', 'cta'],
        hiddenSections: [],
        galleryImages: [],
        videos: [],
        promoBanners: [],
        featuredProductIds: []
      };

      await saveCategory(newCategory);

      const updated = [...localCategories, newCategory];
      setLocalCategories(updated);
      setSelectedCategoryId(newCategory.id);
      setCategoryForm(newCategory);

      // Notify parent & refresh
      onCategoriesUpdated(updated);

      setCategorySuccessMessage(`Category "${trimmedName}" created successfully!`);
      setTimeout(() => setCategorySuccessMessage(null), 4000);
      setIsAddCategoryModalOpen(false);
    } catch (err: any) {
      console.error('Error creating category:', err);
      setAddCategoryError(err?.message || 'Failed to create category. Please check your connection.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Duplicate category
  const handleDuplicateCategory = async (id: string) => {
    const clone = await duplicateCategory(id);
    if (clone) {
      const updated = [...localCategories, clone];
      setLocalCategories(updated);
      onCategoriesUpdated(updated);
      setSelectedCategoryId(clone.id);
      setCategorySuccessMessage(`Category duplicate "${clone.name}" created!`);
      setTimeout(() => setCategorySuccessMessage(null), 3000);
    }
  };

  // Delete category request - opens in-app confirmation modal
  const handleRequestDeleteCategory = (cat: Category) => {
    setDeleteCategoryError(null);
    setCategoryToDelete(cat);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    if (localCategories.length <= 1) {
      setDeleteCategoryError('The store requires at least one active category.');
      return;
    }
    setIsDeletingCategory(true);
    try {
      const targetId = categoryToDelete.id;
      const targetName = categoryToDelete.name;
      await deleteCategory(targetId);

      const remaining = localCategories.filter((c) => c.id !== targetId);
      setLocalCategories(remaining);
      onCategoriesUpdated(remaining);
      setSelectedCategoryId(remaining[0]?.id || '');
      setCategoryToDelete(null);

      setCategorySuccessMessage(`Category "${targetName}" was successfully removed.`);
      setTimeout(() => setCategorySuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setDeleteCategoryError(err?.message || 'Failed to delete category.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // Section Ordering & Visibility
  const allSections: { key: CategorySectionKey; label: string; desc: string }[] = [
    { key: 'banner', label: '1. Hero Banner', desc: 'Full-width cinematic banner with title, subtitle & action buttons' },
    { key: 'description', label: '2. Editorial & Story', desc: 'Craftsmanship overview with subcategory filter pills & trust badges' },
    { key: 'gallery', label: '3. Image Gallery', desc: 'High-resolution photo showcase with interactive lightbox' },
    { key: 'videos', label: '4. Video Showcase', desc: 'Responsive video demonstrations with playback controls' },
    { key: 'featured_products', label: '5. Featured Designs', desc: 'Pinned highlights & bestsellers in this category' },
    { key: 'products', label: '6. Full Products Catalog', desc: 'Complete product grid with search, sort, and filters' },
    { key: 'custom_story', label: '7. Atelier Heritage Story', desc: 'Rich custom narrative on artisanal craftsmanship' },
    { key: 'cta', label: '8. Call to Action Banner', desc: 'Bottom promotional banner with WhatsApp & bespoke contact' }
  ];

  const currentSectionOrder: CategorySectionKey[] =
    categoryForm?.sectionsOrder && categoryForm.sectionsOrder.length > 0
      ? categoryForm.sectionsOrder
      : allSections.map((s) => s.key);

  const hiddenSections = new Set(categoryForm?.hiddenSections || []);

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!categoryForm) return;
    const newOrder = [...currentSectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setCategoryForm({ ...categoryForm, sectionsOrder: newOrder });
  };

  // HTML5 Drag-and-Drop for Sections
  const handleSectionDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSectionIndex === null || !categoryForm) return;
    const newOrder = [...currentSectionOrder];
    const draggedItem = newOrder[draggedSectionIndex];
    newOrder.splice(draggedSectionIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    setCategoryForm({ ...categoryForm, sectionsOrder: newOrder });
    setDraggedSectionIndex(null);
  };

  const toggleSectionVisibility = (key: CategorySectionKey) => {
    if (!categoryForm) return;
    const currentHidden = new Set(categoryForm.hiddenSections || []);
    if (currentHidden.has(key)) {
      currentHidden.delete(key);
    } else {
      currentHidden.add(key);
    }
    setCategoryForm({ ...categoryForm, hiddenSections: Array.from(currentHidden) });
  };

  // Image Upload handler (File input & Dropzone)
  const processImageFiles = async (files: File[]) => {
    if (!categoryForm) return;
    const newImages: CategoryImage[] = [...(categoryForm.galleryImages || [])];

    for (let i = 0; i < files.length; i++) {
      try {
        const dataUrl = await compressImageFile(files[i]);
        const imgObj: CategoryImage = {
          id: `img_${Date.now()}_${i}`,
          url: dataUrl,
          title: files[i].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          caption: `${categoryForm.name} Handcrafted Detail`,
          altText: `${categoryForm.name} fine jewellery image`,
          isCover: newImages.length === 0,
          order: newImages.length + 1
        };
        newImages.push(imgObj);
      } catch (err) {
        console.warn('Could not compress image file', err);
      }
    }

    setCategoryForm({ ...categoryForm, galleryImages: newImages });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImageFiles(Array.from(e.target.files));
    }
  };

  // Drag & drop files onto the images dropzone
  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverImages(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Replace single image
  const handleReplaceImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !replacingImageId || !categoryForm) return;
    try {
      const dataUrl = await compressImageFile(e.target.files[0]);
      const updated = (categoryForm.galleryImages || []).map((img) =>
        img.id === replacingImageId ? { ...img, url: dataUrl } : img
      );
      setCategoryForm({ ...categoryForm, galleryImages: updated });
    } catch (err) {
      console.warn('Replace image failed', err);
    } finally {
      setReplacingImageId(null);
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim() || !categoryForm) return;
    const current = categoryForm.galleryImages || [];
    const newImg: CategoryImage = {
      id: `img_${Date.now()}`,
      url: newImageUrl.trim(),
      title: newImageTitle.trim() || `${categoryForm.name} Piece`,
      caption: newImageCaption.trim() || '',
      altText: newImageTitle.trim() || categoryForm.name,
      isCover: current.length === 0,
      order: current.length + 1
    };

    setCategoryForm({ ...categoryForm, galleryImages: [...current, newImg] });
    setNewImageUrl('');
    setNewImageTitle('');
    setNewImageCaption('');
  };

  const handleAddBulkUrls = () => {
    if (!bulkUrlsInput.trim() || !categoryForm) return;
    const lines = bulkUrlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));
    const current = categoryForm.galleryImages || [];
    const newImgs: CategoryImage[] = lines.map((url, idx) => ({
      id: `img_${Date.now()}_${idx}`,
      url,
      title: `${categoryForm.name} Frame ${current.length + idx + 1}`,
      caption: `Handcrafted ${categoryForm.name}`,
      altText: `${categoryForm.name} jewellery showcase`,
      isCover: current.length === 0 && idx === 0,
      order: current.length + idx + 1
    }));

    setCategoryForm({ ...categoryForm, galleryImages: [...current, ...newImgs] });
    setBulkUrlsInput('');
    setShowBulkUrlModal(false);
  };

  const setCoverImage = (img: CategoryImage) => {
    if (!categoryForm) return;
    const updatedImages = (categoryForm.galleryImages || []).map((i) => ({
      ...i,
      isCover: i.id === img.id
    }));
    setCategoryForm({
      ...categoryForm,
      image: img.url,
      galleryImages: updatedImages
    });
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    if (!categoryForm || !categoryForm.galleryImages) return;
    const imgs = [...categoryForm.galleryImages];
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= imgs.length) return;

    const temp = imgs[index];
    imgs[index] = imgs[target];
    imgs[target] = temp;

    imgs.forEach((img, i) => (img.order = i + 1));
    setCategoryForm({ ...categoryForm, galleryImages: imgs });
  };

  // HTML5 Drag-and-Drop for Gallery Images
  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedImageIndex === null || !categoryForm || !categoryForm.galleryImages) return;
    const imgs = [...categoryForm.galleryImages];
    const draggedItem = imgs[draggedImageIndex];
    imgs.splice(draggedImageIndex, 1);
    imgs.splice(targetIndex, 0, draggedItem);
    imgs.forEach((img, i) => (img.order = i + 1));
    setCategoryForm({ ...categoryForm, galleryImages: imgs });
    setDraggedImageIndex(null);
  };

  const deleteGalleryImage = (id: string) => {
    if (!categoryForm) return;
    const remaining = (categoryForm.galleryImages || []).filter((i) => i.id !== id);
    setCategoryForm({ ...categoryForm, galleryImages: remaining });
  };

  // Video Management Handlers
  const handleOpenVideoModal = (vid?: CategoryVideo) => {
    setVideoValidationError(null);
    if (vid) {
      setEditingVideo(vid);
      setVideoCategoryId(categoryForm?.id || categories[0]?.id || '');
      setVideoTitle(vid.title);
      setVideoUrl(vid.videoUrl);
      setVideoFileName(vid.title || 'jewellery_video.mp4');
      setVideoDescription(vid.description || '');
      setVideoThumbnailUrl(vid.thumbnailUrl || '');
      setVideoDuration(vid.duration || '');
      setVideoSeoTags(vid.seoTags || '');
      setVideoIsFeatured(!!vid.isFeatured);
      // Check if any product has this videoUrl
      const matchedProd = products.find((p) => p.videoUrl === vid.videoUrl);
      setVideoLinkedProductId(matchedProd ? matchedProd.id : '');
    } else {
      setEditingVideo(null);
      setVideoCategoryId(categoryForm?.id || categories[0]?.id || '');
      setVideoLinkedProductId('');
      setVideoTitle('');
      setVideoUrl('');
      setVideoFileName('');
      setVideoDescription('');
      setVideoThumbnailUrl('');
      setVideoDuration('');
      setVideoSeoTags('');
      setVideoIsFeatured(false);
    }
    setVideoModalOpen(true);
  };

  const handleSaveVideo = async () => {
    setVideoValidationError(null);

    if (!videoTitle.trim()) {
      setVideoValidationError('Please enter a video title.');
      return;
    }
    if (!videoUrl.trim()) {
      setVideoValidationError('Please select or upload a video file before saving.');
      return;
    }

    const targetCatId = videoCategoryId || categoryForm?.id || categories[0]?.id;
    const targetCat = categories.find((c) => c.id === targetCatId) || categoryForm;
    if (!targetCat) {
      setVideoValidationError('Please select a valid jewellery category.');
      return;
    }

    setVideoIsSaving(true);
    try {
      const currentVideos = [...(targetCat.videos || [])];
      let savedVideoObj: CategoryVideo;

      if (editingVideo) {
        const idx = currentVideos.findIndex((v) => v.id === editingVideo.id);
        savedVideoObj = {
          ...editingVideo,
          title: videoTitle.trim(),
          videoUrl: videoUrl.trim(),
          description: videoDescription.trim(),
          thumbnailUrl: videoThumbnailUrl.trim() || targetCat.image || '',
          duration: videoDuration.trim() || '0:15',
          seoTags: videoSeoTags.trim(),
          isFeatured: videoIsFeatured
        };
        if (idx !== -1) {
          currentVideos[idx] = savedVideoObj;
        } else {
          currentVideos.push(savedVideoObj);
        }
      } else {
        savedVideoObj = {
          id: `vid_${Date.now()}`,
          title: videoTitle.trim(),
          videoUrl: videoUrl.trim(),
          description: videoDescription.trim(),
          thumbnailUrl: videoThumbnailUrl.trim() || targetCat.image || '',
          duration: videoDuration.trim() || '0:15',
          seoTags: videoSeoTags.trim(),
          isFeatured: videoIsFeatured || currentVideos.length === 0,
          published: true,
          order: currentVideos.length + 1
        };
        currentVideos.push(savedVideoObj);
      }

      const updatedTargetCat: Category = {
        ...targetCat,
        videos: currentVideos,
        updatedAt: new Date().toISOString()
      };

      // Persist category to database & cache
      await saveCategory(updatedTargetCat);

      // If linked to a product, also update that product's videoUrl
      if (videoLinkedProductId) {
        const prodToUpdate = products.find((p) => p.id === videoLinkedProductId);
        if (prodToUpdate) {
          await saveProduct({
            ...prodToUpdate,
            videoUrl: videoUrl.trim(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Update local state in panel
      if (categoryForm && categoryForm.id === targetCatId) {
        setCategoryForm(updatedTargetCat);
      }
      const updatedCategoriesList = categories.map((c) =>
        c.id === targetCatId ? updatedTargetCat : c
      );
      onCategoriesUpdated(updatedCategoriesList);

      setVideoModalOpen(false);
    } catch (err: any) {
      console.error('Error saving video to category:', err);
      setVideoValidationError(err.message || 'Failed to save video to database.');
    } finally {
      setVideoIsSaving(false);
    }
  };

  const toggleVideoPublish = (id: string) => {
    if (!categoryForm) return;
    const current = (categoryForm.videos || []).map((v) =>
      v.id === id ? { ...v, published: !v.published } : v
    );
    setCategoryForm({ ...categoryForm, videos: current });
  };

  const moveVideo = (index: number, direction: 'up' | 'down') => {
    if (!categoryForm || !categoryForm.videos) return;
    const vids = [...categoryForm.videos];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= vids.length) return;

    const temp = vids[index];
    vids[index] = vids[target];
    vids[target] = temp;

    vids.forEach((v, i) => (v.order = i + 1));
    setCategoryForm({ ...categoryForm, videos: vids });
  };

  const deleteVideo = (id: string) => {
    if (!categoryForm) return;
    const remaining = (categoryForm.videos || []).filter((v) => v.id !== id);
    setCategoryForm({ ...categoryForm, videos: remaining });
  };

  // Promo Banner Handlers
  const handleOpenPromoBannerModal = (banner?: CategoryPromoBanner) => {
    if (banner) {
      setEditingPromoBanner(banner);
      setPromoTitle(banner.title);
      setPromoSubtitle(banner.subtitle || '');
      setPromoImageUrl(banner.imageUrl);
      setPromoLinkText(banner.linkText || '');
      setPromoLinkUrl(banner.linkUrl || '');
    } else {
      setEditingPromoBanner(null);
      setPromoTitle('');
      setPromoSubtitle('');
      setPromoImageUrl('');
      setPromoLinkText('Shop Festive Edit');
      setPromoLinkUrl('#products');
    }
    setPromoBannerModalOpen(true);
  };

  const handleSavePromoBanner = () => {
    if (!promoTitle.trim() || !categoryForm) return;
    const current = [...(categoryForm.promoBanners || [])];

    if (editingPromoBanner) {
      const idx = current.findIndex((b) => b.id === editingPromoBanner.id);
      if (idx !== -1) {
        current[idx] = {
          ...editingPromoBanner,
          title: promoTitle.trim(),
          subtitle: promoSubtitle.trim(),
          imageUrl: promoImageUrl.trim() || categoryForm.image,
          linkText: promoLinkText.trim(),
          linkUrl: promoLinkUrl.trim()
        };
      }
    } else {
      const newBanner: CategoryPromoBanner = {
        id: `promo_${Date.now()}`,
        title: promoTitle.trim(),
        subtitle: promoSubtitle.trim(),
        imageUrl: promoImageUrl.trim() || categoryForm.image,
        linkText: promoLinkText.trim() || 'Shop Now',
        linkUrl: promoLinkUrl.trim() || '#products',
        active: true,
        order: current.length + 1
      };
      current.push(newBanner);
    }

    setCategoryForm({ ...categoryForm, promoBanners: current });
    setPromoBannerModalOpen(false);
  };

  const deletePromoBanner = (id: string) => {
    if (!categoryForm) return;
    const remaining = (categoryForm.promoBanners || []).filter((b) => b.id !== id);
    setCategoryForm({ ...categoryForm, promoBanners: remaining });
  };

  // Custom Text Section Handlers
  const handleOpenCustomSectionModal = (sec?: CategoryCustomSection) => {
    if (sec) {
      setEditingCustomSection(sec);
      setSectionTitle(sec.title);
      setSectionSubtitle(sec.subtitle || '');
      setSectionContent(sec.content);
      setSectionImageUrl(sec.imageUrl || '');
      setSectionBtnText(sec.buttonText || '');
      setSectionBtnLink(sec.buttonLink || '');
    } else {
      setEditingCustomSection(null);
      setSectionTitle('');
      setSectionSubtitle('');
      setSectionContent('');
      setSectionImageUrl('');
      setSectionBtnText('');
      setSectionBtnLink('');
    }
    setCustomSectionModalOpen(true);
  };

  const handleSaveCustomSection = () => {
    if (!sectionTitle.trim() || !sectionContent.trim() || !categoryForm) return;
    const current = [...(categoryForm.customSections || [])];

    if (editingCustomSection) {
      const idx = current.findIndex((s) => s.id === editingCustomSection.id);
      if (idx !== -1) {
        current[idx] = {
          ...editingCustomSection,
          title: sectionTitle.trim(),
          subtitle: sectionSubtitle.trim(),
          content: sectionContent.trim(),
          imageUrl: sectionImageUrl.trim(),
          buttonText: sectionBtnText.trim(),
          buttonLink: sectionBtnLink.trim()
        };
      }
    } else {
      const newSec: CategoryCustomSection = {
        id: `csec_${Date.now()}`,
        title: sectionTitle.trim(),
        subtitle: sectionSubtitle.trim(),
        content: sectionContent.trim(),
        imageUrl: sectionImageUrl.trim(),
        buttonText: sectionBtnText.trim(),
        buttonLink: sectionBtnLink.trim(),
        order: current.length + 1,
        active: true
      };
      current.push(newSec);
    }

    setCategoryForm({ ...categoryForm, customSections: current });
    setCustomSectionModalOpen(false);
  };

  const deleteCustomSection = (id: string) => {
    if (!categoryForm) return;
    const remaining = (categoryForm.customSections || []).filter((s) => s.id !== id);
    setCategoryForm({ ...categoryForm, customSections: remaining });
  };

  // Category products for selection
  const categoryProducts = products.filter((p) => p.categoryId === categoryForm?.id);

  if (!categoryForm) {
    return (
      <div className="p-8 text-center text-gray-500">
        No category selected. Please create or choose a category.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hidden file input for image replace */}
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceImageFile}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* TOP CMS DASHBOARD BAR: Search, Filters, Sorting & Quick Global Actions */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8DCCF] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#802336] font-bold tracking-widest uppercase">
              <Sparkles className="w-4 h-4 text-[#B8860B]" />
              <span>Category Content Management System</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#3B1E22]">
              Categories Dashboard
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onPreviewCategory(categoryForm)}
              className="px-4 py-2.5 rounded-xl border border-[#DFB982] bg-[#FAF7F2] hover:bg-white text-[#3B1E22] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#802336]" />
              <span>Live Preview</span>
            </button>

            <button
              onClick={handleOpenAddCategoryModal}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E8DCCF] hover:bg-[#FAF7F2] text-[#3B1E22] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#802336]" />
              <span>Add Category</span>
            </button>

            <button
              onClick={() => handleDuplicateCategory(categoryForm.id)}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E8DCCF] hover:bg-[#FAF7F2] text-[#3B1E22] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-[#802336]" />
              <span>Duplicate</span>
            </button>

            <button
              onClick={handleSaveCategory}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#802336] to-[#5c1322] hover:from-[#68192a] hover:to-[#450e19] text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all ring-1 ring-[#DFB982]/40"
            >
              <Save className="w-4 h-4 text-[#DFB982]" />
              <span>{isSaving ? 'Saving...' : 'Save Category'}</span>
            </button>
          </div>
        </div>

        {/* Categories Bar: Select Category Dropdown & Quick Badges */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 flex items-center gap-2">
            <span className="text-xs font-bold text-[#3B1E22] whitespace-nowrap">Select Category:</span>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs font-bold text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336] cursor-pointer"
            >
              {localCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.active ? 'Published' : 'Draft'})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category list..."
              className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl pl-8 pr-3 py-2 text-xs text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336]"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-2.5 py-2 text-xs text-[#3B1E22] cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="flex-1 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-2.5 py-2 text-xs text-[#3B1E22] cursor-pointer"
            >
              <option value="order">Sort: Order</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="products">Sort: Designs</option>
            </select>
          </div>

          <div className="md:col-span-2 text-right">
            <span className="text-[11px] text-[#802336] font-semibold bg-[#FAF7F2] px-3 py-1.5 rounded-full border border-[#E8DCCF]">
              {filteredCategories.length} Categories
            </span>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>Category changes successfully saved and reflected live on the storefront!</span>
        </div>
      )}

      {categorySuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{categorySuccessMessage}</span>
        </div>
      )}

      {/* MAIN CMS WORKSPACE WITH THE 6 EXACT TABS */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCCF] shadow-xs space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 scrollbar-none text-xs font-bold">
          <button
            onClick={() => setActiveTab('page')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'page'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>Page</span>
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'images'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Images ({categoryForm.galleryImages?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'videos'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Videos ({categoryForm.videos?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'content'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Products/Content</span>
          </button>

          <button
            onClick={() => setActiveTab('seo')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'seo'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>SEO</span>
          </button>

          <button
            onClick={() => setActiveTab('publish')}
            className={`pb-2 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'publish'
                ? 'border-[#802336] text-[#802336]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Publish & Status</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* 1. PAGE TAB                                              */}
        {/* ======================================================== */}
        {activeTab === 'page' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                  Category Page Name *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22] font-semibold focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                  URL Slug (/category/slug) *
                </label>
                <input
                  type="text"
                  value={categoryForm.slug}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                    })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs font-mono text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                Page Subtitle / Tagline
              </label>
              <input
                type="text"
                value={categoryForm.subtitle || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, subtitle: e.target.value })}
                placeholder="e.g. Royal Temple & Heritage 22K Micro Gold Plated Heirlooms"
                className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                Category Description
              </label>
              <textarea
                rows={3}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22] focus:outline-none focus:ring-1 focus:ring-[#802336]"
              />
            </div>

            {/* Subcategories Filter Pills */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#3B1E22]">
                Subcategories / Style Filter Pills
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(categoryForm.subcategories || []).map((sub, idx) => (
                  <span
                    key={sub}
                    className="bg-[#FAF7F2] border border-[#E8DCCF] text-[#3B1E22] text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                  >
                    <span>{sub}</span>
                    <button
                      onClick={() => {
                        const updatedSubs = categoryForm.subcategories.filter((_, i) => i !== idx);
                        setCategoryForm({ ...categoryForm, subcategories: updatedSubs });
                      }}
                      className="text-gray-400 hover:text-red-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 max-w-sm pt-1">
                <input
                  type="text"
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubcategory.trim()) {
                      e.preventDefault();
                      setCategoryForm({
                        ...categoryForm,
                        subcategories: [...(categoryForm.subcategories || []), newSubcategory.trim()]
                      });
                      setNewSubcategory('');
                    }
                  }}
                  placeholder="Add style (e.g. Chokers, Bangles)..."
                  className="flex-1 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl px-3 py-1.5 text-xs text-[#3B1E22]"
                />
                <button
                  onClick={() => {
                    if (newSubcategory.trim()) {
                      setCategoryForm({
                        ...categoryForm,
                        subcategories: [...(categoryForm.subcategories || []), newSubcategory.trim()]
                      });
                      setNewSubcategory('');
                    }
                  }}
                  className="px-3 py-1.5 bg-[#802336] text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* DRAG-AND-DROP SECTION ARRANGEMENT */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                    Drag-and-Drop Category Page Section Arrangement
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Drag items by the grip icon or use the arrows to reorder. Toggle the eye icon to hide or show sections on the live website.
                  </p>
                </div>
                <span className="text-[11px] text-[#DFB982] bg-[#3B1E22] px-2.5 py-0.5 rounded-full font-mono">
                  {currentSectionOrder.length - hiddenSections.size} Active Sections
                </span>
              </div>

              <div className="space-y-2">
                {currentSectionOrder.map((sectionKey, index) => {
                  const sec = allSections.find((s) => s.key === sectionKey) || {
                    key: sectionKey,
                    label: sectionKey,
                    desc: ''
                  };
                  const isHidden = hiddenSections.has(sectionKey);

                  return (
                    <div
                      key={sectionKey}
                      draggable={true}
                      onDragStart={(e) => handleSectionDragStart(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleSectionDrop(e, index)}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors cursor-move ${
                        draggedSectionIndex === index ? 'opacity-50 border-[#802336] border-dashed' : ''
                      } ${
                        isHidden ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-[#FAF7F2] border-[#E8DCCF]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-xs font-bold text-[#241C1A]">{sec.label}</div>
                          <div className="text-[11px] text-gray-500">{sec.desc}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSection(index, 'up')}
                          disabled={index === 0}
                          title="Move Up"
                          className="p-1.5 text-gray-500 hover:text-[#3B1E22] hover:bg-white rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveSection(index, 'down')}
                          disabled={index === currentSectionOrder.length - 1}
                          title="Move Down"
                          className="p-1.5 text-gray-500 hover:text-[#3B1E22] hover:bg-white rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleSectionVisibility(sectionKey)}
                          title={isHidden ? 'Show Section' : 'Hide Section'}
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isHidden
                              ? 'text-gray-400 hover:text-gray-700 bg-gray-200'
                              : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50'
                          }`}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. IMAGES TAB                                            */}
        {/* ======================================================== */}
        {activeTab === 'images' && (
          <div className="space-y-6">
            {/* Drag & Drop File Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOverImages(true);
              }}
              onDragLeave={() => setIsDraggingOverImages(false)}
              onDrop={handleDropzoneDrop}
              className={`p-8 rounded-3xl border-2 border-dashed transition-all text-center space-y-3 ${
                isDraggingOverImages
                  ? 'border-[#802336] bg-[#802336]/5 scale-[1.01]'
                  : 'border-[#DFB982] bg-[#FAF7F2]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-white text-[#802336] mx-auto flex items-center justify-center shadow-xs border border-[#E8DCCF]">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <h4 className="font-serif text-base font-bold text-[#3B1E22]">
                  Drag & Drop Multiple High-Resolution Images Here
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Supports JPG, JPEG, PNG, and WEBP. High-resolution photos are automatically compressed and optimized on the client side without visible loss of sharpness.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-[#802336] hover:bg-[#68192a] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  Browse Device Photos
                </button>
                <button
                  onClick={() => setShowBulkUrlModal(true)}
                  className="px-5 py-2.5 bg-white border border-[#E8DCCF] hover:bg-gray-50 text-[#3B1E22] rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
                >
                  Bulk Import URLs
                </button>
              </div>
            </div>

            {/* Direct Image URL input */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCCF] space-y-2">
              <div className="text-xs font-bold text-[#3B1E22]">Add Single Image URL:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://... image URL"
                  className="bg-white border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={newImageTitle}
                  onChange={(e) => setNewImageTitle(e.target.value)}
                  placeholder="Photo Title / Alt Text"
                  className="bg-white border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newImageCaption}
                    onChange={(e) => setNewImageCaption(e.target.value)}
                    placeholder="Caption / Notes"
                    className="flex-1 bg-white border border-[#E8DCCF] rounded-xl px-3 py-2 text-xs"
                  />
                  <button
                    onClick={handleAddImageUrl}
                    className="px-4 py-2 bg-[#3B1E22] text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Image Gallery Cards with Reordering & Replace */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                    Image Gallery ({categoryForm.galleryImages?.length || 0})
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Drag and drop cards or use arrows to reorder. Click 'Set Cover' to use as the hero image.
                  </p>
                </div>
              </div>

              {(!categoryForm.galleryImages || categoryForm.galleryImages.length === 0) ? (
                <div className="p-10 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-400 text-xs">
                  No images added yet. Drag & drop files above or paste URLs.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryForm.galleryImages.map((img, index) => (
                    <div
                      key={img.id}
                      draggable={true}
                      onDragStart={(e) => handleImageDragStart(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleImageDrop(e, index)}
                      className={`bg-white rounded-2xl border p-3 flex flex-col justify-between space-y-3 shadow-xs transition-all cursor-move ${
                        draggedImageIndex === index ? 'opacity-40 border-[#802336] border-dashed' : ''
                      } ${img.isCover ? 'border-[#DFB982] ring-2 ring-[#DFB982]/40' : 'border-[#E8DCCF]'}`}
                    >
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-[#E8DCCF]">
                        <img
                          src={img.url}
                          alt={img.altText || img.title}
                          className="w-full h-full object-cover"
                        />
                        {img.isCover && (
                          <div className="absolute top-2 left-2 bg-[#DFB982] text-[#3B1E22] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                            Cover Image
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <button
                            onClick={() => setPreviewModalImage(img.url)}
                            title="Preview Image"
                            className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-black"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title, Alt & Caption in-place fields */}
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Title & Alt Text</label>
                          <input
                            type="text"
                            value={img.title || ''}
                            onChange={(e) => {
                              const updated = (categoryForm.galleryImages || []).map((item) =>
                                item.id === img.id ? { ...item, title: e.target.value, altText: e.target.value } : item
                              );
                              setCategoryForm({ ...categoryForm, galleryImages: updated });
                            }}
                            placeholder="Image title / alt text..."
                            className="w-full font-bold text-xs text-[#241C1A] bg-[#FAF7F2] border border-[#E8DCCF] rounded-lg px-2 py-1 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Caption</label>
                          <input
                            type="text"
                            value={img.caption || ''}
                            onChange={(e) => {
                              const updated = (categoryForm.galleryImages || []).map((item) =>
                                item.id === img.id ? { ...item, caption: e.target.value } : item
                              );
                              setCategoryForm({ ...categoryForm, galleryImages: updated });
                            }}
                            placeholder="Add caption..."
                            className="w-full text-[11px] text-gray-600 bg-[#FAF7F2] border border-[#E8DCCF] rounded-lg px-2 py-1 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Controls: Reorder, Replace, Set Cover, Delete */}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveImage(index, 'left')}
                            disabled={index === 0}
                            title="Move Left"
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded cursor-pointer disabled:opacity-20"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveImage(index, 'right')}
                            disabled={index === (categoryForm.galleryImages?.length || 0) - 1}
                            title="Move Right"
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded cursor-pointer disabled:opacity-20"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReplacingImageId(img.id);
                              replaceFileInputRef.current?.click();
                            }}
                            className="text-[10px] font-bold text-gray-600 hover:text-black hover:underline uppercase cursor-pointer"
                          >
                            Replace
                          </button>

                          {!img.isCover && (
                            <button
                              onClick={() => setCoverImage(img)}
                              className="text-[10px] font-bold text-[#802336] hover:underline uppercase cursor-pointer"
                            >
                              Set Cover
                            </button>
                          )}

                          <button
                            onClick={() => deleteGalleryImage(img.id)}
                            className="text-gray-400 hover:text-red-600 cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. VIDEOS TAB                                            */}
        {/* ======================================================== */}
        {activeTab === 'videos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                  Category Videos Management ({categoryForm.videos?.length || 0})
                </h4>
                <p className="text-[11px] text-gray-500">
                  Direct drag-and-drop jewellery video uploader. Upload MP4, MOV, and WebM videos directly to persistent storage.
                </p>
              </div>

              <button
                onClick={() => handleOpenVideoModal()}
                className="px-4 py-2 bg-[#802336] hover:bg-[#68192a] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Video</span>
              </button>
            </div>

            {(!categoryForm.videos || categoryForm.videos.length === 0) ? (
              <div className="p-10 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-400 text-xs space-y-3">
                <Film className="w-8 h-8 text-gray-300 mx-auto" />
                <div className="font-semibold text-gray-600">No videos configured for this category yet.</div>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  Drag and drop MP4, MOV, or WebM jewellery demonstration reels or select files from your device.
                </p>
                <button
                  onClick={() => handleOpenVideoModal()}
                  className="px-4 py-2 bg-[#802336] text-white text-xs font-bold rounded-xl uppercase tracking-wider cursor-pointer hover:bg-[#68192a] inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Jewellery Video</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryForm.videos.map((vid, index) => (
                  <div
                    key={vid.id}
                    className="bg-white p-4 rounded-2xl border border-[#E8DCCF] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                      <div
                        onClick={() => setVideoPreviewPlayer(vid)}
                        className="relative w-28 h-20 bg-black rounded-xl overflow-hidden flex-shrink-0 cursor-pointer group"
                      >
                        {(vid.thumbnailUrl || categoryForm.image) ? (
                          <img
                            src={vid.thumbnailUrl || categoryForm.image}
                            alt={vid.title}
                            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#1A0E11] flex items-center justify-center">
                            <Play className="w-6 h-6 fill-white text-white drop-shadow-md" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-6 h-6 fill-white text-white drop-shadow-md" />
                        </div>
                        {vid.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                            {vid.duration}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-serif text-sm font-bold text-[#241C1A] truncate">
                            {vid.title}
                          </h5>
                          {vid.isFeatured && (
                            <span className="bg-[#DFB982] text-[#3B1E22] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate max-w-md">
                          {vid.description || vid.videoUrl}
                        </p>
                        {vid.seoTags && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                            SEO Tags: {vid.seoTags}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                      <button
                        onClick={() => moveVideo(index, 'up')}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 text-gray-500 hover:text-black rounded cursor-pointer disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveVideo(index, 'down')}
                        disabled={index === (categoryForm.videos?.length || 0) - 1}
                        title="Move Down"
                        className="p-1 text-gray-500 hover:text-black rounded cursor-pointer disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleVideoPublish(vid.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          vid.published
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {vid.published ? 'Published' : 'Hidden'}
                      </button>
                      <button
                        onClick={() => handleOpenVideoModal(vid)}
                        className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteVideo(vid.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. PRODUCTS & CONTENT TAB                                */}
        {/* ======================================================== */}
        {activeTab === 'content' && (
          <div className="space-y-8">
            {/* Hero Banner Upload / URL */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E8DCCF] space-y-3">
              <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                Hero Banner Background
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={categoryForm.heroBannerUrl || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, heroBannerUrl: e.target.value })}
                  placeholder="https://... hero banner image"
                  className="flex-1 bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
                <input
                  type="file"
                  ref={coverFileInputRef}
                  onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      const base64 = await compressImageFile(e.target.files[0]);
                      setCategoryForm({ ...categoryForm, heroBannerUrl: base64 });
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => coverFileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#3B1E22] text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Upload Banner
                </button>
              </div>
            </div>

            {/* Multiple Promotional Banners Manager */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                    Promotional & Festive Banners ({categoryForm.promoBanners?.length || 0})
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Add custom promotional banners with discount offers, images, and CTA links.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenPromoBannerModal()}
                  className="px-4 py-2 bg-[#802336] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Banner</span>
                </button>
              </div>

              {(!categoryForm.promoBanners || categoryForm.promoBanners.length === 0) ? (
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl text-center text-xs text-gray-400">
                  No promotional banners added yet. Add festive offers or seasonal sales.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryForm.promoBanners.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white rounded-2xl border border-[#E8DCCF] p-4 flex gap-4 items-center shadow-xs"
                    >
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt={b.title}
                          className="w-24 h-16 object-cover rounded-xl border border-[#E8DCCF] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-16 bg-[#FAF7F2] rounded-xl border border-[#E8DCCF] flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                          No Image
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#3B1E22] truncate">{b.title}</div>
                        <div className="text-[11px] text-gray-500 truncate">{b.subtitle}</div>
                        <div className="text-[10px] text-[#802336] font-semibold mt-1">
                          Action: {b.linkText || 'Shop Now'} ({b.linkUrl || '#products'})
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleOpenPromoBannerModal(b)}
                          className="p-1 text-gray-600 hover:text-black rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deletePromoBanner(b.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Curated Products Selection (Featured, Bestseller, New Arrival, Trending) */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E8DCCF] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                    Curated Products for {categoryForm.name} ({categoryProducts.length} Designs in Store)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Select which designs are pinned as Featured, Bestsellers, New Arrivals, or Trending on this category page.
                  </p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                {categoryProducts.map((p) => {
                  const isFeatured = (categoryForm.featuredProductIds || []).includes(p.id) || p.isFeatured;
                  const isBestseller = (categoryForm.bestsellerProductIds || []).includes(p.id) || p.isBestseller;
                  const isNewArrival = (categoryForm.newArrivalProductIds || []).includes(p.id) || p.isNewArrival;
                  const isTrending = (categoryForm.trendingProductIds || []).includes(p.id);

                  return (
                    <div
                      key={p.id}
                      className="bg-white p-3 rounded-xl border border-[#E8DCCF] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {Boolean(p.images?.[0] || categoryForm.image) ? (
                          <img
                            src={p.images?.[0] || categoryForm.image}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-lg border border-[#E8DCCF]"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#FAF7F2] rounded-lg border border-[#E8DCCF] flex items-center justify-center text-[#802336] text-[10px] font-bold">
                            VDH
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-[#241C1A] truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-500">
                            ₹{p.price.toLocaleString('en-IN')} • {p.subcategory}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Featured Toggle */}
                        <button
                          onClick={() => {
                            const cur = new Set(categoryForm.featuredProductIds || []);
                            if (cur.has(p.id)) cur.delete(p.id);
                            else cur.add(p.id);
                            setCategoryForm({ ...categoryForm, featuredProductIds: Array.from(cur) });
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                            isFeatured ? 'bg-[#802336] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Featured
                        </button>

                        {/* Bestseller Toggle */}
                        <button
                          onClick={() => {
                            const cur = new Set(categoryForm.bestsellerProductIds || []);
                            if (cur.has(p.id)) cur.delete(p.id);
                            else cur.add(p.id);
                            setCategoryForm({ ...categoryForm, bestsellerProductIds: Array.from(cur) });
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                            isBestseller ? 'bg-[#DFB982] text-[#3B1E22]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Bestseller
                        </button>

                        {/* Trending Toggle */}
                        <button
                          onClick={() => {
                            const cur = new Set(categoryForm.trendingProductIds || []);
                            if (cur.has(p.id)) cur.delete(p.id);
                            else cur.add(p.id);
                            setCategoryForm({ ...categoryForm, trendingProductIds: Array.from(cur) });
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                            isTrending ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Trending
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Narrative & Text Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                    Custom Narrative & Story Sections ({categoryForm.customSections?.length || 0})
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Create multiple rich text sections with artisan stories, certifications, and CTA buttons.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenCustomSectionModal()}
                  className="px-4 py-2 bg-[#802336] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Story Section</span>
                </button>
              </div>

              {/* Default Atelier Story */}
              <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E8DCCF] space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#802336]" />
                  <h5 className="font-serif text-xs font-bold text-[#3B1E22] uppercase tracking-wider">
                    Primary Atelier Heritage Narrative
                  </h5>
                </div>
                <input
                  type="text"
                  value={categoryForm.customStoryTitle || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, customStoryTitle: e.target.value })}
                  placeholder="Section Heading (e.g. The Art of 22K Antique Micron Gold Plating)"
                  className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
                <textarea
                  rows={3}
                  value={categoryForm.customStoryBody || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, customStoryBody: e.target.value })}
                  placeholder="Artisan lineage narrative..."
                  className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
                <input
                  type="text"
                  value={categoryForm.customStoryImage || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, customStoryImage: e.target.value })}
                  placeholder="Illustration photo URL..."
                  className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
              </div>

              {/* Additional Custom Sections list */}
              {(categoryForm.customSections || []).map((sec) => (
                <div
                  key={sec.id}
                  className="bg-white p-4 rounded-2xl border border-[#E8DCCF] flex items-center justify-between gap-4"
                >
                  <div>
                    <h5 className="font-serif text-sm font-bold text-[#3B1E22]">{sec.title}</h5>
                    <p className="text-xs text-gray-600 line-clamp-1">{sec.content}</p>
                    {sec.buttonText && (
                      <span className="text-[10px] text-[#802336] font-semibold">
                        CTA: {sec.buttonText} → {sec.buttonLink}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenCustomSectionModal(sec)}
                      className="p-1 text-gray-600 hover:text-black rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCustomSection(sec.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Call-To-Action Banner Settings */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E8DCCF] space-y-4">
              <h4 className="font-serif text-sm font-bold text-[#3B1E22]">
                Category Call-to-Action (CTA) Banner
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">CTA Heading</label>
                  <input
                    type="text"
                    value={categoryForm.ctaTitle || ''}
                    onChange={(e) => setCategoryForm({ ...categoryForm, ctaTitle: e.target.value })}
                    placeholder="e.g. Looking for a Custom Bridal Set?"
                    className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={categoryForm.ctaButtonText || ''}
                    onChange={(e) => setCategoryForm({ ...categoryForm, ctaButtonText: e.target.value })}
                    placeholder="e.g. Chat on WhatsApp"
                    className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">CTA Subtitle</label>
                <input
                  type="text"
                  value={categoryForm.ctaSubtitle || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, ctaSubtitle: e.target.value })}
                  placeholder="e.g. Connect with our stylist for live video showcases."
                  className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  CTA Action Target (URL or WhatsApp Link)
                </label>
                <input
                  type="text"
                  value={categoryForm.ctaButtonLink || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, ctaButtonLink: e.target.value })}
                  placeholder="https://wa.me/917302187770 or #products"
                  className="w-full bg-white border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. SEO TAB                                               */}
        {/* ======================================================== */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            {/* Google SERP Preview */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400">
                Search Engine Result Preview (Google SERP)
              </span>
              <div className="text-sm font-semibold text-[#1a0dab] hover:underline cursor-pointer">
                {categoryForm.seoTitle || `${categoryForm.name} | VIDHYAA Luxury Jewellery`}
              </div>
              <div className="text-xs text-emerald-700 font-mono">
                https://vidhyaajewellery.com/category/{categoryForm.slug}
              </div>
              <div className="text-xs text-gray-600 line-clamp-2">
                {categoryForm.seoDescription ||
                  categoryForm.description ||
                  'Shop handcrafted luxury jewellery with certified purity and pan-India insured shipping.'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                SEO Meta Title
              </label>
              <input
                type="text"
                value={categoryForm.seoTitle || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, seoTitle: e.target.value })}
                placeholder={`e.g. ${categoryForm.name} | Temple Heirlooms & Bridal Chokers`}
                className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#3B1E22]">SEO Meta Description</label>
                <span className="text-[10px] text-gray-400 font-mono">
                  {(categoryForm.seoDescription || '').length} / 160 recommended
                </span>
              </div>
              <textarea
                rows={3}
                value={categoryForm.seoDescription || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, seoDescription: e.target.value })}
                placeholder="Compelling description with keywords for Google indexation..."
                className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B1E22] mb-1">
                SEO Keywords (Comma Separated)
              </label>
              <input
                type="text"
                value={categoryForm.seoKeywords || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, seoKeywords: e.target.value })}
                placeholder="e.g. gold imitation jewellery, temple choker, kundan bridal set, vidhyaa jewellery"
                className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-xs text-[#3B1E22]"
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 6. PUBLISH & STATUS TAB                                  */}
        {/* ======================================================== */}
        {activeTab === 'publish' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-[#E8DCCF] space-y-4">
              <h4 className="font-serif text-base font-bold text-[#3B1E22]">
                Publishing Controls & Storefront Visibility
              </h4>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#E8DCCF]">
                <div>
                  <div className="font-bold text-xs text-[#241C1A]">Live Storefront Status</div>
                  <div className="text-[11px] text-gray-500">
                    When active, this category page is accessible via direct link, header menus, and shop filters.
                  </div>
                </div>

                <button
                  onClick={() => setCategoryForm({ ...categoryForm, active: !categoryForm.active })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    categoryForm.active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {categoryForm.active ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Published / Live</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Draft / Hidden</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#E8DCCF]">
                <div>
                  <div className="font-bold text-xs text-[#241C1A]">Display Order Index</div>
                  <div className="text-[11px] text-gray-500">
                    Controls position in navbar dropdown and home page circular grids.
                  </div>
                </div>

                <input
                  type="number"
                  value={categoryForm.order || 1}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, order: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-20 bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2 text-center text-xs font-bold"
                />
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] text-center">
                <div className="text-xl font-bold font-serif text-[#3B1E22]">
                  {categoryProducts.length}
                </div>
                <div className="text-[11px] text-gray-500">Designs Assigned</div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] text-center">
                <div className="text-xl font-bold font-serif text-[#3B1E22]">
                  {categoryForm.galleryImages?.length || 0}
                </div>
                <div className="text-[11px] text-gray-500">Gallery Photos</div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] text-center">
                <div className="text-xl font-bold font-serif text-[#3B1E22]">
                  {categoryForm.videos?.length || 0}
                </div>
                <div className="text-[11px] text-gray-500">Video Demonstrations</div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E8DCCF] text-center">
                <div className="text-xl font-bold font-serif text-[#3B1E22]">
                  {currentSectionOrder.length - hiddenSections.size}
                </div>
                <div className="text-[11px] text-gray-500">Active Page Sections</div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-5 rounded-2xl bg-red-50/60 border border-red-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-red-900">Delete Category Page</div>
                <div className="text-[11px] text-red-700">
                  Permanently remove this category page and all associated custom CMS data.
                </div>
              </div>
              <button
                onClick={() => handleRequestDeleteCategory(categoryForm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM GLOBAL ACTION BAR */}
        <div className="pt-6 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <button
            onClick={() => onPreviewCategory(categoryForm)}
            className="text-xs font-bold text-[#802336] hover:underline flex items-center gap-1.5 cursor-pointer uppercase"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Preview Live Category Page</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDuplicateCategory(categoryForm.id)}
              className="px-4 py-2 bg-white border border-[#E8DCCF] hover:bg-gray-50 rounded-xl text-xs font-bold text-[#3B1E22] cursor-pointer"
            >
              Duplicate
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={isSaving}
              className="px-7 py-2.5 rounded-xl bg-[#802336] hover:bg-[#68192a] text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4 text-[#DFB982]" />
              <span>{isSaving ? 'Saving...' : 'Save & Publish Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BULK URL IMPORT MODAL */}
      {showBulkUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E8DCCF]">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-serif text-base font-bold text-[#3B1E22]">Bulk Import Image URLs</h4>
              <button onClick={() => setShowBulkUrlModal(false)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Paste multiple high-resolution image URLs (one URL per line).
            </p>
            <textarea
              rows={6}
              value={bulkUrlsInput}
              onChange={(e) => setBulkUrlsInput(e.target.value)}
              placeholder="/products/uploads/my-product.jpg"
              className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-3 text-xs font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkUrlModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBulkUrls}
                className="px-5 py-2 bg-[#802336] text-white rounded-xl text-xs font-bold uppercase"
              >
                Import All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO ADD / EDIT MODAL */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E8DCCF] my-8 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="font-serif text-base font-bold text-[#3B1E22]">
                  {editingVideo ? 'Edit Jewellery Video' : 'Upload Jewellery Video'}
                </h4>
                <p className="text-[11px] text-gray-500">
                  Upload MP4, MOV, or WebM jewellery demonstration video directly to persistent storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="text-gray-400 hover:text-black cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Category Dropdown */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Video Category *
                </label>
                <select
                  value={videoCategoryId}
                  onChange={(e) => setVideoCategoryId(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#802336]"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  The video will automatically be assigned to and displayed in this jewellery category.
                </p>
              </div>

              {/* Video Title */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Video Title *</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => {
                    setVideoTitle(e.target.value);
                    if (videoValidationError) setVideoValidationError(null);
                  }}
                  placeholder="e.g. Royal Kundan Bridal Choker 360° Studio Reel"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-[#802336]"
                />
              </div>

              {/* DIRECT DRAG-AND-DROP FILE UPLOAD INTERFACE */}
              <div>
                <label className="block font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Jewellery Video File *</span>
                  <span className="text-[10px] text-gray-400 font-normal">MP4, MOV, WebM</span>
                </label>
                <VideoDropzoneUploader
                  currentVideoUrl={videoUrl}
                  currentVideoName={videoFileName}
                  onVideoUploaded={(res) => {
                    setVideoUrl(res.url);
                    setVideoFileName(res.fileName);
                    if (res.thumbnailUrl && !videoThumbnailUrl) {
                      setVideoThumbnailUrl(res.thumbnailUrl);
                    }
                    if (!videoTitle) {
                      const cleanBase = res.fileName
                        .replace(/\.[^/.]+$/, '')
                        .replace(/[-_]/g, ' ');
                      setVideoTitle(cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1));
                    }
                    setVideoValidationError(null);
                  }}
                  onClearVideo={() => {
                    setVideoUrl('');
                    setVideoFileName('');
                  }}
                />
              </div>

              {/* Link to Jewellery Product (Optional) */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Link to Jewellery Product (Optional)
                </label>
                <select
                  value={videoLinkedProductId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setVideoLinkedProductId(prodId);
                    if (prodId && !videoTitle) {
                      const selectedP = products.find((p) => p.id === prodId);
                      if (selectedP) setVideoTitle(`${selectedP.name} 360° Demonstration`);
                    }
                  }}
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#802336]"
                >
                  <option value="">-- No specific product linked (General Category Showcase) --</option>
                  {products
                    .filter((p) => !videoCategoryId || p.categoryId === videoCategoryId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price.toLocaleString('en-IN')})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Linking displays this video on the product's detail page and the homepage Shopping Video section.
                </p>
              </div>

              {/* Video Description */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  placeholder="Describe craftsmanship, stones, setting, and sparkle in this video..."
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#802336]"
                />
              </div>

              {/* Duration and SEO */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Duration Tag</label>
                  <input
                    type="text"
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(e.target.value)}
                    placeholder="e.g. 0:25"
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">SEO Keywords</label>
                  <input
                    type="text"
                    value={videoSeoTags}
                    onChange={(e) => setVideoSeoTags(e.target.value)}
                    placeholder="e.g. bridal choker, 4k reel"
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoIsFeatured}
                  onChange={(e) => setVideoIsFeatured(e.target.checked)}
                  className="accent-[#802336] w-4 h-4"
                />
                <span className="font-semibold text-gray-700">Set as Featured Video in this Category</span>
              </label>

              {/* Validation Error Banner */}
              {videoValidationError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{videoValidationError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                disabled={videoIsSaving}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVideo}
                disabled={videoIsSaving}
                className="px-6 py-2.5 bg-[#802336] hover:bg-[#68192a] disabled:opacity-50 text-white font-bold rounded-xl uppercase tracking-wider cursor-pointer shadow-sm flex items-center gap-2"
              >
                {videoIsSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#DFB982]" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-[#DFB982]" />
                    <span>Save Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMOTIONAL BANNER MODAL */}
      {promoBannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E8DCCF]">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-serif text-base font-bold text-[#3B1E22]">
                {editingPromoBanner ? 'Edit Promo Banner' : 'Add Promotional Banner'}
              </h4>
              <button onClick={() => setPromoBannerModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Title *</label>
                <input
                  type="text"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="e.g. Festive Bridal Edit • Flat 50% Off"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Subtitle / Offer Details</label>
                <input
                  type="text"
                  value={promoSubtitle}
                  onChange={(e) => setPromoSubtitle(e.target.value)}
                  placeholder="e.g. Free delivery and luxury velvet packaging"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Image URL</label>
                <input
                  type="text"
                  value={promoImageUrl}
                  onChange={(e) => setPromoImageUrl(e.target.value)}
                  placeholder="https://... image"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={promoLinkText}
                    onChange={(e) => setPromoLinkText(e.target.value)}
                    placeholder="e.g. Shop Festive Edit"
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Target Link</label>
                  <input
                    type="text"
                    value={promoLinkUrl}
                    onChange={(e) => setPromoLinkUrl(e.target.value)}
                    placeholder="e.g. #products"
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setPromoBannerModalOpen(false)} className="px-4 py-2 font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={handleSavePromoBanner} className="px-5 py-2 bg-[#802336] text-white font-bold rounded-xl uppercase">
                Save Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TEXT SECTION MODAL */}
      {customSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E8DCCF]">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-serif text-base font-bold text-[#3B1E22]">
                {editingCustomSection ? 'Edit Story Section' : 'Add Custom Story Section'}
              </h4>
              <button onClick={() => setCustomSectionModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Section Title *</label>
                <input
                  type="text"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="e.g. The Legacy of Haridwar Polki Karigars"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Section Subtitle</label>
                <input
                  type="text"
                  value={sectionSubtitle}
                  onChange={(e) => setSectionSubtitle(e.target.value)}
                  placeholder="e.g. Century-old setting techniques"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Narrative Content *</label>
                <textarea
                  rows={4}
                  value={sectionContent}
                  onChange={(e) => setSectionContent(e.target.value)}
                  placeholder="Craftsmanship details, materials, and artisan philosophy..."
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Illustration Photo URL</label>
                <input
                  type="text"
                  value={sectionImageUrl}
                  onChange={(e) => setSectionImageUrl(e.target.value)}
                  placeholder="https://... photo URL"
                  className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Button Label (Optional)</label>
                  <input
                    type="text"
                    value={sectionBtnText}
                    onChange={(e) => setSectionBtnText(e.target.value)}
                    placeholder="e.g. Learn More"
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Button Link</label>
                  <input
                    type="text"
                    value={sectionBtnLink}
                    onChange={(e) => setSectionBtnLink(e.target.value)}
                    placeholder="e.g. https://wa.me/..."
                    className="w-full bg-[#FAF7F2] border border-[#E8DCCF] rounded-xl p-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setCustomSectionModalOpen(false)} className="px-4 py-2 font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={handleSaveCustomSection} className="px-5 py-2 bg-[#802336] text-white font-bold rounded-xl uppercase">
                Save Story Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX PREVIEW */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewModalImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 cursor-pointer"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={previewModalImage}
              alt="Preview"
              className="max-h-[85vh] w-auto object-contain rounded-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {videoPreviewPlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setVideoPreviewPlayer(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoPreviewPlayer(null)}
              className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-video w-full bg-black">
              {videoPreviewPlayer.videoUrl.includes('youtube.com') ||
              videoPreviewPlayer.videoUrl.includes('youtu.be') ? (
                <iframe
                  src={
                    videoPreviewPlayer.videoUrl.includes('embed')
                      ? videoPreviewPlayer.videoUrl
                      : `https://www.youtube.com/embed/${
                          videoPreviewPlayer.videoUrl.split('v=')[1]?.split('&')[0] ||
                          videoPreviewPlayer.videoUrl.split('/').pop()
                        }`
                  }
                  title={videoPreviewPlayer.title}
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoPreviewPlayer.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="p-4 bg-[#1C1615] text-white">
              <h4 className="font-serif text-sm font-bold text-[#DFB982]">{videoPreviewPlayer.title}</h4>
              <p className="text-xs text-gray-400 mt-1">{videoPreviewPlayer.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE NEW CATEGORY MODAL */}
      {/* ======================================================== */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-[#E8DCCF] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#FAF7F2] px-6 py-4 border-b border-[#E8DCCF] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#802336]/10 flex items-center justify-center text-[#802336]">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                    Create New Store Category
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Add a new jewellery or timepiece category to the catalog and navigation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200/60 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCategorySubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {addCategoryError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span className="font-medium">{addCategoryError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => handleCategoryNameChange(e.target.value)}
                    placeholder="e.g. Watches"
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]/50 font-medium text-gray-900"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Displayed in menus and headers.</p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatSlug}
                    onChange={(e) =>
                      setNewCatSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '')
                      )
                    }
                    placeholder="e.g. watches"
                    className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]/50 font-mono text-gray-900"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">URL path e.g. /category/watches</p>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={newCatSubtitle}
                  onChange={(e) => setNewCatSubtitle(e.target.value)}
                  placeholder="e.g. Luxury Royal Timepieces & Artisan Wristwear"
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]/50 text-gray-900"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newCatDescription}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  placeholder="e.g. Handcrafted royal luxury watches and heritage timepieces celebrating timeless Indian craftsmanship..."
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]/50 text-gray-900"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Cover / Banner Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={newCatImage}
                  onChange={(e) => setNewCatImage(e.target.value)}
                  placeholder="https://... or /products/..."
                  className="w-full px-3 py-2 border border-[#E8DCCF] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#802336] bg-[#FAF7F2]/50 text-gray-900"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Subcategories (Style & Filter Tags)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Royal Timepieces, Gold Finish, Daily Wear"
                    value={newCatSubcatInput}
                    onChange={(e) => setNewCatSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcatToNewCategory();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-[#E8DCCF] rounded-xl text-xs bg-[#FAF7F2]/50 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcatToNewCategory}
                    className="bg-[#FAF7F2] hover:bg-[#F4EBE1] text-[#3B1E22] px-4 py-2 rounded-xl font-bold border border-[#E8DCCF] cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {newCatSubcategories.map((sub) => (
                    <span
                      key={sub}
                      className="bg-[#FAF7F2] text-[#802336] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#E8DCCF] flex items-center gap-1.5"
                    >
                      <span>{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcatFromNewCategory(sub)}
                        className="hover:text-red-600 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={newCatActive}
                    onChange={(e) => setNewCatActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#802336] focus:ring-[#802336]"
                  />
                  <span>Publish category immediately (visible in storefront navigation)</span>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#E8DCCF] flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isCreatingCategory}
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCategory}
                  className="bg-gradient-to-r from-[#802336] to-[#5c1322] hover:from-[#68192a] hover:to-[#450e19] text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isCreatingCategory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#DFB982]" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-[#DFB982]" />
                      <span>Create Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-600 border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#3B1E22]">
                  Delete Category
                </h3>
                <p className="text-xs text-gray-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteCategoryError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteCategoryError}</span>
              </div>
            )}

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{categoryToDelete.name}"</span>? All custom CMS banners, images, and section layout settings for this category will be removed.
            </p>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingCategory}
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCategory}
                onClick={handleConfirmDeleteCategory}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isDeletingCategory ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Category</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
