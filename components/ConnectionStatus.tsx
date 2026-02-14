import React, { useEffect, useState } from 'react';
import { checkConnection, getApiKey, setApiKey, removeApiKey, getProvider, setProvider } from '../services/geminiService';
import { AIProvider } from '../types';
import { CheckCircle2, XCircle, Loader2, Server, Key, ShieldCheck, Eye, EyeOff, Save, Trash2, Bot, Sparkles, Cpu } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
    const [latency, setLatency] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    // Provider Selection
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');

    // Key Inputs
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    // States to track if keys are saved
    const [savedGemini, setSavedGemini] = useState(false);
    const [savedOpenai, setSavedOpenai] = useState(false);

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
        } else {
            setApiKey('openai', openaiKey);
            setSavedOpenai(true);
        }
        // If we saved the key for the active provider, re-check
        if (provider === selectedProvider) runCheck();
    };

    const handleRemoveKey = (provider: AIProvider) => {
        removeApiKey(provider);
        if (provider === 'gemini') {
            setGeminiKey('');
            setSavedGemini(false);
        } else {
            setOpenaiKey('');
            setSavedOpenai(false);
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
                <h2 className="text-3xl font-bold text-white mb-2">AI Engine Settings</h2>
                <p className="text-slate-400">Choose your AI provider and configure access keys.</p>
            </div>

            <div className="grid grid-cols-1 gap-8">

                {/* PROVIDER SELECTION */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleProviderChange('gemini')}
                        className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${selectedProvider === 'gemini'
                                ? 'border-purple-500 bg-purple-900/20 shadow-lg shadow-purple-900/20'
                                : 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-600'
                            }`}
                    >
                        {selectedProvider === 'gemini' && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600/30 border border-purple-500/50 px-2 py-0.5 rounded-full text-[10px] text-purple-200 font-bold uppercase">
                                <CheckCircle2 size={10} /> Active
                            </div>
                        )}
                        <Sparkles size={32} className={selectedProvider === 'gemini' ? 'text-purple-400' : 'text-slate-500'} />
                        <div className="text-center">
                            <div className={`font-bold ${selectedProvider === 'gemini' ? 'text-white' : 'text-slate-400'}`}>Google Gemini</div>
                            <div className="text-xs text-slate-500 mt-1">Free Tier Available</div>
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
                                <CheckCircle2 size={10} /> Active
                            </div>
                        )}
                        <Bot size={32} className={selectedProvider === 'openai' ? 'text-green-400' : 'text-slate-500'} />
                        <div className="text-center">
                            <div className={`font-bold ${selectedProvider === 'openai' ? 'text-white' : 'text-slate-400'}`}>OpenAI GPT-4o</div>
                            <div className="text-xs text-slate-500 mt-1">Paid API Only</div>
                        </div>
                    </button>
                </div>

                {/* API CONFIGURATION CARD */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                    {/* Dynamic Background Glow based on provider */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${selectedProvider === 'gemini' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`} />

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Key className={selectedProvider === 'gemini' ? 'text-purple-400' : 'text-green-400'} size={20} />
                            {selectedProvider === 'gemini' ? 'Gemini API Configuration' : 'OpenAI API Configuration'}
                        </h3>
                    </div>

                    {/* GEMINI INPUT */}
                    <div className={selectedProvider === 'gemini' ? 'block' : 'hidden'}>
                        <p className="text-sm text-slate-400 mb-4">
                            Enter your Google Gemini API Key. (Get it from Google AI Studio)
                        </p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="Paste Gemini Key (AIza...)"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button onClick={() => handleSaveKey('gemini')} className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors">
                                <Save size={18} /> Save
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
                            Enter your OpenAI API Key. (Requires billing enabled for GPT-4o & DALL-E 3)
                        </p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    placeholder="Paste OpenAI Key (sk-...)"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button onClick={() => handleSaveKey('openai')} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors">
                                <Save size={18} /> Save
                            </button>
                            {savedOpenai && (
                                <button onClick={() => handleRemoveKey('openai')} className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-[10px] text-slate-500">
                        <ShieldCheck size={12} />
                        <span>Keys are stored locally in your browser.</span>
                    </div>
                </div>

                {/* CONNECTION STATUS & PIPELINE INFO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* STATUS */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Server className={selectedProvider === 'gemini' ? 'text-purple-400' : 'text-green-400'} size={20} />
                                Active Connection
                            </h3>
                            {status === 'checking' && <Loader2 className="animate-spin text-slate-400" />}
                            {status === 'connected' && <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">Online</div>}
                            {status === 'error' && <div className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">Offline</div>}
                        </div>

                        <div className="space-y-4 flex-1">
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-sm">Target API</span>
                                <span className="text-white text-sm font-bold uppercase">{selectedProvider}</span>
                            </div>
                            {latency !== null && (
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                    <span className="text-slate-400 text-sm">Latency</span>
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
                                {status === 'checking' ? 'Connecting...' : 'Test Connection'}
                            </button>
                        </div>
                    </div>

                    {/* PIPELINE DETAILS */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                            <Cpu className="text-blue-400" size={20} />
                            Current Pipeline
                        </h3>

                        <div className="space-y-4">
                            {selectedProvider === 'gemini' ? (
                                <>
                                    <ServiceItem name="Script Gen" model="Gemini 1.5 Flash" type="LLM" active={true} color="purple" />
                                    <ServiceItem name="Image Gen" model="Gemini 2.5 Flash / Pro" type="Vision" active={true} color="purple" />
                                    <ServiceItem name="Narration" model="Gemini TTS" type="Audio" active={true} color="purple" />
                                </>
                            ) : (
                                <>
                                    <ServiceItem name="Script Gen" model="GPT-4o" type="LLM" active={true} color="green" />
                                    <ServiceItem name="Image Gen" model="DALL-E 3 (Vertical)" type="Vision" active={true} color="green" />
                                    <ServiceItem name="Narration" model="TTS-1 (Onyx)" type="Audio" active={true} color="green" />
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const ServiceItem = ({ name, model, type, active, color }: { name: string, model: string, type: string, active: boolean, color: string }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${active ? (color === 'purple' ? 'bg-purple-500 shadow-purple-500/50' : 'bg-green-500 shadow-green-500/50') : 'bg-slate-600'} shadow-[0_0_8px_rgba(0,0,0,0.3)]`} />
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