
import React, { useEffect, useState } from 'react';
import { socialService } from '../services/socialService';
import { SocialPost, SocialProfile } from '../types';
import { Heart, MessageCircle, Send, User } from 'lucide-react';
import { supabase } from '../src/lib/supabase';

export const SocialFeed: React.FC = () => {
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchPosts();
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };

    const fetchPosts = async () => {
        setLoading(true);
        const data = await socialService.getPosts();
        setPosts(data);
        setLoading(false);
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostContent.trim()) return;

        if (!user) {
            // Simple auth check/prompt could go here
            alert('Please sign in to post');
            return;
        }

        // Ensure profile exists
        let profile = await socialService.getProfile(user.id);
        if (!profile) {
            // Create default profile if not exists
            await socialService.createProfile({
                username: user.email?.split('@')[0] || 'user',
                full_name: 'New User'
            });
        }

        const newPost = await socialService.createPost(newPostContent);
        if (newPost) {
            setPosts([newPost, ...posts]);
            setNewPostContent('');
        }
    };

    const handleLike = async (postId: string) => {
        if (!user) return;

        // Optimistic update
        setPosts(posts.map(post => {
            if (post.id === postId) {
                const isLiked = post.user_has_liked; // This would need to be tracked
                return {
                    ...post,
                    likes_count: (post.likes_count || 0) + (isLiked ? -1 : 1),
                    user_has_liked: !isLiked
                };
            }
            return post;
        }));

        await socialService.toggleLike(postId);
        // Re-fetch to sync exact state if needed, or stick with optimistic
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Loading feed...</div>;
    }

    return (
        <div className="p-8 max-w-3xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-bold text-white mb-6">Community Feed</h2>

            {/* Create Post */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8">
                <form onSubmit={handleCreatePost} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <input
                            type="text"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none py-2"
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                type="submit"
                                disabled={!newPostContent.trim()}
                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={14} />
                                Post
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Posts List */}
            <div className="space-y-6">
                {posts.map((post) => (
                    <div key={post.id} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-4">
                            {post.author?.avatar_url ? (
                                <img src={post.author.avatar_url} alt={post.author.username} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                    <span className="text-white font-bold">{post.author?.username?.[0]?.toUpperCase() || 'U'}</span>
                                </div>
                            )}

                            <div className="flex-1">
                                <div className="flex items-baseline justify-between">
                                    <h3 className="font-semibold text-white">{post.author?.full_name || post.author?.username || 'Unknown User'}</h3>
                                    <span className="text-xs text-slate-500">{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-slate-300 mt-2 whitespace-pre-wrap">{post.content}</p>

                                <div className="flex items-center gap-6 mt-4 text-slate-400">
                                    <button
                                        onClick={() => handleLike(post.id)}
                                        className="flex items-center gap-2 hover:text-pink-500 transition-colors"
                                    >
                                        <Heart size={18} />
                                        <span className="text-sm">{post.likes_count || 0}</span>
                                    </button>
                                    <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                                        <MessageCircle size={18} />
                                        <span className="text-sm">{post.comments_count || 0}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {posts.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <p>No posts yet. Be the first to share something!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
