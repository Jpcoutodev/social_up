import React, { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { VideoScript } from '../types';
import { Player } from '@remotion/player';
import { VideoComposition } from './VideoComposition';
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from '../constants';
import { Play, Download, Trash2, Calendar, FileVideo, X, Send } from 'lucide-react';

interface SavedVideo {
    id: string;
    title: string;
    script: VideoScript;
    created_at: string;
    video_url?: string;
}

export const MyVideos: React.FC = () => {
    const [videos, setVideos] = useState<SavedVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<SavedVideo | null>(null);
    const [rendering, setRendering] = useState(false);
    const [renderingId, setRenderingId] = useState<string | null>(null);
    const [progressStatus, setProgressStatus] = useState('');

    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        try {
            const { data, error } = await supabase
                .from('social_videos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVideos(data || []);
        } catch (error) {
            console.error('Error fetching videos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este vídeo?')) return;

        try {
            const { error } = await supabase.from('social_videos').delete().eq('id', id);
            if (error) throw error;
            setVideos(videos.filter(v => v.id !== id));
            if (selectedVideo?.id === id) setSelectedVideo(null);
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Falha ao excluir vídeo');
        }
    };

    const getRenderCommand = (video: SavedVideo) => {
        const propsString = JSON.stringify({ script: video.script });
        const safeProps = propsString.replace(/'/g, "'\\''");
        return `npx remotion render src/index.tsx VideoComposition out/${video.title.replace(/\s+/g, '_')}.mp4 --props='${safeProps}'`;
    };

    const downloadRenderScript = (video: SavedVideo, e: React.MouseEvent) => {
        e.stopPropagation();
        const command = getRenderCommand(video);
        const fileName = `render_${video.title.replace(/\s+/g, '_').toLowerCase()}.sh`;
        const fileContent = `#!/bin/bash
# Shorts Factory Render Script
# Title: ${video.title}
# ----------------------------------------
echo "🎬 Starting Render for: ${video.title}..."
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

    const handleAutoPost = async (video: SavedVideo, e: React.MouseEvent) => {
        e.stopPropagation();

        // Get config
        const savedN8n = localStorage.getItem('n8n_config');
        if (!savedN8n) {
            alert('⚠️ n8n não configurado! Vá para a aba "Integrações" primeiro.');
            return;
        }
        const { webhookUrl, bundleUrl } = JSON.parse(savedN8n);

        if (!webhookUrl || !bundleUrl) {
            alert('⚠️ URL do n8n ou Bundle URL faltando! Verifique a aba "Integrações".');
            return;
        }

        if (!confirm(`🚀 Enviar "${video.title}" para o n8n para renderização e publicação?\n\nIsso irá acionar seu workflow n8n.`)) return;

        try {
            setLoading(true);
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: video.id,
                    script: video.script,
                    title: video.title,
                    bundleUrl: bundleUrl,
                    // Optional: Send user email if you want to notify them
                    //   userEmail: (await supabase.auth.getUser()).data.user?.email
                })
            });

            if (res.ok) {
                alert('✅ Enviado para o n8n! Processamento iniciado.');
            } else {
                throw new Error('n8n responded with error');
            }
        } catch (err: any) {
            alert('❌ Falha ao acionar n8n: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRenderMP4 = async (video: SavedVideo, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(`🎬 Renderizar "${video.title}" em MP4?\n\nA renderização FFmpeg levará ~30-60 segundos.`)) return;

        setRendering(true);
        setRenderingId(video.id);
        setProgressStatus('Enviando para o servidor de renderização...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Webhook n8n FFmpeg (Easypanel)
            const webhookUrl = 'https://n8n-n8n.jx5kj7.easypanel.host/webhook/512c2ea0-6754-4b6b-973b-17b47dc02820';

            setProgressStatus('Renderizando vídeo... Isso pode levar alguns minutos.');

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: video.script,
                    title: video.title,
                    user_id: user.id,
                    video_id: video.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || 'Failed to start render');
            }

            const result = await response.json();

            if (result.success && result.video_url) {
                setProgressStatus('Renderização concluída!');

                // Atualizar video_url no banco
                const { error: updateError } = await supabase
                    .from('social_videos')
                    .update({ video_url: result.video_url })
                    .eq('id', video.id);

                if (updateError) throw updateError;

                // Atualizar lista local
                setVideos(videos.map(v =>
                    v.id === video.id ? { ...v, video_url: result.video_url } : v
                ));

                // Download automático
                const link = document.createElement('a');
                link.href = result.video_url;
                link.download = `${video.title.replace(/\s+/g, '_').toLowerCase()}.mp4`;
                link.target = '_blank';
                link.click();

                alert(`✅ Vídeo renderizado com sucesso!\n\nURL: ${result.video_url}\n\nO vídeo foi salvo na sua biblioteca.`);
            } else {
                throw new Error('Invalid response from render server');
            }
        } catch (err: any) {
            console.error('Render error:', err);
            setProgressStatus('');
            alert(`❌ Falha ao renderizar vídeo: ${err.message}\n\nVerifique o workflow n8n e o status do servidor.`);
        } finally {
            setRendering(false);
            setRenderingId(null);
            setProgressStatus('');
        }
    };

    return (
        <div className="flex h-full bg-slate-900">
            {/* List Sidebar */}
            <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileVideo className="text-purple-400" size={20} />
                        Minha Biblioteca
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="text-center p-8 text-slate-500">
                            <p className="text-sm">Nenhum vídeo salvo ainda.</p>
                        </div>
                    ) : (
                        videos.map(video => (
                            <div
                                key={video.id}
                                onClick={() => setSelectedVideo(video)}
                                className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedVideo?.id === video.id
                                    ? 'bg-purple-900/20 border-purple-500/50'
                                    : video.video_url
                                        ? 'bg-green-900/10 border-green-700/40 hover:border-green-600/60'
                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                        {video.video_url && (
                                            <span className="text-green-400 flex-shrink-0" title="MP4 pronto">
                                                <FileVideo size={12} />
                                            </span>
                                        )}
                                        <h3 className="font-medium text-slate-200 line-clamp-1">{video.title}</h3>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(video.id, e)}
                                        className="text-slate-600 hover:text-red-400 p-1 flex-shrink-0 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(video.created_at).toLocaleDateString()}
                                    </span>
                                    <span>
                                        {(video.script.scenes.reduce((acc, s) => acc + s.durationInSeconds, 0)).toFixed(0)}s
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 bg-slate-900 flex flex-col relative overflow-hidden">
                {selectedVideo ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="mb-6 flex items-center gap-4 flex-wrap justify-center">
                            <h2 className="text-2xl font-bold text-white w-full text-center">{selectedVideo.title}</h2>

                            {selectedVideo.video_url ? (
                                <a
                                    href={selectedVideo.video_url}
                                    download={`${selectedVideo.title.replace(/\s+/g, '_').toLowerCase()}.mp4`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/40 animate-pulse"
                                >
                                    <Download size={18} />
                                    <span>Baixar MP4</span>
                                </a>
                            ) : (
                                <button
                                    onClick={(e) => handleRenderMP4(selectedVideo, e)}
                                    disabled={rendering && renderingId === selectedVideo.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/40"
                                >
                                    {rendering && renderingId === selectedVideo.id ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                            <span>Renderizando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            <span>Renderizar MP4</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {progressStatus && renderingId === selectedVideo.id && (
                            <div className="mb-4 px-4 py-3 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-200 text-sm">
                                {progressStatus}
                            </div>
                        )}

                        <div className="relative shadow-2xl shadow-purple-900/20 rounded-xl overflow-hidden border-4 border-slate-800 bg-black">
                            <Player
                                component={VideoComposition}
                                inputProps={{ script: selectedVideo.script }}
                                durationInFrames={Math.ceil(selectedVideo.script.scenes.reduce((acc, s) => acc + s.durationInSeconds, 0) * VIDEO_FPS)}
                                fps={VIDEO_FPS}
                                compositionWidth={VIDEO_WIDTH}
                                compositionHeight={VIDEO_HEIGHT}
                                style={{
                                    width: '360px',
                                    height: '640px',
                                }}
                                controls
                            />
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                        <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                            <Play size={40} className="ml-2 opacity-50" />
                        </div>
                        <p>Selecione um vídeo para visualizar</p>
                    </div>
                )}
            </div>
        </div>
    );
};
