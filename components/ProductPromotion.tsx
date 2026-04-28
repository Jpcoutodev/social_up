import React, { useState, useCallback, useRef } from 'react';
import { ImageIcon, LayoutGrid, Sparkles, Wand2, Plus, Minus, Download, Loader2, RefreshCw, Upload, X, Pencil, Check, XCircle, Hash, User, ShoppingBag } from 'lucide-react';
import { generateSingleCaption, generateCarouselCaptions, getProviderLabel, generateProductPromoImage, generateProductPromoCarousel, fileToDataUrl, ProductImageType } from '../services/captionService';
import { saveImage } from '../services/imageStorageService';

type ContentMode = 'image' | 'carousel';
type Platform = 'instagram' | 'tiktok';

interface CaptionSlide {
  slideNumber: number;
  caption: string;
  imagePrompt: string;
}

export const ProductPromotion: React.FC = () => {
  const [mode, setMode] = useState<ContentMode>('image');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(3);
  const [imageType, setImageType] = useState<ProductImageType>('product');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product Images
  const [productImages, setProductImages] = useState<{ url: string; file: File }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single mode state
  const [singleCaption, setSingleCaption] = useState('');
  const [singleImagePrompt, setSingleImagePrompt] = useState('');
  const [singleHashtags, setSingleHashtags] = useState('');
  const [captionGenerated, setCaptionGenerated] = useState(false);

  // Carousel mode state
  const [carouselSlides, setCarouselSlides] = useState<CaptionSlide[]>([]);
  const [carouselTitle, setCarouselTitle] = useState('');
  const [carouselHashtags, setCarouselHashtags] = useState('');
  const [slidesGenerated, setSlidesGenerated] = useState(false);
  
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [editPromptBuffer, setEditPromptBuffer] = useState('');

  // Generation state
  const [generatingImages, setGeneratingImages] = useState(false);
  const [progress, setProgress] = useState('');
  
  // Results
  const [singleResult, setSingleResult] = useState<{ imageUrl: string; imageWithTextUrl: string } | null>(null);
  const [carouselResult, setCarouselResult] = useState<{ imageUrl: string; imageWithTextUrl: string }[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    const newImages = await Promise.all(
      files.map(async (file) => ({
        url: await fileToDataUrl(file),
        file
      }))
    );
    setProductImages((prev) => [...prev, ...newImages]);
  };

  const removeProductImage = (index: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  // STEP 1: Generate Captions and Prompts
  const handleGenerateCaptions = async () => {
    if (!topic.trim()) {
      setError('Por favor, descreva a promoção.');
      return;
    }

    setLoading(true);
    setError(null);
    setSingleResult(null);
    setCarouselResult([]);

    try {
      if (mode === 'image') {
        const captionResult = await generateSingleCaption(topic, platform);
        // Overriding the AI's imagePrompt with the user's topic so they can see/edit the exact prompt sent to MiniMax
        setSingleImagePrompt(topic); 
        setSingleCaption(captionResult.caption);
        setSingleHashtags(captionResult.hashtags);
        setCaptionGenerated(true);
      } else {
        const captionResult = await generateCarouselCaptions(topic, platform, slideCount);
        // Map slides to pre-fill the image prompt with the topic context
        setCarouselSlides(captionResult.slides.map(s => ({
            ...s,
            imagePrompt: `${topic}. ${s.imagePrompt}`
        })));
        setCarouselTitle(captionResult.title);
        setCarouselHashtags(captionResult.hashtags);
        setSlidesGenerated(true);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar textos');
    } finally {
      setLoading(false);
    }
  };

  // Carousel editing functions
  const startEditSlide = (index: number) => { 
    setEditingSlide(index); 
    setEditBuffer(carouselSlides[index].caption); 
    setEditPromptBuffer(carouselSlides[index].imagePrompt);
  };
  const confirmEditSlide = () => {
    if (editingSlide === null) return;
    const updated = [...carouselSlides];
    updated[editingSlide] = { ...updated[editingSlide], caption: editBuffer, imagePrompt: editPromptBuffer };
    setCarouselSlides(updated); 
    setEditingSlide(null); 
    setEditBuffer(''); 
    setEditPromptBuffer('');
  };
  const cancelEditSlide = () => { setEditingSlide(null); setEditBuffer(''); setEditPromptBuffer(''); };

  // STEP 2: Generate Images using edited prompts
  const handleGenerateImages = async () => {
    if (productImages.length === 0) {
      setError('Por favor, adicione pelo menos uma imagem do produto.');
      return;
    }

    setGeneratingImages(true);
    setError(null);
    setSingleResult(null);
    setCarouselResult([]);

    try {
      if (mode === 'image') {
        setProgress('Gerando imagem com o produto...');
        const imgResult = await generateProductPromoImage(
          productImages[0].url,
          singleImagePrompt, // User edited prompt
          platform,
          singleCaption, // User edited caption
          imageType,
          setProgress
        );
        
        setSingleResult(imgResult);
        
        // Auto-save
        await saveImage({
          type: 'image',
          platform,
          topic,
          caption: singleCaption,
          hashtags: singleHashtags,
          imageUrl: imgResult.imageUrl,
          imageWithTextUrl: imgResult.imageWithTextUrl,
        });

      } else {
        setProgress('Gerando imagens do carrossel...');
        const imgsResult = await generateProductPromoCarousel(
          productImages.map(img => img.url),
          carouselSlides.map(s => ({ prompt: s.imagePrompt, caption: s.caption })), // User edited prompts/captions
          platform,
          imageType,
          (curr, total) => setProgress(`Gerando imagem ${curr}/${total}...`)
        );
        
        setCarouselResult(imgsResult);
        
        // Auto-save
        await saveImage({
          type: 'carousel',
          platform,
          topic,
          caption: carouselTitle,
          hashtags: carouselHashtags,
          imageUrl: imgsResult[0]?.imageUrl || '',
          imageWithTextUrl: imgsResult[0]?.imageWithTextUrl || '',
          title: carouselTitle,
          slides: imgsResult.map((r, i) => ({
            caption: carouselSlides[i]?.caption || '',
            imagePrompt: carouselSlides[i]?.imagePrompt || '',
            imageUrl: r.imageUrl,
            imageWithTextUrl: r.imageWithTextUrl,
          })),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar imagens');
    } finally {
      setGeneratingImages(false);
      setProgress('');
    }
  };

  const isGenerated = mode === 'image' ? captionGenerated : slidesGenerated;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* LEFT: Control Panel */}
      <div className="w-full md:w-[400px] flex-shrink-0 p-6 border-r border-slate-700 flex flex-col bg-slate-800 h-full overflow-y-auto">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Sparkles className="text-emerald-400" size={22} />
          Divulgação de Produtos
        </h2>

        <div className="space-y-5">
          {/* Image Type Selector — drives which AI is used to preserve the reference */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">O que está na sua foto?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImageType('product')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${imageType === 'product' ? 'bg-violet-600/15 border-violet-600/40 text-violet-300 shadow-lg shadow-violet-900/10' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >
                <ShoppingBag size={16} /> Produto
              </button>
              <button
                onClick={() => setImageType('person')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${imageType === 'person' ? 'bg-orange-600/15 border-orange-600/40 text-orange-300 shadow-lg shadow-orange-900/10' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >
                <User size={16} /> Pessoa
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              {imageType === 'product'
                ? 'Gemini preserva o produto da imagem (ideal para objetos, roupas, embalagens).'
                : 'MiniMax preserva a pessoa da imagem (ideal para modelo, rosto, retrato).'}
            </p>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setMode('image'); setCaptionGenerated(false); }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${mode === 'image' ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                <ImageIcon size={16} /> Imagem Única
              </button>
              <button onClick={() => { setMode('carousel'); setSlidesGenerated(false); }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${mode === 'carousel' ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                <LayoutGrid size={16} /> Carrossel
              </button>
            </div>
          </div>

          {mode === 'carousel' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Número de Slides</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSlideCount(Math.max(2, slideCount - 1))} className="w-10 h-10 rounded-lg bg-slate-900 text-slate-300 flex items-center justify-center"><Minus size={16} /></button>
                <div className="flex-1 text-center font-bold text-white text-xl">{slideCount}</div>
                <button onClick={() => setSlideCount(Math.min(10, slideCount + 1))} className="w-10 h-10 rounded-lg bg-slate-900 text-slate-300 flex items-center justify-center"><Plus size={16} /></button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Ideia da Promoção (Topic)</label>
            <textarea 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Modelo usando a bolsa em Paris, estilo editorial de moda..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 resize-none h-24 focus:border-emerald-500 outline-none"
            />
          </div>

          {error && <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-900/50">{error}</div>}

          {!isGenerated ? (
            <button 
              onClick={handleGenerateCaptions}
              disabled={loading || !topic.trim()}
              className="w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {loading ? 'Gerando textos...' : 'Gerar Textos'}
            </button>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-700">
               {/* Product Images Upload (Only required before generating images) */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Imagens do Produto (Referência)</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-lg border border-slate-600 overflow-hidden group">
                      <img src={img.url} className="w-full h-full object-cover" alt="Produto" />
                      <button onClick={() => removeProductImage(idx)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 flex-shrink-0 rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-400 transition-colors"
                  >
                    <Upload size={20} />
                    <span className="text-[10px] mt-1">Add Foto</span>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
                </div>
              </div>
              
              <button 
                onClick={handleGenerateImages}
                disabled={generatingImages || productImages.length === 0}
                className="w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50"
              >
                {generatingImages ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                {generatingImages ? progress || 'Gerando Imagens...' : 'Gerar Imagens'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 bg-slate-950 p-8 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-2xl space-y-6">
          
          {/* SINGLE MODE EDITING */}
          {mode === 'image' && captionGenerated && !singleResult && !generatingImages && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Prompt da Imagem</div>
                <textarea 
                  value={singleImagePrompt} 
                  onChange={(e) => setSingleImagePrompt(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm text-slate-200 resize-none h-24 focus:border-emerald-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-2">Dica: Adicione detalhes de estilo e cenário. O produto principal será mantido da imagem de referência.</p>
              </div>
              
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div className="text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">Legenda da Publicação</div>
                <textarea 
                  value={singleCaption} 
                  onChange={(e) => setSingleCaption(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm text-slate-200 resize-none h-32 focus:border-pink-500 outline-none"
                />
              </div>

              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-3"><Hash size={14} />Hashtags</div>
                <textarea value={singleHashtags} onChange={(e) => setSingleHashtags(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm text-cyan-300 resize-none focus:border-cyan-500 outline-none h-16" />
              </div>
            </div>
          )}

          {/* CAROUSEL MODE EDITING */}
          {mode === 'carousel' && slidesGenerated && carouselResult.length === 0 && !generatingImages && (
            <div className="space-y-4">
               <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                  <div className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">Título do Carrossel</div>
                  <input value={carouselTitle} onChange={(e) => setCarouselTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-lg font-bold text-white focus:border-orange-500 outline-none" />
              </div>

              {carouselSlides.map((slide, idx) => (
                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold">{slide.slideNumber}</span>
                    {editingSlide !== idx && (
                      <button onClick={() => startEditSlide(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><Pencil size={14} /></button>
                    )}
                  </div>
                  
                  {editingSlide === idx ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Prompt da Imagem</div>
                        <textarea value={editPromptBuffer} onChange={(e) => setEditPromptBuffer(e.target.value)} className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg p-2 text-sm text-slate-300 resize-none focus:border-emerald-500 outline-none h-20" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Legenda do Slide</div>
                        <textarea value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg p-2 text-sm text-slate-200 resize-none focus:border-emerald-500 outline-none h-20" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEditSlide} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-1"><XCircle size={12} /> Cancelar</button>
                        <button onClick={confirmEditSlide} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1"><Check size={12} /> Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-200">{slide.caption}</p>
                      <p className="text-xs text-slate-500 italic border-t border-slate-700 pt-2"><span className="font-semibold not-italic">Prompt:</span> {slide.imagePrompt}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SINGLE MODE RESULT */}
          {singleResult && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-emerald-500/30">
                 <span className="text-emerald-400 text-sm font-bold">Imagem Gerada com Sucesso!</span>
                 <a href={singleResult.imageWithTextUrl} download="promo.png" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                   <Download size={16} /> Baixar
                 </a>
              </div>
              <img src={singleResult.imageWithTextUrl} alt="Resultado" className="w-full rounded-xl border border-slate-700 shadow-2xl" />
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-slate-300 text-sm whitespace-pre-wrap">
                <span className="font-bold text-white block mb-2">Legenda Final:</span>
                {singleCaption}
                <div className="mt-4 text-cyan-400">{singleHashtags}</div>
              </div>
            </div>
          )}
          
          {/* CAROUSEL MODE RESULT */}
          {carouselResult.length > 0 && (
            <div className="space-y-6">
              <div className="bg-slate-800 p-4 rounded-xl border border-emerald-500/30 text-emerald-400 text-sm font-bold">
                 Carrossel Gerado com Sucesso! (As imagens foram salvas em Minhas Imagens)
              </div>
              <div className="grid grid-cols-2 gap-4">
                {carouselResult.map((res, i) => (
                  <div key={i} className="space-y-2 bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 text-sm font-bold">Slide {i + 1}</span>
                      <a href={res.imageWithTextUrl} download={`slide-${i+1}.png`} className="text-slate-400 hover:text-white p-1 bg-slate-700 rounded-md"><Download size={14} /></a>
                    </div>
                    <img src={res.imageWithTextUrl} alt={`Slide ${i}`} className="w-full rounded-lg border border-slate-600" />
                    <p className="text-xs text-slate-300 mt-2">{carouselSlides[i].caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {!isGenerated && !generatingImages && (
            <div className="text-center text-slate-600 mt-20">
              <Sparkles size={64} className="mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold">Gerador de Promos</h3>
              <p className="mt-2 text-sm max-w-sm mx-auto">
                Descreva a ideia da campanha. A IA vai gerar os roteiros e prompts. Depois você poderá editar os detalhes antes de gerar a imagem com o seu produto real.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
