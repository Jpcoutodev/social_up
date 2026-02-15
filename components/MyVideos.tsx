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
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            const { error } = await supabase.from('social_videos').delete().eq('id', id);
            if (error) throw error;
            setVideos(videos.filter(v => v.id !== id));
            if (selectedVideo?.id === id) setSelectedVideo(null);
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Failed to delete video');
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
            alert('⚠️ n8n not configured! Go to "Integrations" tab first.');
            return;
        }
        const { webhookUrl, bundleUrl } = JSON.parse(savedN8n);

        if (!webhookUrl || !bundleUrl) {
            alert('⚠️ Missing n8n URL or Bundle URL! Check "Integrations" tab.');
            return;
        }

        if (!confirm(`🚀 Send "${video.title}" to n8n for rendering & posting?\n\nThis will trigger your n8n workflow.`)) return;

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
                alert('✅ Sent to n8n! Processing started.');
            } else {
                throw new Error('n8n responded with error');
            }
        } catch (err: any) {
            alert('❌ Failed to trigger n8n: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRenderMP4 = async (video: SavedVideo, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(`🎬 Render "${video.title}" to MP4?\n\nThis may take 5-10 minutes.`)) return;

        setRendering(true);
        setRenderingId(video.id);
        setProgressStatus('Sending to render server...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Webhook n8n com HTTPS
            const webhookUrl = 'https://n8n.dualis.love/webhook/render-video';

            setProgressStatus('Rendering video... This may take several minutes.');

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: video.script,
                    title: video.title,
                    user_id: user.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || 'Failed to start render');
            }

            const result = await response.json();

            if (result.success && result.video_url) {
                setProgressStatus('Render complete!');

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

                alert(`✅ Video rendered successfully!\n\nURL: ${result.video_url}\n\nThe video has been saved to your library.`);
            } else {
                throw new Error('Invalid response from render server');
            }
        } catch (err: any) {
            console.error('Render error:', err);
            setProgressStatus('');
            alert(`❌ Failed to render video: ${err.message}\n\nPlease check the n8n workflow and server status.`);
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
                        My Library
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="text-center p-8 text-slate-500">
                            <p className="text-sm">No videos saved yet.</p>
                        </div>
                    ) : (
                        videos.map(video => (
                            <div
                                key={video.id}
                                onClick={() => setSelectedVideo(video)}
                                className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedVideo?.id === video.id
                                    ? 'bg-purple-900/20 border-purple-500/50'
                                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-slate-200 line-clamp-1">{video.title}</h3>
                                    <button
                                        onClick={(e) => handleDelete(video.id, e)}
                                        className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
                        <div className="mb-6 flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-white">{selectedVideo.title}</h2>
                            <button
                                onClick={(e) => downloadRenderScript(selectedVideo, e as any)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                            >
                                <Download size={16} />
                                Download MP4 Script
                            </button>
                            <button
                                onClick={(e) => handleRenderMP4(selectedVideo, e)}
                                disabled={rendering && renderingId === selectedVideo.id}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/40"
                            >
                                {rendering && renderingId === selectedVideo.id ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                        <span>Rendering...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        <span>Render MP4</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={(e) => handleAutoPost(selectedVideo, e)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-purple-900/40"
                            >
                                <Send size={16} />
                                Post via n8n
                            </button>
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

                        {selectedVideo.video_url && (
                            <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                                <p className="text-sm text-green-300 mb-2 font-medium">✅ Video rendered and available:</p>
                                <a
                                    href={selectedVideo.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-green-400 hover:text-green-300 underline break-all"
                                >
                                    {selectedVideo.video_url}
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                        <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                            <Play size={40} className="ml-2 opacity-50" />
                        </div>
                        <p>Select a video to preview</p>
                    </div>
                )}
            </div>
        </div>
    );
};
