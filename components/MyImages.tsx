import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, LayoutGrid, Trash2, Download, Eye, X, ChevronLeft, ChevronRight, Calendar, Hash, MessageSquare, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { getSavedImages, deleteImage, SavedImage } from '../services/imageStorageService';
import { overlayTextOnImage } from '../services/captionService';

type FilterType = 'all' | 'image' | 'carousel';

export const MyImages: React.FC = () => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Caption overlay controls
  const [showWithText, setShowWithText] = useState(true);
  const [fontScale, setFontScale] = useState(1.0);
  const [liveOverlayUrl, setLiveOverlayUrl] = useState<string | null>(null);
  const overlayTimer = useRef<any>(null);

  const loadImages = useCallback(async () => {
    try {
      const all = await getSavedImages();
      setImages(all);
    } catch (e) {
      console.error('Failed to load images:', e);
    }
  }, []);

  useEffect(() => {
    loadImages();
    window.addEventListener('focus', loadImages);
    return () => window.removeEventListener('focus', loadImages);
  }, [loadImages]);

  // Re-render overlay when fontScale, selectedImage, or carouselIndex changes
  useEffect(() => {
    if (!selectedImage || !showWithText) { setLiveOverlayUrl(null); return; }
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(async () => {
      try {
        let cleanUrl: string;
        let caption: string;
        if (selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]) {
          cleanUrl = selectedImage.slides[carouselIndex].imageUrl;
          caption = selectedImage.slides[carouselIndex].caption;
        } else {
          cleanUrl = selectedImage.imageUrl;
          caption = selectedImage.caption;
        }
        const result = await overlayTextOnImage(cleanUrl, caption, fontScale);
        setLiveOverlayUrl(result);
      } catch {
        setLiveOverlayUrl(null);
      }
    }, 300);
    return () => clearTimeout(overlayTimer.current);
  }, [fontScale, selectedImage, carouselIndex, showWithText]);

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
      setImages(prev => prev.filter(i => i.id !== id));
      setDeleteConfirm(null);
      if (selectedImage?.id === id) setSelectedImage(null);
    } catch (e) {
      console.error('Failed to delete image:', e);
      alert('Falha ao excluir a imagem. Tente novamente.');
    }
  };

  const openModal = (img: SavedImage) => {
    setSelectedImage(img);
    setCarouselIndex(0);
    setShowWithText(true);
    setFontScale(1.0);
    setLiveOverlayUrl(null);
  };

  const filteredImages = images.filter(img => {
    if (filter !== 'all' && img.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return img.topic.toLowerCase().includes(q) ||
        img.caption.toLowerCase().includes(q) ||
        (img.title || '').toLowerCase().includes(q);
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Get current display URL for the modal
  const getDisplayUrl = () => {
    if (!selectedImage) return '';
    if (showWithText && liveOverlayUrl) return liveOverlayUrl;
    if (!showWithText) {
      if (selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]) {
        return selectedImage.slides[carouselIndex].imageUrl;
      }
      return selectedImage.imageUrl;
    }
    // Fallback to saved with-text version while live overlay is loading
    if (selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]) {
      return selectedImage.slides[carouselIndex].imageWithTextUrl;
    }
    return selectedImage.imageWithTextUrl;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header Controls */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-violet-600 flex items-center justify-center">
              <ImageIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Minhas Imagens</h2>
              <p className="text-xs text-slate-500">{filteredImages.length} ite{filteredImages.length !== 1 ? 'ns' : 'm'}</p>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {(['all', 'image', 'carousel'] as FilterType[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {f === 'all' ? 'Todos' : f === 'image' ? 'Imagens' : 'Carrosséis'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por tema, legenda..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <ImageIcon size={40} className="text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma imagem ainda</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Gere imagens ou carrosséis na aba Gerador. Elas aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredImages.map(img => (
              <div key={img.id}
                className="group bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden hover:border-slate-600 transition-all hover:shadow-xl hover:shadow-purple-900/10">
                {/* Thumbnail */}
                <div className="relative aspect-[3/4] overflow-hidden cursor-pointer"
                  onClick={() => openModal(img)}>
                  <img
                    src={img.type === 'carousel' && img.slides?.[0] ? img.slides[0].imageWithTextUrl : img.imageWithTextUrl}
                    alt={img.topic}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase backdrop-blur ${img.type === 'carousel'
                      ? 'bg-violet-600/80 text-white'
                      : 'bg-pink-600/80 text-white'}`}>
                      {img.type === 'carousel' ? <><LayoutGrid size={10} className="inline mr-1" />{img.slides?.length} slides</> : <><ImageIcon size={10} className="inline mr-1" />Imagem</>}
                    </span>
                  </div>
                  {/* Platform badge */}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase backdrop-blur bg-black/50 text-white">
                      {img.platform}
                    </span>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye size={32} className="text-white" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-white truncate">{img.topic}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{img.caption}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar size={10} />{formatDate(img.createdAt)}
                    </span>
                    <div className="flex gap-1">
                      <a href={img.imageWithTextUrl} download target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-400 transition-colors">
                        <Download size={12} />
                      </a>
                      {deleteConfirm === img.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(img.id)}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold hover:bg-red-500 transition-colors">
                            Sim
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded-lg bg-slate-600 text-white text-[10px] font-bold hover:bg-slate-500 transition-colors">
                            Não
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(img.id)}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-600/30 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox/Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedImage.topic}</h3>
                <p className="text-xs text-slate-500">{formatDate(selectedImage.createdAt)} · {selectedImage.platform}</p>
              </div>
              <button onClick={() => setSelectedImage(null)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Caption / Font Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowWithText(!showWithText)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors">
                    {showWithText ? <ToggleRight size={14} className="text-purple-400" /> : <ToggleLeft size={14} />}
                    {showWithText ? 'Legenda' : 'Limpa'}
                  </button>
                </div>
                {showWithText && (
                  <div className="flex items-center gap-3 flex-1 max-w-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">Fonte</span>
                    <input type="range" min="0.4" max="2.0" step="0.1" value={fontScale}
                      onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
                    <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{Math.round(fontScale * 100)}%</span>
                  </div>
                )}
                <a href={getDisplayUrl()} download="image.png" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                  <Download size={12} /> Baixar
                </a>
              </div>

              {/* Image Display */}
              {selectedImage.type === 'image' ? (
                <img src={getDisplayUrl()} alt={selectedImage.topic}
                  className="w-full max-h-[50vh] object-contain rounded-xl border border-slate-700" />
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img
                      src={getDisplayUrl()}
                      alt={`Slide ${carouselIndex + 1}`}
                      className="w-full max-h-[50vh] object-contain rounded-xl border border-slate-700"
                    />
                    {(selectedImage.slides?.length || 0) > 1 && (
                      <>
                        <button onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                          disabled={carouselIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30">
                          <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setCarouselIndex(Math.min((selectedImage.slides?.length || 1) - 1, carouselIndex + 1))}
                          disabled={carouselIndex === (selectedImage.slides?.length || 1) - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30">
                          <ChevronRight size={18} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex justify-center gap-1.5">
                    {selectedImage.slides?.map((_, i) => (
                      <button key={i} onClick={() => setCarouselIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === carouselIndex ? 'bg-violet-400 w-4' : 'bg-slate-600 hover:bg-slate-500'}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* Caption */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <MessageSquare size={12} />Legenda
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]
                    ? selectedImage.slides[carouselIndex].caption
                    : selectedImage.caption}
                </p>
              </div>

              {/* Hashtags */}
              {selectedImage.hashtags && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Hash size={12} />Hashtags
                  </div>
                  <p className="text-sm text-cyan-300/70">{selectedImage.hashtags}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-700 flex justify-between">
              <button onClick={() => { handleDelete(selectedImage.id); }}
                className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-colors flex items-center gap-2">
                <Trash2 size={14} />Excluir
              </button>
              <a href={getDisplayUrl()}
                download target="_blank" rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors flex items-center gap-2">
                <Download size={14} />Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
