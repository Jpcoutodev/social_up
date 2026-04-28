import React, { useState, useCallback, useRef } from 'react';
import { ImageIcon, LayoutGrid, Sparkles, Wand2, Plus, Minus, Download, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { generateSingleCaption, generateCarouselCaptions, getProviderLabel, generateProductPromoImage, generateProductPromoCarousel, fileToDataUrl } from '../services/captionService';
import { AIProvider } from '../types';

type ContentMode = 'image' | 'carousel';
type Platform = 'instagram' | 'tiktok';

export const ProductPromotion: React.FC = () => {
  const [mode, setMode] = useState<ContentMode>('image');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product Images
  const [productImages, setProductImages] = useState<{ url: string; file: File }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  
  // Results
  const [singleResult, setSingleResult] = useState<{ imageUrl: string; imageWithTextUrl: string; caption: string } | null>(null);
  const [carouselResult, setCarouselResult] = useState<{ imageUrl: string; imageWithTextUrl: string }[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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

  const handleGenerate = async () => {
    if (!topic.trim() || productImages.length === 0) {
      setError('Por favor, adicione pelo menos uma imagem do produto e descreva a promoção.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSingleResult(null);
    setCarouselResult([]);

    try {
      if (mode === 'image') {
        setProgress('Gerando legenda...');
        const captionResult = await generateSingleCaption(topic, platform);
        
        setProgress('Gerando imagem com o produto...');
        const imgResult = await generateProductPromoImage(
          productImages[0].url,
          captionResult.imagePrompt,
          platform,
          captionResult.caption,
          setProgress
        );
        
        setSingleResult({
          ...imgResult,
          caption: captionResult.caption
        });
      } else {
        setProgress('Gerando roteiro do carrossel...');
        const captionResult = await generateCarouselCaptions(topic, platform, slideCount);
        
        setProgress('Gerando imagens do carrossel...');
        const imgsResult = await generateProductPromoCarousel(
          productImages.map(img => img.url),
          captionResult.slides.map(s => ({ prompt: s.imagePrompt, caption: s.caption })),
          platform,
          (curr, total) => setProgress(`Gerando imagem ${curr}/${total}...`)
        );
        
        setCarouselResult(imgsResult);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar divulgação');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* LEFT: Control Panel */}
      <div className="w-full md:w-[400px] flex-shrink-0 p-6 border-r border-slate-700 flex flex-col bg-slate-800 h-full overflow-y-auto">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Sparkles className="text-emerald-400" size={22} />
          Divulgação de Produtos
        </h2>

        <div className="space-y-5">
          {/* Product Images Upload */}
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

          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('image')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${mode === 'image' ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                <ImageIcon size={16} /> Imagem Única
              </button>
              <button onClick={() => setMode('carousel')}
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
            <label className="block text-sm font-medium text-slate-400 mb-2">Ideia da Promoção (Prompt)</label>
            <textarea 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Modelo usando a bolsa em Paris, estilo editorial de moda..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 resize-none h-24 focus:border-emerald-500 outline-none"
            />
          </div>

          {error && <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-900/50">{error}</div>}

          <button 
            onClick={handleGenerate}
            disabled={generating || !topic.trim() || productImages.length === 0}
            className="w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {generating ? progress || 'Gerando...' : 'Gerar Divulgação'}
          </button>
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 bg-slate-950 p-8 flex items-center justify-center overflow-y-auto">
        {singleResult && (
          <div className="max-w-md w-full space-y-4">
            <img src={singleResult.imageWithTextUrl} alt="Resultado" className="w-full rounded-xl border border-slate-700 shadow-2xl" />
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-slate-300 text-sm whitespace-pre-wrap">
              {singleResult.caption}
            </div>
          </div>
        )}
        
        {carouselResult.length > 0 && (
          <div className="max-w-3xl w-full grid grid-cols-2 gap-4">
            {carouselResult.map((res, i) => (
              <div key={i} className="space-y-2">
                <span className="text-emerald-400 text-sm font-bold">Slide {i + 1}</span>
                <img src={res.imageWithTextUrl} alt={`Slide ${i}`} className="w-full rounded-xl border border-slate-700" />
              </div>
            ))}
          </div>
        )}

        {!singleResult && carouselResult.length === 0 && !generating && (
          <div className="text-center text-slate-600">
            <Sparkles size={64} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">Pronto para divulgar</h3>
            <p className="mt-2 text-sm max-w-sm">Faça upload de uma foto do seu produto e descreva como você quer a imagem promocional gerada com IA.</p>
          </div>
        )}
      </div>
    </div>
  );
};
