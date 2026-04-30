/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, X, Instagram, Mail, ArrowRight, CheckCircle2, 
  ExternalLink, ChevronLeft, ChevronRight, Settings, 
  Dribbble, Github, Image as ImageIcon
} from 'lucide-react';
import { Category, PortfolioItem } from './types';
import { INITIAL_PORTFOLIO, CATEGORIES } from './constants';

export default function App() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('Illustration');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [currentModalImageIdx, setCurrentModalImageIdx] = useState(0);
  const [currentFlatIdx, setCurrentFlatIdx] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [draftPortfolio, setDraftPortfolio] = useState<PortfolioItem[]>([]);
  
  // Initialize portfolio from localStorage or constants
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sketchnub_portfolio');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Migration: convert imageUrls to images if necessary
          const migrated = parsed.map((item: any) => {
            if (item.imageUrls && !item.images) {
              return {
                ...item,
                images: item.imageUrls.map((url: string) => ({ url, title: item.title })),
                imageUrls: undefined
              };
            }
            return item;
          });
          setPortfolio(migrated);
          setDraftPortfolio(migrated);
        } else {
          setPortfolio(INITIAL_PORTFOLIO);
          setDraftPortfolio(INITIAL_PORTFOLIO);
        }
      } else {
        setPortfolio(INITIAL_PORTFOLIO);
        setDraftPortfolio(INITIAL_PORTFOLIO);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setPortfolio(INITIAL_PORTFOLIO);
      setDraftPortfolio(INITIAL_PORTFOLIO);
    }
  }, [isAdminAuthenticated]);

  const filteredPortfolio = useMemo(() => {
    if (activeCategory === 'All') return portfolio;
    return portfolio.filter(item => item.category === activeCategory);
  }, [portfolio, activeCategory]);

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

  // Keep modal index in bounds
  useEffect(() => {
    if (selectedItem) {
      if (currentModalImageIdx >= selectedItem.images.length) {
        setCurrentModalImageIdx(Math.max(0, selectedItem.images.length - 1));
      }
    }
  }, [selectedItem, currentModalImageIdx]);

  const handleAdminAuth = () => {
    if (adminPassword === '2892') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleBulkSave = () => {
    setPortfolio(draftPortfolio);
    localStorage.setItem('sketchnub_portfolio', JSON.stringify(draftPortfolio));
    setIsAdminAuthenticated(false);
    setIsAdminMode(false);
    alert('변경사항이 성공적으로 저장되었습니다.');
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

  const handleDraftFileChange = (id: string, files: FileList | null) => {
    if (!files) return;
    const project = draftPortfolio.find(p => p.id === id);
    if (!project) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setDraftPortfolio(prev => prev.map(item => 
          item.id === id ? { ...item, images: [...item.images, { url: result, title: item.title }] } : item
        ));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImageFromDraft = (projectId: string, imageIdx: number) => {
    setDraftPortfolio(prev => prev.map(item => {
      if (item.id === projectId) {
        const newImages = [...item.images];
        newImages.splice(imageIdx, 1);
        return { ...item, images: newImages };
      }
      return item;
    }));
  };

  const updateImageTitleInDraft = (projectId: string, imageIdx: number, title: string) => {
    setDraftPortfolio(prev => prev.map(item => {
      if (item.id === projectId) {
        const newImages = [...item.images];
        newImages[imageIdx] = { ...newImages[imageIdx], title };
        return { ...item, images: newImages };
      }
      return item;
    }));
  };

  const handlePrevImage = () => {
    if (allCategoryImages.length === 0) return;
    setCurrentFlatIdx((prev) => (prev - 1 + allCategoryImages.length) % allCategoryImages.length);
  };

  const handleNextImage = () => {
    if (allCategoryImages.length === 0) return;
    setCurrentFlatIdx((prev) => (prev + 1) % allCategoryImages.length);
  };

  const handlePrevModalImage = () => {
    if (!selectedItem) return;
    setCurrentModalImageIdx((prev) => (prev - 1 + selectedItem.images.length) % selectedItem.images.length);
  };

  const handleNextModalImage = () => {
    if (!selectedItem) return;
    setCurrentModalImageIdx((prev) => (prev + 1) % selectedItem.images.length);
  };

  return (
    <div className="min-h-screen selection:bg-black selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-10 h-24 flex items-center justify-between">
          <a href="#" className="text-xl font-bold tracking-[0.2em] uppercase">SKETCHNUB</a>
          
          <div className="flex items-center gap-12">
            {/* Categories in Nav - Right Aligned */}
            <div className="hidden md:flex items-center gap-10 text-[10px] font-bold uppercase tracking-[0.3em]">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as Category)}
                  className={`transition-colors py-2 ${activeCategory === cat ? 'text-black border-b border-black' : 'text-black/30 hover:text-black hover:border-b hover:border-black/20'}`}
                >
                  {cat}
                </button>
              ))}
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
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat as Category); setIsMenuOpen(false); }}
                    className={`text-2xl font-bold uppercase tracking-widest transition-colors ${activeCategory === cat ? 'text-black' : 'text-black/30'}`}
                  >
                    {cat}
                  </button>
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
        <section id="portfolio" className="py-20 bg-white min-h-[80vh] flex flex-col">
          <div className="px-10 mb-8">
            <h2 className="text-3xl font-medium tracking-tight text-brand-text">
              {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1).toLowerCase()}
            </h2>
          </div>

          <div className="relative flex-1 flex flex-col justify-center px-10">
            <div className="relative w-full max-w-[1700px] mx-auto overflow-hidden group min-h-[60vh] md:min-h-[85vh] flex items-center justify-center">
              <AnimatePresence mode="wait">
                {allCategoryImages.length > 0 && allCategoryImages[currentFlatIdx] ? (
                  <motion.div
                    key={allCategoryImages[currentFlatIdx].url}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => {
                      setSelectedItem(allCategoryImages[currentFlatIdx].item);
                      setCurrentModalImageIdx(allCategoryImages[currentFlatIdx].idx);
                    }}
                  >
                    <img 
                      src={allCategoryImages[currentFlatIdx].url} 
                      alt={allCategoryImages[currentFlatIdx].title}
                      className="w-full h-full object-contain transition-all duration-1000 group-hover:scale-[1.02]"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-full text-black/20 uppercase tracking-[0.5em] font-bold">
                    No content detected in {activeCategory}
                  </div>
                )}
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
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 mb-2">
                  {allCategoryImages[currentFlatIdx].item.application}
                </p>
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
                    className="p-6 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white hover:text-black transition-all shadow-xl"
                  >
                    <ChevronLeft size={32} />
                  </button>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-14 z-20">
                  <button 
                    onClick={handleNextImage}
                    className="p-6 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white hover:text-black transition-all shadow-xl"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-center gap-2 py-10">
            {allCategoryImages.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentFlatIdx(i)}
                className={`h-0.5 transition-all duration-500 ${i === currentFlatIdx ? 'w-12 bg-black' : 'w-4 bg-black/10 hover:bg-black/30'}`}
              />
            ))}
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
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
          >
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-10 right-10 p-4 text-black/40 hover:text-black transition-colors z-[110]"
            >
              <X size={40} />
            </button>
            
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full flex items-center justify-center group p-4 md:p-10">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={selectedItem.images[currentModalImageIdx]?.url || 'default'} 
                    src={selectedItem.images[currentModalImageIdx]?.url || 'https://via.placeholder.com/1200x1200?text=No+Image'} 
                    alt={selectedItem.images[currentModalImageIdx]?.title || selectedItem.title}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full object-contain pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {selectedItem.images.length > 1 && (
                  <>
                    <button 
                      onClick={handlePrevModalImage}
                      className="absolute left-10 top-1/2 -translate-y-1/2 p-6 bg-white/50 backdrop-blur-md hover:bg-black hover:text-white transition-all text-black/40 rounded-full border border-black/5 shadow-sm"
                    >
                      <ChevronLeft size={32} />
                    </button>
                    <button 
                      onClick={handleNextModalImage}
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-6 bg-white/50 backdrop-blur-md hover:bg-black hover:text-white transition-all text-black/40 rounded-full border border-black/5 shadow-sm"
                    >
                      <ChevronRight size={32} />
                    </button>
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
                       {selectedItem.images.map((_, i) => (
                         <div 
                           key={i} 
                           onClick={() => setCurrentModalImageIdx(i)}
                           className={`h-0.5 cursor-pointer transition-all duration-500 ${i === currentModalImageIdx ? 'w-16 bg-black' : 'w-4 bg-black/10 hover:bg-black/30'}`} 
                         />
                       ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Portal Modal */}
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
              <h2 className="text-xl font-bold tracking-tight">SKETCHNUB 관리자</h2>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => { setIsAdminMode(false); setIsAdminAuthenticated(false); }}
                  className="text-sm font-medium text-brand-muted hover:text-brand-text transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleBulkSave}
                  disabled={!isAdminAuthenticated}
                  className="px-6 py-2 bg-[#7557F1] text-white rounded-lg text-sm font-bold shadow-lg shadow-purple-500/20 hover:opacity-90 transition-opacity disabled:grayscale"
                >
                  변경사항 저장
                </button>
              </div>
            </header>

            <div className="max-w-7xl mx-auto p-12">
              {!isAdminAuthenticated ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 bg-white rounded-[40px] shadow-sm">
                  <div className="text-center">
                    <Settings className="mx-auto mb-6 text-brand-text" size={48} />
                    <h3 className="text-3xl font-serif">Admin Access</h3>
                    <p className="text-brand-muted mt-2">관리자 암호를 입력해주세요.</p>
                  </div>
                  
                  <div className="w-full max-w-sm space-y-4">
                    <input 
                      type="password" 
                      placeholder="Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-6 py-4 bg-brand-accent rounded-2xl border-2 border-transparent focus:border-brand-text outline-none transition-all text-center text-xl tracking-widest"
                      onKeyPress={(e) => e.key === 'Enter' && handleAdminAuth()}
                    />
                    <button 
                      onClick={handleAdminAuth}
                      className="w-full py-4 bg-brand-text text-white rounded-2xl font-bold shadow-xl hover:bg-brand-muted transition-colors"
                    >
                      Login to Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Add Project Button */}
                  <button 
                    onClick={handleAddProject}
                    className="w-full h-40 border-2 border-dashed border-black/10 rounded-[40px] flex flex-col items-center justify-center gap-2 hover:border-brand-text hover:bg-white transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center text-brand-muted group-hover:bg-brand-text group-hover:text-white transition-colors">
                      <ImageIcon size={20} />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-muted group-hover:text-brand-text">포트폴리오 프로젝트 추가</span>
                  </button>

                  {/* Project Grid */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {draftPortfolio.map((item) => (
                      <div key={item.id} className="bg-white rounded-[40px] p-10 shadow-sm space-y-8 relative group">
                        <button 
                          onClick={() => handleRemoveDraft(item.id)}
                          className="absolute top-6 right-6 p-2 bg-brand-accent text-brand-muted hover:bg-red-500 hover:text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X size={16} />
                        </button>

                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">CATEGORY</label>
                            <select 
                              value={item.category}
                              onChange={(e) => handleUpdateDraft(item.id, { category: e.target.value as Category })}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text appearance-none cursor-pointer"
                            >
                              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">APPLICATION</label>
                            <input 
                              type="text" 
                              value={item.application}
                              onChange={(e) => handleUpdateDraft(item.id, { application: e.target.value })}
                              className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text font-medium"
                              placeholder="e.g. Logo Design"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">PROJECT TITLE</label>
                          <input 
                            type="text" 
                            value={item.title}
                            onChange={(e) => handleUpdateDraft(item.id, { title: e.target.value })}
                            className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text font-bold"
                            placeholder="Title"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">DESCRIPTION</label>
                          <textarea 
                            value={item.description}
                            onChange={(e) => handleUpdateDraft(item.id, { description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 bg-brand-accent rounded-xl outline-none focus:ring-1 focus:ring-brand-text text-sm resize-none"
                            placeholder="Description"
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest text-[#B5B5B5] font-bold">IMAGE MANAGER (Titles & Order)</label>
                          <div className="grid grid-cols-1 gap-4">
                            {item.images.map((img, idx) => (
                              <div key={idx} className="flex gap-4 items-center bg-brand-accent p-4 rounded-2xl relative group/img">
                                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-black/5 shadow-sm">
                                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <label className="text-[8px] uppercase tracking-widest text-black/30 font-bold">IMAGE TITLE</label>
                                  <input 
                                    type="text"
                                    value={img.title || ''}
                                    placeholder="이미지 전용 타이틀 (비워두면 프로젝트 제목 사용)"
                                    onChange={(e) => updateImageTitleInDraft(item.id, idx, e.target.value)}
                                    className="w-full px-3 py-1 bg-white/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-text text-xs"
                                  />
                                </div>
                                <button 
                                  onClick={() => removeImageFromDraft(item.id, idx)}
                                  className="p-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <label className="h-20 rounded-2xl border-2 border-dashed border-brand-accent flex items-center justify-center text-brand-muted hover:border-brand-text hover:text-brand-text cursor-pointer transition-colors mt-2">
                              <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleDraftFileChange(item.id, e.target.files)}
                              />
                              <div className="flex items-center gap-2">
                                <ImageIcon size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Add Images</span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

