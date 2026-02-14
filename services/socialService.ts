
import { supabase } from '../src/lib/supabase';
import { SocialPost, SocialProfile, SocialComment } from '../types';

export const socialService = {
    async getProfile(userId: string): Promise<SocialProfile | null> {
        const { data, error } = await supabase
            .from('social_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    async createProfile(profile: Partial<SocialProfile>): Promise<SocialProfile | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('social_profiles')
            .upsert({
                id: user.id,
                ...profile,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            return null;
        }
        return data;
    },

    async getPosts(): Promise<SocialPost[]> {
        const { data, error } = await supabase
            .from('social_posts')
            .select(`
        *,
        author:social_profiles(*),
        likes:social_likes(count),
        comments:social_comments(count)
      `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching posts:', error);
            return [];
        }

        return data.map((post: any) => ({
            ...post,
            likes_count: post.likes?.[0]?.count || 0,
            comments_count: post.comments?.[0]?.count || 0,
        }));
    },

    async createPost(content: string, imageUrl?: string): Promise<SocialPost | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('social_posts')
            .insert({
                user_id: user.id,
                content,
                image_url: imageUrl,
            })
            .select('*, author:social_profiles(*)')
            .single();

        if (error) {
            console.error('Error creating post:', error);
            return null;
        }
        return data;
    },

    async getComments(postId: string): Promise<SocialComment[]> {
        const { data, error } = await supabase
            .from('social_comments')
            .select('*, author:social_profiles(*)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
        return data;
    },

    async addComment(postId: string, content: string): Promise<SocialComment | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('social_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                content,
            })
            .select('*, author:social_profiles(*)')
            .single();

        if (error) {
            console.error('Error adding comment:', error);
            return null;
        }
        return data;
    },

    async toggleLike(postId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data: existingLike } = await supabase
            .from('social_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();

        if (existingLike) {
            const { error } = await supabase
                .from('social_likes')
                .delete()
                .eq('id', existingLike.id);

            if (error) {
                console.error('Error removing like:', error);
                return false;
            }
            return false; // Liked removed
        } else {
            const { error } = await supabase
                .from('social_likes')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                });

            if (error) {
                console.error('Error adding like:', error);
                return false;
            }
            return true; // Like added
        }
    }
};
