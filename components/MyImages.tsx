import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, LayoutGrid, Trash2, Download, Eye, X, ChevronLeft, ChevronRight, Calendar, Hash, MessageSquare, Search, ToggleLeft, ToggleRight, Pencil, Check, AlignStartVertical, AlignCenterVertical, AlignEndVertical, RefreshCw, Loader2 } from 'lucide-react';
import { getSavedImages, deleteImage, SavedImage } from '../services/imageStorageService';
import { overlayTextOnImage, CaptionPosition, generateSingleCarouselImage } from '../services/captionService';
import { supabase } from '../src/lib/supabase';

type FilterType = 'all' | 'image' | 'carousel';

export const MyImages: React.FC = () => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [regeneratingSlide, setRegeneratingSlide] = useState(false);

  // Caption overlay controls
  const [showWithText, setShowWithText] = useState(true);
  const [fontScale, setFontScale] = useState(1.0);
  const [liveOverlayUrl, setLiveOverlayUrl] = useState<string | null>(null);
  const overlayTimer = useRef<any>(null);
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>('bottom');

  // Caption editing
  const [editingCaption, setEditingCaption] = useState(false);
  const [editCaptionBuffer, setEditCaptionBuffer] = useState('');

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

  // Re-render overlay when fontScale, selectedImage, carouselIndex, or captionPosition changes
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
        const result = await overlayTextOnImage(cleanUrl, caption, fontScale, captionPosition);
        setLiveOverlayUrl(result);
      } catch {
        setLiveOverlayUrl(null);
      }
    }, 300);
    return () => clearTimeout(overlayTimer.current);
  }, [fontScale, selectedImage, carouselIndex, showWithText, captionPosition]);

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
    setCaptionPosition('bottom');
    setEditingCaption(false);
  };

  const startEditCaption = () => {
    if (!selectedImage) return;
    const caption = selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]
      ? selectedImage.slides[carouselIndex].caption
      : selectedImage.caption;
    setEditCaptionBuffer(caption);
    setEditingCaption(true);
  };

  const confirmEditCaption = async () => {
    if (!selectedImage) return;
    try {
      const updatedImage = { ...selectedImage };
      if (selectedImage.type === 'carousel' && updatedImage.slides?.[carouselIndex]) {
        const updatedSlides = [...(updatedImage.slides || [])];
        updatedSlides[carouselIndex] = { ...updatedSlides[carouselIndex], caption: editCaptionBuffer };
        updatedImage.slides = updatedSlides;
      } else {
        updatedImage.caption = editCaptionBuffer;
      }

      // Update in Supabase
      const updatePayload: any = {};
      if (selectedImage.type === 'carousel' && updatedImage.slides) {
        updatePayload.slides = updatedImage.slides;
      } else {
        updatePayload.caption = editCaptionBuffer;
      }
      await supabase.from('social_images').update(updatePayload).eq('id', selectedImage.id);

      // Update local state
      setSelectedImage(updatedImage);
      setImages(prev => prev.map(i => i.id === selectedImage.id ? updatedImage : i));
      setEditingCaption(false);
      setLiveOverlayUrl(null); // force re-render overlay
    } catch (e) {
      console.error('Failed to update caption:', e);
      alert('Falha ao atualizar legenda.');
    }
  };

  const handleRegenerateSlide = async () => {
    if (!selectedImage || selectedImage.type !== 'carousel' || !selectedImage.slides) return;
    const slide = selectedImage.slides[carouselIndex];
    if (!slide.imagePrompt) {
      alert('Esta imagem foi salva em uma versão antiga e não possui o prompt armazenado, portanto não pode ser regerada.');
      return;
    }
    
    setRegeneratingSlide(true);
    try {
      const result = await generateSingleCarouselImage(
        { imagePrompt: slide.imagePrompt, caption: slide.caption },
        carouselIndex,
        selectedImage.platform
      );

      const updatedSlides = [...selectedImage.slides];
      updatedSlides[carouselIndex] = { ...slide, ...result };
      
      const updatePayload: any = { slides: updatedSlides };
      const updatedImage = { ...selectedImage, slides: updatedSlides };

      if (carouselIndex === 0) {
        updatePayload.image_url = result.imageUrl;
        updatePayload.image_with_text_url = result.imageWithTextUrl;
        updatedImage.imageUrl = result.imageUrl;
        updatedImage.imageWithTextUrl = result.imageWithTextUrl;
      }
      
      await supabase.from('social_images').update(updatePayload).eq('id', selectedImage.id);

      setSelectedImage(updatedImage);
      setImages(prev => prev.map(i => i.id === selectedImage.id ? updatedImage : i));
      setLiveOverlayUrl(null); // Force overlay refresh
    } catch (e: any) {
      console.error('Failed to regenerate slide:', e);
      alert('Falha ao regerar a imagem do slide. Tente novamente.');
    } finally {
      setRegeneratingSlide(false);
    }
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

              {/* Caption / Font / Position Controls */}
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowWithText(!showWithText)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors">
                      {showWithText ? <ToggleRight size={14} className="text-purple-400" /> : <ToggleLeft size={14} />}
                      {showWithText ? 'Legenda' : 'Limpa'}
                    </button>
                  </div>
                  <a href={getDisplayUrl()} download="image.png" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                    <Download size={12} /> Baixar
                  </a>
                </div>
                {showWithText && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Font scale */}
                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                      <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">Fonte</span>
                      <input type="range" min="0.4" max="2.0" step="0.1" value={fontScale}
                        onChange={(e) => setFontScale(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
                      <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{Math.round(fontScale * 100)}%</span>
                    </div>
                    {/* Position selector */}
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                      <span className="text-[10px] text-slate-500 font-bold uppercase px-1.5">Posição</span>
                      {([{pos: 'top' as CaptionPosition, icon: <AlignStartVertical size={13} />, label: 'Topo'},
                        {pos: 'middle' as CaptionPosition, icon: <AlignCenterVertical size={13} />, label: 'Meio'},
                        {pos: 'bottom' as CaptionPosition, icon: <AlignEndVertical size={13} />, label: 'Embaixo'}] as const).map(({pos, icon, label}) => (
                        <button key={pos} onClick={() => setCaptionPosition(pos)}
                          title={label}
                          className={`p-1.5 rounded-md transition-all ${captionPosition === pos
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Image Display */}
              {selectedImage.type === 'image' ? (
                <img src={getDisplayUrl()} alt={selectedImage.topic}
                  className="w-full max-h-[50vh] object-contain rounded-xl border border-slate-700" />
              ) : (
                <div className="space-y-3">
                  <div className="relative group/img">
                    <img
                      src={getDisplayUrl()}
                      alt={`Slide ${carouselIndex + 1}`}
                      className={`w-full max-h-[50vh] object-contain rounded-xl border border-slate-700 transition-all ${regeneratingSlide ? 'opacity-50 blur-sm' : ''}`}
                    />
                    {regeneratingSlide && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={40} className="text-purple-500 animate-spin drop-shadow-xl" />
                      </div>
                    )}
                    {!regeneratingSlide && selectedImage.slides?.[carouselIndex]?.imagePrompt && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRegenerateSlide(); }}
                        className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 backdrop-blur border border-white/10 opacity-0 group-hover/img:opacity-100 transition-all shadow-lg"
                      >
                        <RefreshCw size={16} className="text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Regerar Slide</span>
                      </button>
                    )}
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

              {/* Editable Caption */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
                    <MessageSquare size={12} />Legenda
                  </div>
                  {!editingCaption ? (
                    <button onClick={startEditCaption}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors">
                      <Pencil size={11} /> Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditingCaption(false)}
                        className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={confirmEditCaption}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors">
                        <Check size={11} /> Salvar
                      </button>
                    </div>
                  )}
                </div>
                {editingCaption ? (
                  <textarea
                    value={editCaptionBuffer}
                    onChange={(e) => setEditCaptionBuffer(e.target.value)}
                    className="w-full bg-slate-900 border border-purple-500/40 rounded-lg p-3 text-sm text-slate-200 leading-relaxed resize-none focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedImage.type === 'carousel' && selectedImage.slides?.[carouselIndex]
                      ? selectedImage.slides[carouselIndex].caption
                      : selectedImage.caption}
                  </p>
                )}
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
