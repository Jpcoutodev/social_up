import React, { useEffect, useState } from 'react';
import { checkConnection, getApiKey, setApiKey, removeApiKey, getProvider, setProvider, getMinimaxGroupId, setMinimaxGroupId, getMinimaxVoiceId, setMinimaxVoiceId, getBrandPrompt, setBrandPrompt as saveBrandPrompt } from '../services/geminiService';
import { AIProvider } from '../types';
import { CheckCircle2, XCircle, Loader2, Server, Key, ShieldCheck, Eye, EyeOff, Save, Trash2, Bot, Sparkles, Cpu, Zap, Building2 } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
    const [latency, setLatency] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    // Provider Selection
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');

    // Key Inputs
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [minimaxKey, setMinimaxKey] = useState('');
    const [minimaxGroup, setMinimaxGroup] = useState('');
    const [minimaxVoice, setMinimaxVoice] = useState('');
    const [showKey, setShowKey] = useState(false);

    // States to track if keys are saved
    const [savedGemini, setSavedGemini] = useState(false);
    const [savedOpenai, setSavedOpenai] = useState(false);
    const [savedMinimax, setSavedMinimax] = useState(false);

    // Brand Prompt
    const [brandPrompt, setBrandPromptState] = useState('');
    const [savedBrand, setSavedBrand] = useState(false);

    const loadSettings = () => {
        const provider = getProvider();
        setSelectedProvider(provider);

        const lsGemini = localStorage.getItem('gemini_custom_api_key');
        if (lsGemini) {
            setGeminiKey(lsGemini);
            setSavedGemini(true);
        }

        const lsOpenAI = localStorage.getItem('openai_custom_api_key');
        if (lsOpenAI) {
            setOpenaiKey(lsOpenAI);
            setSavedOpenai(true);
        }

        const lsMinimax = localStorage.getItem('minimax_custom_api_key');
        if (lsMinimax) {
            setMinimaxKey(lsMinimax);
            setSavedMinimax(true);
        }

        setMinimaxGroup(getMinimaxGroupId());
        setMinimaxVoice(getMinimaxVoiceId());

        const bp = getBrandPrompt();
        if (bp) {
            setBrandPromptState(bp);
            setSavedBrand(true);
        }
    };

    const runCheck = async () => {
        setStatus('checking');
        const result = await checkConnection();
        if (result.success) {
            setStatus('connected');
            setLatency(result.latency);
            setMessage(result.message);
        } else {
            setStatus('error');
            setLatency(null);
            setMessage(result.message);
        }
    };

    const handleProviderChange = (provider: AIProvider) => {
        setSelectedProvider(provider);
        setProvider(provider);
        // Brief timeout to let local storage update before checking
        setTimeout(runCheck, 50);
    };

    const handleSaveKey = (provider: AIProvider) => {
        if (provider === 'gemini') {
            setApiKey('gemini', geminiKey);
            setSavedGemini(true);
        } else if (provider === 'openai') {
            setApiKey('openai', openaiKey);
            setSavedOpenai(true);
        } else {
            setApiKey('minimax', minimaxKey);
            setMinimaxGroupId(minimaxGroup);
            setMinimaxVoiceId(minimaxVoice);
            setSavedMinimax(true);
        }
        // If we saved the key for the active provider, re-check
        if (provider === selectedProvider) runCheck();
    };

    const handleRemoveKey = (provider: AIProvider) => {
        removeApiKey(provider);
        if (provider === 'gemini') {
            setGeminiKey('');
            setSavedGemini(false);
        } else if (provider === 'openai') {
            setOpenaiKey('');
            setSavedOpenai(false);
        } else {
            setMinimaxKey('');
            setMinimaxGroup('');
            setMinimaxVoice('');
            setMinimaxGroupId('');
            setMinimaxVoiceId('');
            setSavedMinimax(false);
        }
        if (provider === selectedProvider) runCheck();
    };

    useEffect(() => {
        loadSettings();
        runCheck();
    }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Configurações de IA</h2>
                <p className="text-slate-400">Escolha seu provedor de IA e configure as chaves de acesso.</p>
            </div>

            <div className="grid grid-cols-1 gap-8">

                {/* PROVIDER SELECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={() => handleProviderChange('gemini')}
                        className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${selectedProvider === 'gemini'
                                ? 'border-purple-500 bg-purple-900/20 shadow-lg shadow-purple-900/20'
                                : 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-600'
                            }`}
                    >
                        {selectedProvider === 'gemini' && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600/30 border border-purple-500/50 px-2 py-0.5 rounded-full text-[10px] text-purple-200 font-bold uppercase">
                                <CheckCircle2 size={10} /> Ativo
                            </div>
                        )}
                        <Sparkles size={32} className={selectedProvider === 'gemini' ? 'text-purple-400' : 'text-slate-500'} />
                        <div className="text-center">
                            <div className={`font-bold ${selectedProvider === 'gemini' ? 'text-white' : 'text-slate-400'}`}>Google Gemini</div>
                            <div className="text-xs text-slate-500 mt-1">Plano Gratuito Disponível</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleProviderChange('openai')}
                        className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${selectedProvider === 'openai'
                                ? 'border-green-500 bg-green-900/20 shadow-lg shadow-green-900/20'
                                : 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-600'
                            }`}
                    >
                        {selectedProvider === 'openai' && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-600/30 border border-green-500/50 px-2 py-0.5 rounded-full text-[10px] text-green-200 font-bold uppercase">
                                <CheckCircle2 size={10} /> Ativo
                            </div>
                        )}
                        <Bot size={32} className={selectedProvider === 'openai' ? 'text-green-400' : 'text-slate-500'} />
                        <div className="text-center">
                            <div className={`font-bold ${selectedProvider === 'openai' ? 'text-white' : 'text-slate-400'}`}>OpenAI GPT-4o</div>
                            <div className="text-xs text-slate-500 mt-1">Somente API Paga</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleProviderChange('minimax')}
                        className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${selectedProvider === 'minimax'
                                ? 'border-orange-500 bg-orange-900/20 shadow-lg shadow-orange-900/20'
                                : 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-600'
                            }`}
                    >
                        {selectedProvider === 'minimax' && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-orange-600/30 border border-orange-500/50 px-2 py-0.5 rounded-full text-[10px] text-orange-200 font-bold uppercase">
                                <CheckCircle2 size={10} /> Ativo
                            </div>
                        )}
                        <Zap size={32} className={selectedProvider === 'minimax' ? 'text-orange-400' : 'text-slate-500'} />
                        <div className="text-center">
                            <div className={`font-bold ${selectedProvider === 'minimax' ? 'text-white' : 'text-slate-400'}`}>MiniMax</div>
                            <div className="text-xs text-slate-500 mt-1">Text-01 + image-01 + speech-02</div>
                        </div>
                    </button>
                </div>

                {/* BRAND PROMPT CARD - MOVED TO TOP */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Building2 className="text-cyan-400" size={20} />
                            Prompt da Marca
                        </h3>
                        {savedBrand && (
                            <div className="flex items-center gap-1 bg-cyan-600/20 border border-cyan-500/30 px-2 py-0.5 rounded-full text-[10px] text-cyan-300 font-bold">
                                <CheckCircle2 size={10} /> Salvo
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-slate-400 mb-4">
                        Defina a identidade da sua marca, tom de voz, público-alvo e estilo de comunicação. Isso será aplicado a <strong className="text-slate-300">toda geração de conteúdo</strong> (vídeos, imagens e carrosséis).
                    </p>

                    <textarea
                        value={brandPrompt}
                        onChange={(e) => setBrandPromptState(e.target.value)}
                        placeholder={`Exemplo:\n• Marca: TechFlow - Plataforma SaaS para produtividade\n• Tom: Profissional mas amigável, moderno\n• Público: Empreendedores, 25-40 anos\n• Estilo: Inspirador, baseado em dados, usar emojis com moderação\n• Cores: Azul e branco\n• Evitar: Linguagem muito casual, gírias`}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder-slate-600 resize-none h-40 mb-4"
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={() => { saveBrandPrompt(brandPrompt); setSavedBrand(true); }}
                            disabled={!brandPrompt.trim()}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} /> Salvar Prompt da Marca
                        </button>
                        {savedBrand && (
                            <button
                                onClick={() => { saveBrandPrompt(''); setBrandPromptState(''); setSavedBrand(false); }}
                                className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-[10px] text-slate-500">
                        <ShieldCheck size={12} />
                        <span>O prompt da marca é injetado em todas as solicitações de geração de conteúdo por IA.</span>
                    </div>
                </div>

                {/* API CONFIGURATION CARD */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                    {/* Dynamic Background Glow based on provider */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${
                        selectedProvider === 'gemini' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                        selectedProvider === 'openai' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                        'bg-gradient-to-r from-orange-500 to-red-500'
                    }`} />

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Key className={
                                selectedProvider === 'gemini' ? 'text-purple-400' :
                                selectedProvider === 'openai' ? 'text-green-400' :
                                'text-orange-400'
                            } size={20} />
                            {selectedProvider === 'gemini' ? 'Configuração API Gemini' :
                             selectedProvider === 'openai' ? 'Configuração API OpenAI' :
                             'Configuração API MiniMax'}
                        </h3>
                    </div>

                    {/* GEMINI INPUT */}
                    <div className={selectedProvider === 'gemini' ? 'block' : 'hidden'}>
                        <p className="text-sm text-slate-400 mb-4">
                            Insira sua chave de API do Google Gemini. (Obtenha no Google AI Studio)
                        </p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="Cole a chave Gemini (AIza...)"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button onClick={() => handleSaveKey('gemini')} className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors">
                                <Save size={18} /> Salvar
                            </button>
                            {savedGemini && (
                                <button onClick={() => handleRemoveKey('gemini')} className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* OPENAI INPUT */}
                    <div className={selectedProvider === 'openai' ? 'block' : 'hidden'}>
                        <p className="text-sm text-slate-400 mb-4">
                            Insira sua chave de API do OpenAI. (Requer cobrança ativada para GPT-4o e DALL-E 3)
                        </p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    placeholder="Cole a chave OpenAI (sk-...)"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button onClick={() => handleSaveKey('openai')} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors">
                                <Save size={18} /> Salvar
                            </button>
                            {savedOpenai && (
                                <button onClick={() => handleRemoveKey('openai')} className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* MINIMAX INPUT */}
                    <div className={selectedProvider === 'minimax' ? 'block space-y-4' : 'hidden'}>
                        <p className="text-sm text-slate-400">
                            Insira sua chave de API do MiniMax (de <span className="text-orange-400">platform.minimaxi.com</span>). O Group ID é necessário para narração (TTS).
                        </p>

                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={minimaxKey}
                                    onChange={(e) => setMinimaxKey(e.target.value)}
                                    placeholder="Cole a chave MiniMax"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="text"
                                value={minimaxGroup}
                                onChange={(e) => setMinimaxGroup(e.target.value)}
                                placeholder="Group ID (obrigatório para TTS)"
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-4 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <select
                                value={minimaxVoice}
                                onChange={(e) => setMinimaxVoice(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-4 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                <option value="">Selecione uma voz (Opcional)</option>
                                <optgroup label="Português">
                                    <option value="Portuguese_CaptivatingStoryteller">Portuguese_CaptivatingStoryteller</option>
                                    <option value="Portuguese_ConfidentWoman">Portuguese_ConfidentWoman</option>
                                    <option value="Portuguese_LovelyLady">Portuguese_LovelyLady</option>
                                    <option value="Portuguese_RationalMan">Portuguese_RationalMan</option>
                                </optgroup>
                                <optgroup label="Inglês">
                                    <option value="English_magnetic_voiced_man">English_magnetic_voiced_man</option>
                                    <option value="English_CalmWoman">English_CalmWoman</option>
                                    <option value="English_Graceful_Lady">English_Graceful_Lady</option>
                                </optgroup>
                                <optgroup label="Espanhol">
                                    <option value="Spanish_ConfidentWoman">Spanish_ConfidentWoman</option>
                                    <option value="Spanish_RationalMan">Spanish_RationalMan</option>
                                    <option value="Spanish_SophisticatedLady">Spanish_SophisticatedLady</option>
                                </optgroup>
                            </select>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <button onClick={() => handleSaveKey('minimax')} className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors">
                                <Save size={18} /> Salvar
                            </button>
                            {savedMinimax && (
                                <button onClick={() => handleRemoveKey('minimax')} className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-[10px] text-slate-500">
                        <ShieldCheck size={12} />
                        <span>As chaves são armazenadas localmente no seu navegador.</span>
                    </div>
                </div>

                {/* CONNECTION STATUS & PIPELINE INFO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* STATUS */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Server className={
                                    selectedProvider === 'gemini' ? 'text-purple-400' :
                                    selectedProvider === 'openai' ? 'text-green-400' :
                                    'text-orange-400'
                                } size={20} />
                                Conexão Ativa
                            </h3>
                            {status === 'checking' && <Loader2 className="animate-spin text-slate-400" />}
                            {status === 'connected' && <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">Online</div>}
                            {status === 'error' && <div className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">Offline</div>}
                        </div>

                        <div className="space-y-4 flex-1">
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-sm">API Alvo</span>
                                <span className="text-white text-sm font-bold uppercase">{selectedProvider}</span>
                            </div>
                            {latency !== null && (
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                    <span className="text-slate-400 text-sm">Latência</span>
                                    <span className={`text-sm font-mono ${latency < 500 ? 'text-green-400' : 'text-yellow-400'}`}>{latency}ms</span>
                                </div>
                            )}
                            {message && status === 'error' && (
                                <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-300 text-xs break-all">
                                    {message}
                                </div>
                            )}
                            <button
                                onClick={runCheck}
                                disabled={status === 'checking'}
                                className="w-full mt-auto py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
                            >
                                {status === 'checking' ? 'Conectando...' : 'Testar Conexão'}
                            </button>
                        </div>
                    </div>

                    {/* PIPELINE DETAILS */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                            <Cpu className="text-blue-400" size={20} />
                            Pipeline Atual
                        </h3>

                        <div className="space-y-4">
                            {selectedProvider === 'gemini' && (
                                <>
                                    <ServiceItem name="Geração Script" model="Gemini 1.5 Flash" type="LLM" active={true} color="purple" />
                                    <ServiceItem name="Geração Imagem" model="Gemini 2.5 Flash / Pro" type="Visão" active={true} color="purple" />
                                    <ServiceItem name="Narração" model="Gemini TTS" type="Áudio" active={true} color="purple" />
                                </>
                            )}
                            {selectedProvider === 'openai' && (
                                <>
                                    <ServiceItem name="Geração Script" model="GPT-4o" type="LLM" active={true} color="green" />
                                    <ServiceItem name="Geração Imagem" model="DALL-E 3 (Vertical)" type="Visão" active={true} color="green" />
                                    <ServiceItem name="Narração" model="TTS-1 (Onyx)" type="Áudio" active={true} color="green" />
                                </>
                            )}
                            {selectedProvider === 'minimax' && (
                                <>
                                    <ServiceItem name="Geração Script" model="MiniMax-Text-01" type="LLM" active={true} color="orange" />
                                    <ServiceItem name="Geração Imagem" model="image-01 (Vertical)" type="Visão" active={true} color="orange" />
                                    <ServiceItem name="Narração" model={`speech-02-hd (${minimaxVoice || 'auto'})`} type="Áudio" active={!!minimaxGroup} color="orange" />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ServiceItem = ({ name, model, type, active, color }: { name: string, model: string, type: string, active: boolean, color: string }) => {
    const dotColor = !active ? 'bg-slate-600' :
        color === 'purple' ? 'bg-purple-500 shadow-purple-500/50' :
        color === 'orange' ? 'bg-orange-500 shadow-orange-500/50' :
        'bg-green-500 shadow-green-500/50';
    return (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${dotColor} shadow-[0_0_8px_rgba(0,0,0,0.3)]`} />
            <div>
                <div className="text-slate-200 text-sm font-medium">{name}</div>
                <div className="text-slate-500 text-[10px] font-mono">{model}</div>
            </div>
        </div>
        <div className="px-2 py-1 bg-slate-900 rounded text-[10px] text-slate-400 font-mono border border-slate-700">
            {type}
        </div>
    </div>
    );
};