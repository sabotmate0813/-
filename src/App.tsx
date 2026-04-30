/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Menu, X, Instagram, Mail, ArrowRight, CheckCircle2, 
  ExternalLink, ChevronLeft, ChevronRight, Settings, 
  Dribbble, Github, Image as ImageIcon, GripVertical,
  LogOut
} from 'lucide-react';
import { Category, PortfolioItem } from './types';
import { INITIAL_PORTFOLIO, CATEGORIES } from './constants';
import { 
  db, auth, signInWithGoogle, handleFirestoreError, OperationType 
} from './lib/firebase';
import { 
  collection, getDocs, doc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface CategoryData {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
}

export default function App() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [currentFlatIdx, setCurrentFlatIdx] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProjectsHovered, setIsProjectsHovered] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [draftPortfolio, setDraftPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataReady, setDataReady] = useState({ portfolio: false, categories: false });
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Combined loading control
  useEffect(() => {
    if (dataReady.portfolio && dataReady.categories && activeCategory) {
      const timer = setTimeout(() => setIsLoading(false), 800); // Small buffer for smooth entry
      return () => clearTimeout(timer);
    }
  }, [dataReady, activeCategory]);
  
  const [adminSelectedCat, setAdminSelectedCat] = useState<string>('');
  const [adminSelectedSub, setAdminSelectedSub] = useState<string>('');
  const [adminSelectedProjectId, setAdminSelectedProjectId] = useState<string>('');

  // Handle default active category once categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);

  // Effect to reset selection when main category changes
  useEffect(() => {
    const cat = categories.find(c => c.name === adminSelectedCat);
    if (cat && cat.subCategories.length > 0) {
      if (adminSelectedSub && !cat.subCategories.some(s => s.name === adminSelectedSub)) {
        setAdminSelectedSub('');
      }
    } else {
      setAdminSelectedSub('');
    }
    // Also reset project selection
    setAdminSelectedProjectId('');
  }, [adminSelectedCat, categories, adminSelectedSub]);

  // Find all projects matching the current category/sub-category selection
  const matchingAdminProjects = useMemo(() => {
    if (!adminSelectedCat) return [];
    
    return draftPortfolio.filter(p => {
      const catMatch = p.category === adminSelectedCat;
      // If we've selected a sub-category, match strictly
      if (adminSelectedSub) {
        return catMatch && p.application === adminSelectedSub;
      }
      
      // If we've selected "None", match projects with NO sub-category 
      // OR projects with a sub-category that NO LONGER EXISTS in the definition
      const catDef = categories.find(c => c.name === adminSelectedCat);
      const isValidSub = catDef?.subCategories.some(s => s.name === p.application);
      
      return catMatch && (!p.application || !isValidSub);
    });
  }, [draftPortfolio, adminSelectedCat, adminSelectedSub, categories]);

  // Find or create current project for admin
  const currentAdminProject = useMemo(() => {
    if (!adminSelectedCat) return null;
    
    // Try to find by explicit ID if selected
    if (adminSelectedProjectId) {
      const item = draftPortfolio.find(p => p.id === adminSelectedProjectId);
      if (item) return item;
    }

    // Otherwise use the first matching project
    if (matchingAdminProjects.length > 0) {
      return matchingAdminProjects[0];
    }
    
    // Create empty template if not found
    return {
      id: `template_${adminSelectedCat}_${adminSelectedSub || 'main'}_${Date.now()}`.replace(/\s+/g, '_'),
      category: adminSelectedCat,
      application: adminSelectedSub || '',
      title: `${adminSelectedCat}${adminSelectedSub ? ' - ' + adminSelectedSub : ''}`,
      description: '',
      images: []
    } as PortfolioItem;
  }, [matchingAdminProjects, adminSelectedCat, adminSelectedSub, adminSelectedProjectId, draftPortfolio]);
  
  // Auth state listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      // Hardcoded admin check matching firestore.rules
      setIsAdminAuthenticated(user?.email === 'sabotmate0813@gmail.com' && user?.emailVerified === true);
    });
  }, []);

  // Initialize categories and their sub-categories from Firestore
  useEffect(() => {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const catPromises = snapshot.docs.map(async (docSnap) => {
        const catId = docSnap.id;
        const catData = docSnap.data();
        
        const subRef = collection(db, `categories/${catId}/subcategories`);
        const subSnapshot = await getDocs(query(subRef, orderBy('order', 'asc')));
        const subItems = subSnapshot.docs.map(d => ({ 
          id: d.id, 
          name: d.data().name 
        }));

        return {
          id: catId,
          name: catData.name,
          subCategories: subItems
        };
      });

      Promise.all(catPromises).then(cats => {
        if (cats.length > 0) {
          setCategories(cats);
          if (!adminSelectedCat) setAdminSelectedCat(cats[0].name);
        } else {
          const fallback = CATEGORIES.filter(c => c !== 'All').map(c => ({
            id: c.toLowerCase().replace(/\s+/g, '-'),
            name: c,
            subCategories: c === 'Projects' 
              ? ['SOS', 'Project-L', 'RudyPang', 'Monster-Warload'].map(s => ({ id: s.toLowerCase(), name: s }))
              : []
          }));
          setCategories(fallback);
          if (!adminSelectedCat) setAdminSelectedCat(fallback[0].name);
        }
        setDataReady(prev => ({ ...prev, categories: true }));
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => unsubscribe();
  }, []);

  // Initialize portfolio from Firestore
  useEffect(() => {
    const portfolioRef = collection(db, 'portfolio');
    const q = query(portfolioRef);

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const fetchPromises = snapshot.docs.map(async (docSnap) => {
          const itemData = docSnap.data() as PortfolioItem;
          // Fetch sub-images separately for each item
          const imagesRef = collection(db, `portfolio/${docSnap.id}/images`);
          const imgSnapshot = await getDocs(query(imagesRef, orderBy('order', 'asc')));
          const images = imgSnapshot.docs.map(d => d.data() as { url: string; title: string });
          
          return {
            ...itemData,
            images: images // Use subcollection images
          };
        });
        
        const items = await Promise.all(fetchPromises);
        
        if (items.length > 0) {
          setPortfolio(items);
          setDraftPortfolio(items);
        } else {
          setPortfolio(INITIAL_PORTFOLIO);
          setDraftPortfolio(INITIAL_PORTFOLIO);
        }
        setDataReady(prev => ({ ...prev, portfolio: true }));
      } catch (error) {
        console.error('Error fetching data:', error);
        setDataReady(prev => ({ ...prev, portfolio: true }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolio');
      setDataReady(prev => ({ ...prev, portfolio: true }));
    });

    return () => unsubscribe();
  }, []);

  const filteredPortfolio = useMemo(() => {
    // Check if activeCategory is a main category or a subcategory
    const parentCategory = categories.find(c => c.name === activeCategory);
    if (parentCategory) {
      // If it's a parent category, we might want to show everything under it
      // but usually we want to see items specifically assigned to it or its subs if requested
      return portfolio.filter(item => item.category === activeCategory);
    }

    // Check if it's a subcategory
    const catWithSub = categories.find(c => c.subCategories.some(s => s.name === activeCategory));
    if (catWithSub) {
      return portfolio.filter(item => item.category === catWithSub.name && item.application === activeCategory);
    }

    return portfolio.filter(item => item.category === activeCategory);
  }, [portfolio, activeCategory, categories]);

  const getValidSubCategory = (category: string, sub: string) => {
    const cat = categories.find(c => c.name === category);
    if (!cat) return null;
    const subExists = cat.subCategories.some(s => s.name === sub);
    return subExists ? sub : null;
  };

  const allCategoryImages = useMemo(() => {
    const images: { url: string; title: string; item: PortfolioItem; idx: number }[] = [];
    filteredPortfolio.forEach(item => {
      item.images.forEach((img, i) => {
        images.push({ 
          url: img.url, 
          title: img.title || item.title, 
          item, 
          idx: i 
        });
      });
    });
    return images;
  }, [filteredPortfolio]);

  // Reset flat index when category changes or when it exceeds existing images
  useEffect(() => {
    if (allCategoryImages.length === 0) {
      setCurrentFlatIdx(0);
    } else if (currentFlatIdx >= allCategoryImages.length) {
      setCurrentFlatIdx(Math.max(0, allCategoryImages.length - 1));
    }
  }, [activeCategory, allCategoryImages.length, currentFlatIdx]);

  const handleReorderCategories = async (newOrder: CategoryData[]) => {
    setCategories(newOrder);
    const batch = writeBatch(db);
    newOrder.forEach((cat, idx) => {
      batch.update(doc(db, 'categories', cat.id), { order: idx });
    });
    await batch.commit();
  };

  const handleReorderSubCategories = async (catId: string, newSubs: { id: string, name: string }[]) => {
    setCategories(prev => prev.map(c => 
      c.id === catId ? { ...c, subCategories: newSubs } : c
    ));
    const batch = writeBatch(db);
    newSubs.forEach((sub, idx) => {
      batch.update(doc(db, `categories/${catId}/subcategories`, sub.id), { order: idx });
    });
    await batch.commit();
  };

  const handleUpdateCurrentProject = (updates: Partial<PortfolioItem>) => {
    if (!currentAdminProject) return;
    setDraftPortfolio(prev => {
      const exists = prev.some(p => p.id === currentAdminProject.id);
      if (exists) {
        return prev.map(p => p.id === currentAdminProject.id ? { ...p, ...updates } : p);
      } else {
        return [...prev, { ...currentAdminProject, ...updates }];
      }
    });
  };

  const handleAdminAuth = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
      alert(`로그인 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminMode(false);
  };

  const handleBulkSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Get current IDs in DB to handle deletions
      const snapshot = await getDocs(collection(db, 'portfolio'));
      const dbIds = snapshot.docs.map(doc => doc.id);
      const draftIds = draftPortfolio.map(item => item.id);
      
      // 2. Delete items that were removed in draft
      dbIds.forEach(id => {
        if (!draftIds.includes(id)) {
          batch.delete(doc(db, 'portfolio', id));
        }
      });
      
      // 3. Set/Update all items in draft
      for (const item of draftPortfolio) {
        const itemId = item.id;
        
        // Split images: Store them separately to bypass 1MB limit
        const { images, ...mainData } = item;
        
        // Clean application if it's not a valid sub-category
        const catDef = categories.find(c => c.name === item.category);
        const isValidSub = catDef?.subCategories.some(s => s.name === item.application);
        const cleanedApplication = isValidSub ? item.application : '';

        const validatedMainItem = {
          ...mainData,
          images: [], // We keep the array empty in main doc OR store only thumbnails here
          application: cleanedApplication || '',
          description: item.description || '',
          client: item.client || '',
          role: item.role || '',
          process: item.process || [],
          updatedAt: new Date().toISOString()
        };

        batch.set(doc(db, 'portfolio', itemId), validatedMainItem);

        // Delete existing images in subcollection first to avoid orphans
        const existingImgs = await getDocs(collection(db, `portfolio/${itemId}/images`));
        existingImgs.forEach(imgDoc => {
          batch.delete(imgDoc.ref);
        });

        // Add new images to subcollection
        images.forEach((img, idx) => {
          const imgId = `img_${idx}`;
          batch.set(doc(db, `portfolio/${itemId}/images`, imgId), {
            ...img,
            order: idx
          });
        });
      }
      
      await batch.commit();
      
      setIsAdminMode(false);
      setIsAdminAuthenticated(false);
      alert('변경사항이 성공적으로 저장되었습니다.');
    } catch (error: any) {
      console.error('Error saving portfolio:', error);
      const msg = error?.message || '잠시 후 다시 시도해주세요.';
      if (msg.includes('too large') || error?.code === 'resource-exhausted') {
        alert('저장 실패: 프로젝트의 전체 용량이 1MB를 초과했습니다. 이미지를 더 압축하거나 개수를 줄여주세요.');
      } else {
        alert(`저장 중 오류가 발생했습니다: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProject = () => {
    const newItem: PortfolioItem = {
      id: Date.now().toString(),
      category: 'Illustration',
      title: '',
      application: '',
      description: '',
      images: [],
    };
    setDraftPortfolio([newItem, ...draftPortfolio]);
  };

  const handleUpdateDraft = (id: string, updates: Partial<PortfolioItem>) => {
    setDraftPortfolio(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleRemoveDraft = (id: string) => {
    setDraftPortfolio(prev => prev.filter(item => item.id !== id));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleDraftFileChange = async (id: string, files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const newImages: { url: string; title: string }[] = [];

    for (const file of fileArray) {
      try {
        const compressedUrl = await compressImage(file);
        newImages.push({ url: compressedUrl, title: '' });
      } catch (error) {
        console.error('Image compression failed:', error);
      }
    }

    if (newImages.length > 0) {
      setDraftPortfolio(prev => prev.map(item => 
        item.id === id ? { ...item, images: [...item.images, ...newImages] } : item
      ));
    }
  };

  const removeImageFromDraft = (projectId: string, imageUrl: string) => {
    setDraftPortfolio(prev => prev.map(item => {
      if (item.id === projectId) {
        return { ...item, images: item.images.filter(img => img.url !== imageUrl) };
      }
      return item;
    }));
  };

  const updateImageTitleInDraft = (projectId: string, imageUrl: string, title: string) => {
    setDraftPortfolio(prev => prev.map(item => {
      if (item.id === projectId) {
        return { 
          ...item, 
          images: item.images.map(img => img.url === imageUrl ? { ...img, title } : img) 
        };
      }
      return item;
    }));
  };

  const handleReorderImages = (projectId: string, newImages: { url: string; title: string }[]) => {
    setDraftPortfolio(prev => prev.map(item => 
      item.id === projectId ? { ...item, images: newImages } : item
    ));
  };

  const handlePrevImage = () => {
    if (allCategoryImages.length === 0) return;
    setCurrentFlatIdx((prev) => (prev - 1 + allCategoryImages.length) % allCategoryImages.length);
  };

  const handleNextImage = () => {
    if (allCategoryImages.length === 0) return;
    setCurrentFlatIdx((prev) => (prev + 1) % allCategoryImages.length);
  };

  return (
    <div className="min-h-screen selection:bg-black selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-10 h-24 flex items-center justify-between">
          <a href="#" className="text-xl font-bold tracking-[0.2em] uppercase">SKETCHNUB</a>
          
          <div className="flex items-center gap-12">
            {/* Categories in Nav - Right Aligned */}
            <div className="hidden md:flex items-center gap-10 text-[13px] font-extralight tracking-[0.05em] lowercase">
              {categories.map((cat) => {
                const isHovered = isProjectsHovered && cat.subCategories.length > 0;
                
                if (cat.subCategories.length > 0) {
                  return (
                    <div 
                      key={cat.id}
                      className="relative h-full flex items-center"
                      onMouseEnter={() => setIsProjectsHovered(true)}
                      onMouseLeave={() => setIsProjectsHovered(false)}
                    >
                      <button
                        onClick={() => setActiveCategory(cat.name)}
                        className={`transition-colors py-2 lowercase hover:underline underline-offset-8 ${activeCategory === cat.name || cat.subCategories.some(s => s.name === activeCategory) ? 'text-black font-normal underline underline-offset-8' : 'text-black'}`}
                      >
                        {cat.name.toLowerCase()} +
                      </button>
                      
                      <AnimatePresence>
                        {isProjectsHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute top-full -right-8 pt-4"
                          >
                            <div className="bg-black p-8 min-w-[240px] rounded-none relative">
                              <div className="absolute -top-1.5 right-12 w-3 h-3 bg-black rotate-45" />
                              <div className="flex flex-col gap-6 font-normal text-[15px] tracking-tight capitalize">
                                {cat.subCategories.map((sub) => (
                                  <button
                                    key={sub.id}
                                    onClick={() => {
                                      setActiveCategory(sub.name);
                                      setIsProjectsHovered(false);
                                    }}
                                    className={`text-left underline-offset-8 transition-colors hover:underline decoration-white ${activeCategory === sub.name ? 'text-white font-semibold underline' : 'text-white'}`}
                                  >
                                    {sub.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                
                return (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`transition-colors h-full flex items-center hover:underline underline-offset-8 ${activeCategory === cat.name ? 'text-black font-normal underline underline-offset-8' : 'text-black'}`}
                  >
                    {cat.name.toLowerCase()}
                  </button>
                );
              })}
              
              <div className="flex items-center gap-6 ml-6 pl-6 border-l border-black/5">
                <Instagram size={20} strokeWidth={1.5} className="text-black/30 hover:text-black cursor-pointer transition-colors" />
                <Mail size={20} strokeWidth={1.5} className="text-black/30 hover:text-black cursor-pointer transition-colors" />
              </div>
            </div>

            <div className="flex items-center space-x-12">
              <button 
                onClick={() => setIsAdminMode(true)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors opacity-40 hover:opacity-100"
              >
                <Settings size={14} />
              </button>
              
              {/* Mobile Menu Trigger */}
              <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center space-y-8 p-10"
            >
              <div className="flex flex-col items-center space-y-6">
                <span className="text-[10px] uppercase font-bold tracking-[0.5em] text-black/30 mb-4">Categories</span>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex flex-col items-center gap-4">
                    <button
                      onClick={() => { setActiveCategory(cat.name); setIsMenuOpen(false); }}
                      className={`text-2xl font-bold uppercase tracking-widest transition-colors ${activeCategory === cat.name || cat.subCategories.some(s => s.name === activeCategory) ? 'text-black' : 'text-black/30'}`}
                    >
                      {cat.name}
                    </button>
                    {cat.subCategories.length > 0 && (activeCategory === cat.name || cat.subCategories.some(s => s.name === activeCategory)) && (
                      <div className="flex flex-col items-center gap-2 mb-4">
                        {cat.subCategories.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => { setActiveCategory(sub.name); setIsMenuOpen(false); }}
                            className={`text-sm tracking-widest uppercase ${activeCategory === sub.name ? 'text-black font-bold' : 'text-black/40'}`}
                          >
                            - {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="pt-10 border-t border-black/5 w-full flex flex-col items-center space-y-6">
                <button 
                  onClick={() => { setIsAdminMode(true); setIsMenuOpen(false); }}
                  className="text-black/40 flex items-center gap-2 text-xs"
                >
                  <Settings size={14} /> Admin Portal
                </button>
              </div>

              <button 
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-10 right-10 p-4"
              >
                <X size={32} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="pt-24">
        {/* Portfolio Section */}
        <section id="portfolio" className="py-10 bg-white min-h-[90vh] flex flex-col">
          <div className="relative flex-1 flex flex-col justify-center px-4 md:px-6 mt-4">
            <div className="relative w-full max-w-[2400px] mx-auto overflow-hidden group min-h-[75vh] md:min-h-[90vh] flex items-center justify-center pt-8">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                {allCategoryImages.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentFlatIdx(i)}
                    className={`h-0.5 transition-all duration-500 ${i === currentFlatIdx ? 'w-16 bg-black' : 'w-4 bg-black/20 hover:bg-black/40'}`}
                  />
                ))}
              </div>
              <AnimatePresence mode="wait">
                {allCategoryImages.length > 0 && allCategoryImages[currentFlatIdx] ? (
                  <motion.div
                    key={`${allCategoryImages[currentFlatIdx].url}-${currentFlatIdx}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 p-0 flex items-center justify-center pointer-events-none"
                  >
                    <img 
                      src={allCategoryImages[currentFlatIdx].url} 
                      alt={allCategoryImages[currentFlatIdx].title}
                      className="max-w-full max-h-full w-auto h-auto transition-all duration-1000 object-contain"
                      style={{ pointerEvents: 'auto' }}
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                ) : !isLoading && activeCategory ? (
                  <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-4">
                      <ImageIcon size={32} className="text-black/10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-brand-text uppercase tracking-[0.2em]">No Content Detected</h3>
                      <p className="text-brand-muted text-sm max-w-xs mx-auto">
                        The selected category "{activeCategory}" seems to be empty. 
                        Please check back later or explore other sections.
                      </p>
                    </div>
                    <button 
                      onClick={() => categories.length > 0 && setActiveCategory(categories[0].name)}
                      className="px-8 py-3 bg-black text-white rounded-full text-xs font-bold hover:opacity-80 transition-opacity"
                    >
                      View Home
                    </button>
                  </div>
                ) : null}
              </AnimatePresence>

              {isAdminAuthenticated && allCategoryImages.length > 0 && (
                <div className="absolute top-6 right-6 bg-black text-white p-2 rounded-full opacity-80 z-20">
                  <Settings size={14} />
                </div>
              )}
            </div>

            {/* Title below image */}
            {allCategoryImages.length > 0 && allCategoryImages[currentFlatIdx] && (
              <div className="mt-12 text-center">
                {getValidSubCategory(allCategoryImages[currentFlatIdx].item.category, allCategoryImages[currentFlatIdx].item.application || '') && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 mb-2">
                    {allCategoryImages[currentFlatIdx].item.application}
                  </p>
                )}
                <h3 className="text-3xl font-medium tracking-tight text-brand-text">
                  {allCategoryImages[currentFlatIdx].title}
                </h3>
              </div>
            )}

            {/* Centered navigation buttons - relative to the active picture area */}
            {allCategoryImages.length > 1 && (
              <>
                <div className="absolute top-1/2 -translate-y-1/2 left-14 z-20">
                  <button 
                    onClick={handlePrevImage}
                    className="p-6 rounded-full bg-black text-white transition-all border border-black/5"
                  >
                    <ChevronLeft size={32} />
                  </button>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-14 z-20">
                  <button 
                    onClick={handleNextImage}
                    className="p-6 rounded-full bg-black text-white transition-all border border-black/5"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 px-10 border-t border-black/5 opacity-40 bg-white">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-[10px] font-bold uppercase tracking-[0.5em] text-brand-text">
          <p>© 2024 SKETCHNUB / VISUAL CORE</p>
          <div className="flex gap-12">
            <a href="#" className="hover:text-black transition-colors">Privacy.pnp</a>
            <a href="#" className="hover:text-black transition-colors">Nexus.sys</a>
          </div>
        </div>
      </footer>
      {/* Modal/Detail View Area (Disabled) */}
      <AnimatePresence>
        {isAdminMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-brand-accent overflow-y-auto"
          >
            {/* Admin Header */}
            <header className="sticky top-0 z-10 bg-brand-accent/80 backdrop-blur-md border-b border-black/5 px-8 h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold tracking-tight">SKETCHNUB 관리자</h2>
                {isAdminAuthenticated && (
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-[10px] bg-black/5 px-3 py-1 rounded-full text-black/40 hover:text-black transition-colors"
                  >
                    <LogOut size={12} /> Logout
                  </button>
                )}
              </div>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => { setIsAdminMode(false); setIsAdminAuthenticated(false); }}
                  className="text-sm font-medium text-brand-muted hover:text-brand-text transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleBulkSave}
                  disabled={!isAdminAuthenticated || isSaving}
                  className={`px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#7557F1] text-white shadow-purple-500/20 hover:opacity-90 disabled:grayscale'}`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : '변경사항 저장'}
                </button>
              </div>
            </header>

            <div className="max-w-7xl mx-auto p-12">
              {!isAdminAuthenticated ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 bg-white rounded-[40px] shadow-sm">
                  <div className="text-center">
                    <Settings className="mx-auto mb-6 text-brand-text" size={48} />
                    <h3 className="text-3xl font-serif">Admin Access</h3>
                    <p className="text-brand-muted mt-2">
                      {currentUser ? '관리자 권한이 없습니다.' : '구글 로그인이 필요합니다.'}
                    </p>
                  </div>
                  
                  <div className="w-full max-w-sm space-y-4">
                    {!currentUser ? (
                      <button 
                        onClick={handleAdminAuth}
                        className="w-full py-4 bg-brand-text text-white rounded-2xl font-bold shadow-xl hover:bg-brand-muted transition-colors flex items-center justify-center gap-3"
                      >
                        <Instagram size={20} /> Login with Google
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm">
                          접속 계정: {currentUser.email}<br/>
                          관리자 전용 계정으로 로그인해주세요.
                        </div>
                        <button 
                          onClick={handleLogout}
                          className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-xl transition-colors"
                        >
                          다른 계정으로 로그인
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Unified Project Editor */}
                  <div className="bg-white rounded-[40px] p-10 shadow-sm space-y-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-100 pb-10">
                      <div className="space-y-6 flex-1">
                        <h3 className="text-xl font-bold uppercase tracking-widest text-brand-text">Image Management</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">SELECT CATEGORY</label>
                            <select 
                              value={adminSelectedCat}
                              onChange={(e) => setAdminSelectedCat(e.target.value)}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text appearance-none cursor-pointer font-bold"
                            >
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">SELECT SUB-CATEGORY</label>
                            <select 
                              value={adminSelectedSub}
                              onChange={(e) => setAdminSelectedSub(e.target.value)}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text appearance-none cursor-pointer font-bold"
                            >
                              <option value="">None / Orphaned</option>
                              {categories.find(c => c.name === adminSelectedCat)?.subCategories.map(sub => (
                                <option key={sub.id} value={sub.name}>{sub.name}</option>
                              ))}
                            </select>
                          </div>
                          {matchingAdminProjects.length > 1 && (
                            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                              <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">SELECT PROJECT</label>
                              <select 
                                value={adminSelectedProjectId}
                                onChange={(e) => setAdminSelectedProjectId(e.target.value)}
                                className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text appearance-none cursor-pointer font-bold border-2 border-brand-text/20"
                              >
                                {matchingAdminProjects.map(p => (
                                  <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {currentAdminProject && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">PROJECT TITLE (OPTIONAL)</label>
                            <input 
                              type="text" 
                              value={currentAdminProject.title}
                              onChange={(e) => handleUpdateCurrentProject({ title: e.target.value })}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text font-medium"
                              placeholder="e.g. SOS Character Design"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">DESCRIPTION (OPTIONAL)</label>
                            <input 
                              type="text" 
                              value={currentAdminProject.description}
                              onChange={(e) => handleUpdateCurrentProject({ description: e.target.value })}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text font-medium"
                              placeholder="Project summary..."
                            />
                          </div>
                        </div>

                        {/* Image Grid */}
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold flex items-center justify-between">
                            PICTURES ({currentAdminProject.images.length})
                            <span className="text-[8px] opacity-60">DRAG HANDLES TO REORDER</span>
                          </label>
                          <Reorder.Group 
                            axis="y" 
                            values={currentAdminProject.images} 
                            onReorder={(newImgs) => handleUpdateCurrentProject({ images: newImgs })}
                            className="space-y-3"
                          >
                            {currentAdminProject.images.map((img) => (
                              <Reorder.Item 
                                key={img.url} 
                                value={img}
                                className="flex items-center gap-6 p-4 bg-brand-accent/50 rounded-2xl group border border-transparent hover:border-black/5"
                              >
                                <div className="cursor-grab active:cursor-grabbing text-black/10 group-hover:text-black/30 px-2 py-4">
                                  <GripVertical size={20} />
                                </div>
                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/5 flex-shrink-0">
                                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="text"
                                    value={img.title || ''}
                                    placeholder="Image title (optional)..."
                                    onChange={(e) => {
                                      const newImgs = currentAdminProject.images.map(i => 
                                        i.url === img.url ? { ...i, title: e.target.value } : i
                                      );
                                      handleUpdateCurrentProject({ images: newImgs });
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-sm font-medium focus:ring-0"
                                  />
                                </div>
                                <button 
                                  onClick={() => handleUpdateCurrentProject({ 
                                    images: currentAdminProject.images.filter(i => i.url !== img.url) 
                                  })}
                                  className="p-3 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <X size={20} />
                                </button>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>

                          <div className="pt-4">
                            <label className="w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-black/10 rounded-[30px] hover:border-brand-text hover:bg-white transition-all cursor-pointer group">
                              <ImageIcon size={32} className="text-black/10 group-hover:text-brand-text mb-4" />
                              <span className="text-sm font-bold text-brand-text uppercase tracking-widest text-[10px]">Add New Pictures</span>
                              <span className="text-[8px] text-brand-muted mt-2 uppercase tracking-widest opacity-60">JPG, PNG up to 1MB each</span>
                              <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                  if (!e.target.files) return;
                                  const fileArray = Array.from(e.target.files) as File[];
                                  const newImgs: { url: string; title: string }[] = [];
                                  for (const file of fileArray) {
                                    try {
                                      const url = await compressImage(file);
                                      newImgs.push({ url, title: '' });
                                    } catch (err) { console.error(err); }
                                  }
                                  handleUpdateCurrentProject({ images: [...currentAdminProject.images, ...newImgs] });
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category Management Section */}
                  <div className="bg-white rounded-[40px] p-10 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                      <h3 className="text-xl font-bold uppercase tracking-widest text-brand-text">Category Structure</h3>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="New category name..."
                          className="px-4 py-2 bg-brand-accent rounded-xl text-sm outline-none focus:ring-1 focus:ring-brand-text w-full md:w-auto font-medium"
                        />
                        <button 
                          onClick={async () => {
                            if (!newCategoryName.trim()) return;
                            const id = newCategoryName.toLowerCase().replace(/\s+/g, '-');
                            try {
                              await setDoc(doc(db, 'categories', id), {
                                name: newCategoryName,
                                order: categories.length
                              });
                              setNewCategoryName('');
                            } catch (e) {
                              handleFirestoreError(e, OperationType.WRITE, `categories/${id}`);
                            }
                          }}
                          disabled={!newCategoryName.trim()}
                          className="px-6 py-2 bg-black text-white rounded-xl text-xs font-bold hover:opacity-80 transition-opacity disabled:bg-gray-300 whitespace-nowrap"
                        >
                          + ADD
                        </button>
                      </div>
                    </div>

                    <Reorder.Group axis="y" values={categories} onReorder={handleReorderCategories} className="space-y-6">
                      {categories.map((cat) => (
                        <Reorder.Item key={cat.id} value={cat} className="space-y-4 p-8 bg-brand-accent rounded-[32px] group relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="cursor-grab active:cursor-grabbing text-black/10 group-hover:text-black/30 py-2">
                                <GripVertical size={18} />
                              </div>
                              <h4 className="font-bold text-lg flex items-center gap-4 text-brand-text uppercase tracking-tight">
                                {cat.name}
                                <button 
                                  onClick={async () => {
                                    if (confirm(`Delete "${cat.name}"? This will remove sub-categories but leave projects orphaned until you reassess them.`)) {
                                      try {
                                        await deleteDoc(doc(db, 'categories', cat.id));
                                      } catch (e) {
                                        handleFirestoreError(e, OperationType.DELETE, `categories/${cat.id}`);
                                      }
                                    }
                                  }}
                                  className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                                >
                                  <X size={18} />
                                </button>
                              </h4>
                            </div>
                          </div>

                          <Reorder.Group 
                            axis="x" 
                            values={cat.subCategories} 
                            onReorder={(newSubs) => handleReorderSubCategories(cat.id, newSubs)}
                            className="flex flex-wrap gap-3 items-center"
                          >
                            {cat.subCategories.length > 0 && cat.subCategories.map((sub) => (
                              <Reorder.Item 
                                key={sub.id} 
                                value={sub}
                                className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-black/5 cursor-grab active:cursor-grabbing shadow-sm"
                              >
                                <span className="text-xs font-bold text-brand-text">{sub.name}</span>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await deleteDoc(doc(db, `categories/${cat.id}/subcategories`, sub.id));
                                    } catch (e) {
                                      handleFirestoreError(e, OperationType.DELETE, `categories/${cat.id}/subcategories/${sub.id}`);
                                    }
                                  }}
                                  className="text-black/20 hover:text-red-500 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </Reorder.Item>
                            ))}
                            
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                placeholder="+ Sub-category"
                                className="px-4 py-2 bg-white/50 rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-text w-36 border border-black/5 font-medium"
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    if (!val.trim()) return;
                                    const subId = val.toLowerCase().replace(/\s+/g, '-');
                                    try {
                                      await setDoc(doc(db, `categories/${cat.id}/subcategories`, subId), {
                                        name: val,
                                        order: cat.subCategories.length
                                      });
                                      (e.target as HTMLInputElement).value = '';
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.WRITE, `categories/${cat.id}/subcategories/${subId}`);
                                    }
                                  }
                                }}
                              />
                            </div>
                          </Reorder.Group>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>

                  {/* Project List View (Restored for visibility) */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-black/5 pb-4">
                      <h3 className="text-lg font-bold uppercase tracking-widest text-[#B5B5B5]">All Portfolio Projects</h3>
                      <button 
                        onClick={handleAddProject}
                        className="text-xs font-bold bg-black text-white px-4 py-2 rounded-xl hover:opacity-80 transition-opacity"
                      >
                        + NEW PROJECT
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {draftPortfolio.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            setAdminSelectedCat(item.category);
                            setAdminSelectedSub(item.application || '');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`p-6 rounded-[32px] border-2 transition-all cursor-pointer group ${
                            adminSelectedCat === item.category && adminSelectedSub === item.application 
                            ? 'border-brand-text bg-white shadow-xl' 
                            : 'border-transparent bg-white/50 hover:bg-white hover:border-black/5'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-black/30">
                                {item.category} 
                                {getValidSubCategory(item.category, item.application || '') ? ` > ${item.application}` : ''}
                              </span>
                              <h4 className="font-bold text-brand-text truncate pr-4">{item.title || 'Untitled Project'}</h4>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this project?')) handleRemoveDraft(item.id);
                              }}
                              className="p-2 text-black/10 hover:text-red-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="aspect-video rounded-2xl bg-black/5 overflow-hidden relative">
                            {item.images.length > 0 ? (
                              <img src={item.images[0].url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-black/10">
                                <ImageIcon size={24} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-black/40">{item.images.length} images</span>
                            <span className="text-[10px] font-bold text-brand-text group-hover:underline">Edit details</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[500] bg-white flex flex-col items-center justify-center space-y-6"
          >
            <div className="text-2xl font-bold tracking-[0.3em] uppercase animate-pulse">SKETCHNUB</div>
            <div className="w-12 h-[1px] bg-black/10 relative overflow-hidden">
              <motion.div 
                animate={{ x: [-48, 48] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-black w-full"
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-black/20">Initialising Core</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

