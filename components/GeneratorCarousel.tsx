import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageIcon, LayoutGrid, Sparkles, Wand2, Plus, Minus, Pencil, Check, XCircle, Instagram, Hash, Bot, Zap, Lightbulb, Download, Loader2, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { getProvider } from '../services/geminiService';
import { generateSingleCaption, generateCarouselCaptions, getProviderLabel, suggestTopic, generatePostImage, generateCarouselImagesFromSlides, overlayTextOnImage } from '../services/captionService';
import { saveImage } from '../services/imageStorageService';
import { AIProvider } from '../types';

type ContentMode = 'image' | 'carousel';
type Platform = 'instagram' | 'tiktok';

interface CaptionSlide {
  slideNumber: number;
  caption: string;
  imagePrompt: string;
}

export const GeneratorCarousel: React.FC = () => {
  const [mode, setMode] = useState<ContentMode>('image');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<AIProvider>('gemini');

  // Single image state
  const [singleCaption, setSingleCaption] = useState('');
  const [singleImagePrompt, setSingleImagePrompt] = useState('');
  const [singleHashtags, setSingleHashtags] = useState('');
  const [captionGenerated, setCaptionGenerated] = useState(false);

  // Carousel state
  const [carouselSlides, setCarouselSlides] = useState<CaptionSlide[]>([]);
  const [carouselTitle, setCarouselTitle] = useState('');
  const [carouselHashtags, setCarouselHashtags] = useState('');
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [slidesGenerated, setSlidesGenerated] = useState(false);

  // Image generation state
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState('');
  const [singleImageUrl, setSingleImageUrl] = useState<string | null>(null);
  const [singleImageWithTextUrl, setSingleImageWithTextUrl] = useState<string | null>(null);
  const [carouselImageUrls, setCarouselImageUrls] = useState<{imageUrl: string; imageWithTextUrl: string}[]>([]);
  const [carouselPreviewIndex, setCarouselPreviewIndex] = useState(0);
  const [showWithText, setShowWithText] = useState(true);
  const [fontScale, setFontScale] = useState(1.0);

  // Live overlay re-render refs
  const [liveOverlayUrl, setLiveOverlayUrl] = useState<string | null>(null);
  const [liveCarouselOverlays, setLiveCarouselOverlays] = useState<string[]>([]);
  const overlayTimer = useRef<any>(null);

  // Refresh provider on mount/focus
  const refreshProvider = useCallback(() => setActiveProvider(getProvider()), []);
  useEffect(() => {
    refreshProvider();
    window.addEventListener('focus', refreshProvider);
    return () => window.removeEventListener('focus', refreshProvider);
  }, [refreshProvider]);

  // --- Handlers ---
  const handleGenerateSingle = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(null); setCaptionGenerated(false);
    refreshProvider();
    try {
      const result = await generateSingleCaption(topic, platform);
      setSingleCaption(result.caption);
      setSingleImagePrompt(result.imagePrompt);
      setSingleHashtags(result.hashtags);
      setCaptionGenerated(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate caption');
    } finally { setLoading(false); }
  }, [topic, platform, refreshProvider]);

  const handleGenerateCarousel = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(null); setSlidesGenerated(false);
    refreshProvider();
    try {
      const result = await generateCarouselCaptions(topic, platform, slideCount);
      setCarouselSlides(result.slides);
      setCarouselTitle(result.title);
      setCarouselHashtags(result.hashtags);
      setSlidesGenerated(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate carousel captions');
    } finally { setLoading(false); }
  }, [topic, platform, slideCount, refreshProvider]);

  const startEditSlide = (index: number) => { setEditingSlide(index); setEditBuffer(carouselSlides[index].caption); };
  const confirmEditSlide = () => {
    if (editingSlide === null) return;
    const updated = [...carouselSlides];
    updated[editingSlide] = { ...updated[editingSlide], caption: editBuffer };
    setCarouselSlides(updated); setEditingSlide(null); setEditBuffer('');
  };
  const cancelEditSlide = () => { setEditingSlide(null); setEditBuffer(''); };

  const handleReset = () => {
    setTopic(''); setSingleCaption(''); setSingleImagePrompt(''); setSingleHashtags('');
    setCaptionGenerated(false); setCarouselSlides([]); setCarouselTitle('');
    setCarouselHashtags(''); setSlidesGenerated(false); setError(null);
    setSingleImageUrl(null); setSingleImageWithTextUrl(null); setCarouselImageUrls([]); setCarouselPreviewIndex(0); setShowWithText(true); setFontScale(1.0); setLiveOverlayUrl(null); setLiveCarouselOverlays([]);
  };

  const handleSuggest = useCallback(async () => {
    setSuggesting(true); setError(null);
    refreshProvider();
    try {
      const suggested = await suggestTopic(platform, mode);
      setTopic(suggested);
    } catch (err: any) {
      setError(err.message || 'Failed to suggest topic');
    } finally { setSuggesting(false); }
  }, [platform, mode, refreshProvider]);

  const handleGenerateImage = useCallback(async () => {
    setGeneratingImages(true); setError(null);
    refreshProvider();
    try {
      const result = await generatePostImage(singleImagePrompt, platform, singleCaption, setImageProgress);
      setSingleImageUrl(result.imageUrl);
      setSingleImageWithTextUrl(result.imageWithTextUrl);
      // Auto-save to My Images
      saveImage({
        type: 'image',
        platform,
        topic,
        caption: singleCaption,
        hashtags: singleHashtags,
        imageUrl: result.imageUrl,
        imageWithTextUrl: result.imageWithTextUrl,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate image');
    } finally { setGeneratingImages(false); setImageProgress(''); }
  }, [singleImagePrompt, singleCaption, singleHashtags, topic, platform, refreshProvider]);

  const handleGenerateCarouselImages = useCallback(async () => {
    setGeneratingImages(true); setError(null); setCarouselImageUrls([]); setCarouselPreviewIndex(0);
    refreshProvider();
    try {
      const results = await generateCarouselImagesFromSlides(
        carouselSlides.map(s => ({ imagePrompt: s.imagePrompt, caption: s.caption })),
        platform,
        (current, total) => setImageProgress(`Generating image ${current}/${total}...`)
      );
      setCarouselImageUrls(results);
      // Auto-save to My Images
      saveImage({
        type: 'carousel',
        platform,
        topic,
        caption: carouselTitle,
        hashtags: carouselHashtags,
        imageUrl: results[0]?.imageUrl || '',
        imageWithTextUrl: results[0]?.imageWithTextUrl || '',
        title: carouselTitle,
        slides: results.map((r, i) => ({
          caption: carouselSlides[i]?.caption || '',
          imageUrl: r.imageUrl,
          imageWithTextUrl: r.imageWithTextUrl,
        })),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate carousel images');
    } finally { setGeneratingImages(false); setImageProgress(''); }
  }, [carouselSlides, carouselTitle, carouselHashtags, topic, platform, refreshProvider]);

  // Re-render overlay when fontScale changes (debounced)
  useEffect(() => {
    if (!showWithText) return;
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(async () => {
      // Single image
      if (singleImageUrl && singleCaption) {
        const updated = await overlayTextOnImage(singleImageUrl, singleCaption, fontScale);
        setLiveOverlayUrl(updated);
      }
      // Carousel
      if (carouselImageUrls.length > 0 && carouselSlides.length > 0) {
        const overlays: string[] = [];
        for (let i = 0; i < carouselImageUrls.length; i++) {
          const caption = carouselSlides[i]?.caption || '';
          const o = await overlayTextOnImage(carouselImageUrls[i].imageUrl, caption, fontScale);
          overlays.push(o);
        }
        setLiveCarouselOverlays(overlays);
      }
    }, 300);
    return () => clearTimeout(overlayTimer.current);
  }, [fontScale, singleImageUrl, singleCaption, carouselImageUrls, carouselSlides, showWithText]);

  const isGenerated = mode === 'image' ? captionGenerated : slidesGenerated;
  const providerBadgeClass = activeProvider === 'openai'
    ? 'bg-green-900/30 border-green-700 text-green-400'
    : activeProvider === 'minimax'
      ? 'bg-orange-900/30 border-orange-700 text-orange-400'
      : 'bg-purple-900/30 border-purple-700 text-purple-400';
  const ProviderIcon = activeProvider === 'openai' ? Bot : activeProvider === 'minimax' ? Zap : Sparkles;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* LEFT: Control Panel */}
      <div className="w-full md:w-[400px] flex-shrink-0 p-6 border-r border-slate-700 flex flex-col z-10 bg-slate-800 h-full overflow-y-auto custom-scrollbar">
        <div className="flex-1 flex flex-col space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ImageIcon className="text-pink-400" size={22} />
              Image / Carrossel
            </h2>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${providerBadgeClass}`}>
              <ProviderIcon size={12} />
              {getProviderLabel(activeProvider)}
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setMode('image'); handleReset(); }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${mode === 'image' ? 'bg-pink-600/15 border-pink-600/40 text-pink-300 shadow-lg shadow-pink-900/10' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                <ImageIcon size={16} /> Single Image
              </button>
              <button onClick={() => { setMode('carousel'); handleReset(); }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${mode === 'carousel' ? 'bg-orange-600/15 border-orange-600/40 text-orange-300 shadow-lg shadow-orange-900/10' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                <LayoutGrid size={16} /> Carousel
              </button>
            </div>
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Platform</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPlatform('instagram')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${platform === 'instagram' ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-pink-500/40 text-pink-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                <Instagram size={15} /> Instagram
              </button>
              <button onClick={() => setPlatform('tiktok')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${platform === 'tiktok' ? 'bg-cyan-600/15 border-cyan-500/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.01a8.23 8.23 0 004.76 1.52V7.08a4.85 4.85 0 01-1-.39z"/></svg>
                TikTok
              </button>
            </div>
          </div>

          {/* Slide Count (carousel only) */}
          {mode === 'carousel' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Number of Slides</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSlideCount(Math.max(2, slideCount - 1))} className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-colors"><Minus size={16} /></button>
                <div className="flex-1 text-center"><span className="text-3xl font-bold text-white">{slideCount}</span><span className="text-xs text-slate-500 ml-2">slides</span></div>
                <button onClick={() => setSlideCount(Math.min(15, slideCount + 1))} className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-colors"><Plus size={16} /></button>
              </div>
            </div>
          )}

          {/* Topic Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="carousel-topic" className="block text-sm font-medium text-slate-400">
                {mode === 'image' ? 'Image Topic' : 'Carousel Topic'}
              </label>
              <button
                onClick={handleSuggest}
                disabled={suggesting || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-amber-600/15 border border-amber-500/30 text-amber-300 hover:bg-amber-600/25 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {suggesting ? (
                  <><div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Suggesting...</>
                ) : (
                  <><Lightbulb size={13} /> Suggest Publication</>
                )}
              </button>
            </div>
            <textarea id="carousel-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder={mode === 'image' ? 'e.g., Benefits of meditation...' : 'e.g., 7 tips for productivity...'}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-base focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder-slate-600 resize-none h-24"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mode === 'image' ? handleGenerateSingle() : handleGenerateCarousel(); } }}
            />
          </div>

          {/* Generate / Loading */}
          <div>
            {!loading ? (
              <button onClick={mode === 'image' ? handleGenerateSingle : handleGenerateCarousel} disabled={!topic.trim()}
                className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center space-x-2 transition-all ${!topic.trim() ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : mode === 'image' ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg hover:shadow-pink-500/25' : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg hover:shadow-orange-500/25'}`}>
                <Wand2 size={20} /><span>{mode === 'image' ? 'Generate Caption' : 'Generate Captions'}</span>
              </button>
            ) : (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-3">
                <div className="flex items-center justify-center gap-3 text-sm text-white font-medium">
                  <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  <span>{getProviderLabel(activeProvider)} is thinking...</span>
                </div>
                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
          </div>

          {error && <div className="p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">{error}</div>}

          {isGenerated && (
            <div className="pt-3 border-t border-slate-700">
              {!generatingImages ? (
                <button
                  onClick={mode === 'image' ? handleGenerateImage : handleGenerateCarouselImages}
                  disabled={mode === 'image' ? !singleImagePrompt : carouselSlides.length === 0}
                  className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center space-x-2 transition-all ${mode === 'image'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg hover:shadow-violet-500/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ImageIcon size={18} />
                  <span>{mode === 'image'
                    ? (singleImageUrl ? 'Regenerate Image' : 'Generate Image')
                    : (carouselImageUrls.length > 0 ? 'Regenerate Images' : `Generate ${carouselSlides.length} Images`)}
                  </span>
                </button>
              ) : (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-center gap-3 text-sm text-white font-medium">
                    <Loader2 size={18} className="animate-spin text-emerald-400" />
                    <span>{imageProgress || 'Generating...'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Preview Area */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.5)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />

        {/* SINGLE IMAGE RESULT */}
        {mode === 'image' && captionGenerated && (
          <div className="w-full max-w-lg z-10 space-y-5 overflow-y-auto max-h-full pr-2 custom-scrollbar py-4">
            {/* Generated Image */}
            {singleImageUrl && (
              <div className="bg-slate-800/80 backdrop-blur border border-emerald-700/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider"><ImageIcon size={14} />Generated Image</div>
                  <div className="flex items-center gap-2">
                    {singleImageWithTextUrl && (
                      <button onClick={() => setShowWithText(!showWithText)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors">
                        {showWithText ? <ToggleRight size={14} className="text-emerald-400" /> : <ToggleLeft size={14} />}
                        {showWithText ? 'Caption' : 'Clean'}
                      </button>
                    )}
                    <a href={showWithText && liveOverlayUrl ? liveOverlayUrl : singleImageUrl} download="post_image.png" target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors">
                      <Download size={12} /> Download
                    </a>
                  </div>
                </div>
                {showWithText && singleImageWithTextUrl && (
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">Font</span>
                    <input type="range" min="0.4" max="2.0" step="0.1" value={fontScale}
                      onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                    <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{Math.round(fontScale * 100)}%</span>
                  </div>
                )}
                <img src={showWithText && liveOverlayUrl ? liveOverlayUrl : singleImageUrl} alt="Generated post" className="w-full rounded-xl border border-slate-700 shadow-xl" />
              </div>
            )}
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider"><Sparkles size={14} />AI-Generated Caption</div>
              <textarea value={singleCaption} onChange={(e) => setSingleCaption(e.target.value)} className="w-full bg-slate-900/60 border border-slate-600 rounded-xl p-4 text-sm text-slate-200 leading-relaxed resize-none focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all min-h-[120px]" />
            </div>
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-3"><Hash size={14} />Hashtags</div>
              <textarea value={singleHashtags} onChange={(e) => setSingleHashtags(e.target.value)} className="w-full bg-slate-900/60 border border-slate-600 rounded-xl p-3 text-sm text-cyan-300/80 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all min-h-[60px]" />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Image Prompt (AI Reference)</div>
              <p className="text-xs text-slate-400 leading-relaxed italic">{singleImagePrompt}</p>
            </div>
          </div>
        )}

        {/* CAROUSEL RESULT */}
        {mode === 'carousel' && slidesGenerated && (
          <div className="w-full max-w-2xl z-10 space-y-5 overflow-y-auto max-h-full pr-2 custom-scrollbar py-4">
            {/* Carousel Image Preview */}
            {carouselImageUrls.length > 0 && (
              <div className="bg-slate-800/80 backdrop-blur border border-violet-700/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider">
                    <ImageIcon size={14} />Slide {carouselPreviewIndex + 1} of {carouselImageUrls.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowWithText(!showWithText)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors">
                      {showWithText ? <ToggleRight size={14} className="text-violet-400" /> : <ToggleLeft size={14} />}
                      {showWithText ? 'Caption' : 'Clean'}
                    </button>
                    <a href={showWithText && liveCarouselOverlays[carouselPreviewIndex] ? liveCarouselOverlays[carouselPreviewIndex] : carouselImageUrls[carouselPreviewIndex].imageUrl}
                      download={`carousel_slide_${carouselPreviewIndex + 1}.png`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors">
                      <Download size={12} /> Download
                    </a>
                  </div>
                </div>
                {showWithText && (
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">Font</span>
                    <input type="range" min="0.4" max="2.0" step="0.1" value={fontScale}
                      onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-500" />
                    <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{Math.round(fontScale * 100)}%</span>
                  </div>
                )}
                <div className="relative">
                  <img src={showWithText && liveCarouselOverlays[carouselPreviewIndex] ? liveCarouselOverlays[carouselPreviewIndex] : carouselImageUrls[carouselPreviewIndex].imageUrl}
                    alt={`Slide ${carouselPreviewIndex + 1}`} className="w-full rounded-xl border border-slate-700 shadow-xl" />
                  {carouselImageUrls.length > 1 && (
                    <>
                      <button onClick={() => setCarouselPreviewIndex(Math.max(0, carouselPreviewIndex - 1))}
                        disabled={carouselPreviewIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={() => setCarouselPreviewIndex(Math.min(carouselImageUrls.length - 1, carouselPreviewIndex + 1))}
                        disabled={carouselPreviewIndex === carouselImageUrls.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-30">
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                </div>
                {/* Dots */}
                <div className="flex justify-center gap-1.5">
                  {carouselImageUrls.map((_, i) => (
                    <button key={i} onClick={() => setCarouselPreviewIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === carouselPreviewIndex ? 'bg-violet-400 w-4' : 'bg-slate-600 hover:bg-slate-500'}`} />
                  ))}
                </div>
              </div>
            )}
            <div className="bg-slate-800/80 backdrop-blur border border-orange-700/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2"><Sparkles size={14} />Carousel Title</div>
              <input value={carouselTitle} onChange={(e) => setCarouselTitle(e.target.value)} className="w-full bg-slate-900/60 border border-slate-600 rounded-xl p-3 text-lg font-bold text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all" />
            </div>
            <div className="space-y-3">
              {carouselSlides.map((slide, idx) => (
                <div key={idx} className={`bg-slate-800/70 backdrop-blur border rounded-xl p-4 group hover:border-slate-600 transition-all cursor-pointer ${carouselImageUrls.length > 0 && idx === carouselPreviewIndex ? 'border-violet-500/40' : 'border-slate-700'}`}
                  onClick={() => carouselImageUrls.length > 0 && setCarouselPreviewIndex(idx)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center text-xs font-bold text-white shadow-md">{slide.slideNumber}</span>
                      <span className="text-xs text-slate-500 font-medium">{idx === 0 ? 'Hook' : idx === carouselSlides.length - 1 ? 'CTA' : `Slide ${slide.slideNumber}`}</span>
                    </div>
                    {editingSlide !== idx && (
                      <button onClick={(e) => { e.stopPropagation(); startEditSlide(idx); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><Pencil size={14} /></button>
                    )}
                  </div>
                  {editingSlide === idx ? (
                    <div className="space-y-2">
                      <textarea value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} className="w-full bg-slate-900 border border-orange-500/40 rounded-lg p-3 text-sm text-slate-200 resize-none focus:ring-2 focus:ring-orange-500 outline-none min-h-[80px]" autoFocus />
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEditSlide} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center gap-1"><XCircle size={12} /> Cancel</button>
                        <button onClick={confirmEditSlide} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600 text-white hover:bg-orange-500 transition-colors flex items-center gap-1"><Check size={12} /> Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {carouselImageUrls[idx] && (
                        <img src={carouselImageUrls[idx].imageWithTextUrl} alt={`Slide ${idx+1}`} className="w-16 h-10 rounded-lg object-cover border border-slate-600 flex-shrink-0" />
                      )}
                      <p className="text-sm text-slate-300 leading-relaxed">{slide.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-3"><Hash size={14} />Hashtags</div>
              <textarea value={carouselHashtags} onChange={(e) => setCarouselHashtags(e.target.value)} className="w-full bg-slate-900/60 border border-slate-600 rounded-xl p-3 text-sm text-cyan-300/80 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all min-h-[60px]" />
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isGenerated && !loading && (
          <div className="text-center text-slate-600 space-y-6 z-10">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 border animate-pulse ${mode === 'image' ? 'bg-pink-900/20 border-pink-800/30' : 'bg-orange-900/20 border-orange-800/30'}`}>
              {mode === 'image' ? <ImageIcon size={50} className="opacity-40 text-pink-400" /> : <LayoutGrid size={50} className="opacity-40 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-400 mb-2">{mode === 'image' ? 'Create an Image Post' : 'Create a Carousel'}</h2>
              <p className="max-w-md mx-auto text-slate-500">
                {mode === 'image'
                  ? `Enter a topic to generate an AI-powered caption with ${getProviderLabel(activeProvider)}.`
                  : `Enter a topic to generate a ${slideCount}-slide carousel with ${getProviderLabel(activeProvider)}.`}
              </p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="text-center z-10 space-y-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 ${mode === 'image' ? 'border-pink-500/30' : 'border-orange-500/30'}`}>
              <div className={`w-16 h-16 rounded-full border-4 border-t-transparent animate-spin ${mode === 'image' ? 'border-pink-500' : 'border-orange-500'}`} />
            </div>
            <p className="text-slate-400 font-medium animate-pulse">
              {getProviderLabel(activeProvider)} generating {mode === 'image' ? 'caption' : `${slideCount} slide captions`}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
