import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Player } from '@remotion/player';
import { supabase } from '../src/lib/supabase';
import { VideoScript, AIProvider, VideoLanguage } from '../types';
import { generateScript, getProvider } from '../services/geminiService';
import { VideoComposition } from './VideoComposition';
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from '../constants';
import { Wand2, Terminal, Check, Download, FileVideo, Video, XCircle, Bot, Sparkles, Globe } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<VideoLanguage>('pt-BR');

  const [script, setScript] = useState<VideoScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeProvider, setActiveProvider] = useState<AIProvider>('gemini');

  // Ref to hold the AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load provider on mount and when window gets focus (in case user changed it in another tab/settings)
  const refreshProvider = useCallback(() => {
    setActiveProvider(getProvider());
  }, []);

  useEffect(() => {
    refreshProvider();
    window.addEventListener('focus', refreshProvider);
    return () => window.removeEventListener('focus', refreshProvider);
  }, [refreshProvider]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;

    // Refresh provider one last time before starting
    const currentProvider = getProvider();
    setActiveProvider(currentProvider);

    // Abort previous
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setProgress(0);
    setProgressStatus(`Initializing ${currentProvider === 'openai' ? 'OpenAI' : 'Gemini'}...`);
    setError(null);
    setScript(null);
    setCopied(false);

    try {
      const generatedScript = await generateScript(
        topic,
        language,
        (pct, status) => {
          setProgress(pct);
          setProgressStatus(status);
        },
        controller.signal
      );
      setScript(generatedScript);
    } catch (err: any) {
      if (err.message === 'Cancelled by user') {
        setProgressStatus('Generation Cancelled');
      } else {
        setError(err.message || 'Failed to generate script');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [topic, language]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setProgressStatus('Cancelled');
    }
  };

  const getRenderCommand = () => {
    if (!script) return '';
    const propsString = JSON.stringify({ script });
    const safeProps = propsString.replace(/'/g, "'\\''");
    return `npx remotion render src/index.tsx VideoComposition out/${topic.replace(/\s+/g, '_')}.mp4 --props='${safeProps}'`;
  };

  const copyRenderCommand = () => {
    const command = getRenderCommand();
    if (!command) return;

    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadRenderScript = () => {
    if (!script) return;
    const command = getRenderCommand();
    const fileName = `render_${topic.replace(/\s+/g, '_').toLowerCase()}.sh`;
    const fileContent = `#!/bin/bash
# Shorts Factory Render Script
# Topic: ${topic}
# Engine: ${activeProvider.toUpperCase()}
# Language: ${language}
# ----------------------------------------
echo "🎬 Starting Render for: ${topic}..."
npm install
${command}
echo "✅ Render Complete! Check the 'out' folder."
`;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!script || !topic) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('social_videos').insert({
        user_id: user.id,
        title: topic,
        script: script
      });

      if (error) throw error;
      alert('Video saved to your library!');
    } catch (err: any) {
      alert('Failed to save video: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const durationInFrames = script
    ? Math.ceil(script.scenes.reduce((acc, scene) => acc + scene.durationInSeconds, 0) * VIDEO_FPS)
    : 1;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Sidebar / Control Panel */}
      <div className="w-full md:w-[400px] flex-shrink-0 p-6 border-r border-slate-700 flex flex-col z-10 bg-slate-800 h-full overflow-y-auto custom-scrollbar">
        <div className="flex-1 flex flex-col space-y-6">

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="text-purple-400" />
                Content Gen
              </h2>
              {/* Active Provider Badge */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${activeProvider === 'openai' ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-purple-900/30 border-purple-700 text-purple-400'}`}>
                {activeProvider === 'openai' ? <Bot size={12} /> : <Sparkles size={12} />}
                {activeProvider === 'openai' ? 'GPT-4o + DALL-E 3' : 'GEMINI 2.5'}
              </div>
            </div>

            {/* Language Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Globe size={14} /> Video Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as VideoLanguage)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="en-US">🇺🇸 English (USA)</option>
                <option value="es-ES">🇪🇸 Español</option>
              </select>
            </div>

            <label htmlFor="topic" className="block text-sm font-medium text-slate-400 mb-2">
              Video Topic
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 5 facts about Mars, How to bake cookies..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder-slate-600 resize-none h-24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          <div className="space-y-3">
            {!loading ? (
              <button
                onClick={handleGenerate}
                disabled={!topic}
                className={`
                    w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center space-x-2 transition-all relative overflow-hidden
                    ${!topic
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:shadow-purple-500/25'}
                    `}
              >
                <Wand2 size={20} />
                <span>Generate Script</span>
              </button>
            ) : (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-sm text-white font-medium mb-1">
                  <span>Generating...</span>
                  <span>{progress}%</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${activeProvider === 'openai' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 text-center animate-pulse">
                  {progressStatus}
                </div>

                <button
                  onClick={handleCancel}
                  className="w-full py-2 mt-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-300 text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Cancel Generation
                </button>
              </div>
            )}
          </div>

          {script && !loading && (
            <div className="space-y-3 pt-4 border-t border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Export MP4</h3>

              <button
                onClick={downloadRenderScript}
                className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center space-x-2 transition-all bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
              >
                <Download size={18} />
                <span>Download MP4 Generator</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center space-x-2 transition-all bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 disabled:opacity-50"
              >
                {saving ? <Sparkles className="animate-spin" size={18} /> : <FileVideo size={18} />}
                <span>{saving ? 'Saving...' : 'Save to Library'}</span>
              </button>

              <button
                onClick={copyRenderCommand}
                className="w-full py-3 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Terminal size={14} />}
                <span>{copied ? "Copied" : "Copy CLI Command"}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          {script && !loading && (
            <div className="mt-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                <h3 className="text-lg font-semibold text-purple-300">Storyboard</h3>
                <span className="text-xs bg-purple-900/50 text-purple-200 px-2 py-1 rounded border border-purple-500/30">
                  Mood: {script.backgroundMusicMood}
                </span>
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar space-y-3 pb-4">
                {script.scenes.map((scene, idx) => (
                  <div key={idx} className="bg-slate-700/50 p-3 rounded border border-slate-600/50 relative overflow-hidden group">
                    <div className="flex justify-between text-xs text-slate-400 mb-1 z-10 relative">
                      <span className="font-mono text-purple-400">Scene {idx + 1}</span>
                      <span>{scene.durationInSeconds.toFixed(1)}s</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 relative z-10">{scene.text}</p>

                    {/* Thumbnail preview behind text */}
                    {scene.imageUrl && (
                      <div className="absolute top-0 right-0 w-16 h-full opacity-20 mask-image-gradient group-hover:opacity-30 transition-opacity">
                        <img src={scene.imageUrl} className="w-full h-full object-cover" alt="scene thumbnail" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.5)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />

        {script ? (
          <div className="flex flex-col items-center gap-6 z-10 animate-in fade-in duration-700">
            <div className="relative shadow-2xl shadow-purple-900/20 rounded-xl overflow-hidden border-4 border-slate-800 bg-black">
              <Player
                component={VideoComposition}
                inputProps={{ script }}
                durationInFrames={durationInFrames}
                fps={VIDEO_FPS}
                compositionWidth={VIDEO_WIDTH}
                compositionHeight={VIDEO_HEIGHT}
                style={{
                  width: '360px', // Scaled down for preview
                  height: '640px',
                }}
                controls
              />
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono border border-white/10 pointer-events-none text-slate-300">
                PREVIEW MODE
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-600 space-y-6 z-10">
            <div className="w-32 h-32 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700 animate-pulse">
              <FileVideo size={50} className="ml-2 opacity-40 text-purple-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-400 mb-2">Ready to Create</h2>
              <p className="max-w-md mx-auto text-slate-500">
                Enter a topic on the left to generate a viral vertical video powered by <strong className="text-slate-300">{activeProvider === 'openai' ? 'OpenAI DALL-E 3' : 'Gemini AI'}</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};