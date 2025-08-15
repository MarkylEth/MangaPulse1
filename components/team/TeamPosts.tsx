'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, MessageSquare, Trash2, Edit3, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/database.types';
import { useAuth } from '@/lib/auth/context';
import { useTheme } from '@/lib/theme/context';

type Post = Tables<'team_posts'>;
type CommentRow = Tables<'team_post_comments'>;
type LikeRow = Tables<'team_post_likes'>;

type Props = {
  teamId: number;  // ID команды из translator_teams (число)
  canPost: boolean;
};

const sb = createClient();

export default function TeamPosts({ teamId, canPost }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const cardBg = theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/60 border-slate-700';
  const text = theme === 'light' ? 'text-slate-900' : 'text-white';
  const muted = theme === 'light' ? 'text-slate-600' : 'text-slate-400';

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const resetEditor = () => {
    setTitle(''); 
    setBody(''); 
    setEditPost(null); 
    setEditorOpen(false);
  };

  async function load() {
    setLoading(true);
    try {
      console.log('🔍 Loading posts for team:', { teamId });
      
      // Используем число напрямую, так как в БД team_id хранится как число
      const { data, error } = await sb
        .from('team_posts')
        .select('*')
        .eq('team_id', teamId) // Используем число, не строку!
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      
      console.log('📝 Posts query result:', { data, error, count: data?.length });
      
      if (error) {
        console.error('Error loading posts:', error);
        setPosts([]);
      } else {
        setPosts(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    load(); 
  }, [teamId]); // Используем teamId напрямую

  async function submitPost() {
    if (!user) return;
    
    console.log('📤 Submitting post:', {
      team_id: teamId, // Используем число
      author_id: user.id,
      title: title.trim() || null,
      body: body.trim()
    });
    
    if (editPost) {
      const { data, error } = await sb
        .from('team_posts')
        .update({
          title: title.trim() || null, 
          body: body.trim(), 
          is_published: true, 
          updated_at: new Date().toISOString()
        })
        .eq('id', editPost.id)
        .select();
        
      console.log('✅ Post update result:', { data, error });
      
      if (!error) { 
        resetEditor(); 
        await load(); 
      }
    } else {
      const { data, error } = await sb
        .from('team_posts')
        .insert({
          team_id: teamId, // Используем число напрямую
          author_id: user.id,
          title: title.trim() || null,
          body: body.trim(),
          is_published: true
        })
        .select();
        
      console.log('✅ Post insert result:', { data, error });
      
      if (!error) { 
        resetEditor(); 
        await load(); 
      } else {
        console.error('❌ Post insert error:', error);
        alert('Ошибка при создании поста: ' + error.message);
      }
    }
  }

  async function removePost(id: string) {
    const { error } = await sb
      .from('team_posts')
      .delete()
      .eq('id', id);
    if (!error) await load();
  }

  return (
    <div className={`rounded-2xl border p-6 ${cardBg}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`text-xl font-semibold ${text}`}>Посты команды</h3>
        {canPost && (
          <motion.button
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={() => { 
              setEditorOpen(true); 
              setEditPost(null); 
              setTitle('');
              setBody('');
            }}
          >
            Написать пост
          </motion.button>
        )}
      </div>

      {/* Debug Panel */}
      <details className="mb-4">
        <summary className="text-xs text-gray-500 cursor-pointer">🛠️ Debug Info</summary>
        <div className="mt-2 p-2 bg-gray-100 dark:bg-slate-700 rounded text-xs">
          <div><strong>Team ID:</strong> {teamId} (тип: {typeof teamId})</div>
          <div><strong>Posts Count:</strong> {posts.length}</div>
          <div><strong>User ID:</strong> {user?.id || 'Not logged in'}</div>
          <div><strong>Can Post:</strong> {canPost ? 'Yes' : 'No'}</div>
        </div>
      </details>

      <AnimatePresence>
        {editorOpen && canPost && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -8 }}
            className={`mb-6 rounded-xl border p-4 ${cardBg}`}
          >
            <input
              className={`mb-2 w-full rounded-lg border px-3 py-2 ${
                theme === 'light' 
                  ? 'bg-white border-gray-200' 
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
              placeholder="Заголовок (необязательно)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className={`mb-3 w-full rounded-lg border px-3 py-2 h-28 resize-none ${
                theme === 'light' 
                  ? 'bg-white border-gray-200' 
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
              placeholder="Текст поста"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                onClick={submitPost}
                disabled={!body.trim()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                <Check className="w-4 h-4" /> 
                {editPost ? 'Обновить' : 'Опубликовать'}
              </button>
              <button
                onClick={resetEditor}
                className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-colors ${
                  theme === 'light'
                    ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <X className="w-4 h-4" /> Отмена
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className={`text-center py-8 ${muted}`}>
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <div>Загружаем посты…</div>
        </div>
      ) : posts.length === 0 ? (
        <div className={`text-center py-8 ${muted}`}>
          <div className="text-4xl mb-4">✍️</div>
          <div className="text-lg mb-2">Пока нет постов</div>
          <div className="text-sm">Команда еще не опубликовала никаких постов</div>
          {canPost && (
            <button
              onClick={() => setEditorOpen(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Написать первый пост
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              canEdit={canPost && user?.id === p.author_id}
              onEdit={() => { 
                setEditorOpen(true); 
                setEditPost(p); 
                setTitle(p.title ?? ''); 
                setBody(p.body ?? ''); 
              }}
              onDelete={() => removePost(p.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post, canEdit, onEdit, onDelete, onChanged
}: {
  post: Post; 
  canEdit: boolean; 
  onEdit: () => void; 
  onDelete: () => void; 
  onChanged: () => Promise<void> | void;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const postId = post.id;
  const cardBg = theme === 'light' ? 'bg-slate-50 border-gray-200' : 'bg-slate-700/30 border-slate-600';
  const text = theme === 'light' ? 'text-slate-900' : 'text-white';
  const muted = theme === 'light' ? 'text-slate-600' : 'text-slate-400';

  const [myLike, setMyLike] = useState<LikeRow | null>(null);
  const [likes, setLikes] = useState<number>(post.likes_count ?? 0);
  const [dislikes, setDislikes] = useState<number>(post.dislikes_count ?? 0);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await sb
        .from('team_post_likes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      setMyLike(data ?? null);
    })();
  }, [postId, user?.id]);

  async function setReaction(isLike: boolean) {
    if (!user) return;

    try {
      if (!myLike) {
        const { error } = await sb
          .from('team_post_likes')
          .insert({ 
            post_id: postId, 
            user_id: user.id, 
            is_like: isLike 
          });
        if (error) throw error;
      } else if (myLike.is_like === isLike) {
        const { error } = await sb
          .from('team_post_likes')
          .delete()
          .eq('id', myLike.id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('team_post_likes')
          .update({ is_like: isLike })
          .eq('id', myLike.id);
        if (error) throw error;
      }

      const { data: p2 } = await sb
        .from('team_posts')
        .select('likes_count, dislikes_count')
        .eq('id', postId)
        .maybeSingle();
      
      if (p2) {
        setLikes(p2.likes_count ?? 0);
        setDislikes(p2.dislikes_count ?? 0);
      }
      
      const { data: me } = await sb
        .from('team_post_likes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      setMyLike(me ?? null);
    } catch (error) {
      console.error('Error setting reaction:', error);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${cardBg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {post.title && (
            <div className={`text-lg font-semibold mb-2 ${text}`}>
              {post.title}
            </div>
          )}
          <div className={`whitespace-pre-wrap leading-relaxed ${
            theme === 'light' ? 'text-slate-800' : 'text-slate-200'
          }`}>
            {post.body}
          </div>
          <div className={`mt-3 text-xs ${muted}`}>
            {new Date(post.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onEdit} 
              className={`p-2 rounded-lg border transition-colors ${
                theme === 'light'
                  ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  : 'border-slate-600 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <Edit3 className="w-4 h-4" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onDelete} 
              className={`p-2 rounded-lg border transition-colors ${
                theme === 'light'
                  ? 'border-red-300 text-red-600 hover:bg-red-50'
                  : 'border-red-600 text-red-400 hover:bg-red-600/20'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            myLike?.is_like 
              ? 'bg-green-100 text-green-700 border border-green-300' 
              : theme === 'light'
                ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                : 'border border-slate-600 text-slate-400 hover:bg-slate-700'
          }`}
          onClick={() => setReaction(true)}
        >
          <ThumbsUp className="w-4 h-4" /> 
          <span className="font-medium">{likes}</span>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            myLike && myLike.is_like === false 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : theme === 'light'
                ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                : 'border border-slate-600 text-slate-400 hover:bg-slate-700'
          }`}
          onClick={() => setReaction(false)}
        >
          <ThumbsDown className="w-4 h-4" /> 
          <span className="font-medium">{dislikes}</span>
        </motion.button>

        <div className={`flex items-center gap-2 px-3 py-2 ${muted}`}>
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">{post.comments_count || 0}</span>
        </div>
      </div>

      <div className="mt-4">
        <Comments 
          postId={postId} 
          onChanged={async () => { await onChanged(); }} 
        />
      </div>
    </motion.div>
  );
}

function Comments({ 
  postId, 
  onChanged 
}: { 
  postId: string; 
  onChanged: () => Promise<void> | void 
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const cardBg = theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-slate-800/30 border-slate-700';
  const muted = theme === 'light' ? 'text-slate-600' : 'text-slate-400';
  const text = theme === 'light' ? 'text-slate-900' : 'text-white';

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadComments() {
    setLoading(true);
    try {
      console.log('🔍 Loading comments for post:', postId);
      
      // Простой запрос комментариев
      const { data: commentsData, error: commentsError } = await sb
        .from('team_post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      console.log('📝 Comments query result:', { commentsData, commentsError });

      if (commentsError) {
        console.error('Error loading comments:', commentsError);
        setComments([]);
        return;
      }

      // Загружаем профили отдельно для найденных комментариев
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        
        const { data: profilesData, error: profilesError } = await sb
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        console.log('👤 Profiles query result:', { profilesData, profilesError });

        // Объединяем комментарии с профилями
        const enrichedComments = commentsData.map(comment => ({
          ...comment,
          profile: profilesData?.find(p => p.id === comment.user_id) || null
        }));

        setComments(enrichedComments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('💥 Unexpected error loading comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function addComment() {
    if (!user || !newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      console.log('➕ Adding comment:', {
        post_id: postId,
        user_id: user.id,
        content: newComment.trim()
      });

      const { data, error } = await sb
        .from('team_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim()
        })
        .select();

      console.log('✅ Comment insert result:', { data, error });

      if (error) {
        console.error('❌ Comment insert error:', error);
        alert('Ошибка при добавлении комментария: ' + error.message);
      } else {
        setNewComment('');
        await loadComments();
        await onChanged();
      }
    } catch (error) {
      console.error('💥 Unexpected comment insert error:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      const { error } = await sb
        .from('team_post_comments')
        .delete()
        .eq('id', commentId);

      if (!error) {
        await loadComments();
        await onChanged();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${cardBg}`}>
      <div className={`text-sm font-medium mb-3 ${text}`}>
        Комментарии ({comments.length})
      </div>

      {/* Debug Panel */}
      <details className="mb-4">
        <summary className="text-xs text-gray-500 cursor-pointer">🛠️ Debug Info</summary>
        <div className="mt-2 p-2 bg-gray-100 dark:bg-slate-700 rounded text-xs">
          <div><strong>Post ID:</strong> {postId}</div>
          <div><strong>Comments Count:</strong> {comments.length}</div>
          <div><strong>User ID:</strong> {user?.id || 'Not logged in'}</div>
          <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
        </div>
      </details>

      {loading ? (
        <div className={`text-center py-4 ${muted}`}>
          <div className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <div>Загружаем комментарии...</div>
        </div>
      ) : comments.length === 0 ? (
        <div className={`text-center py-4 ${muted}`}>
          <div className="text-sm">Комментариев пока нет</div>
          <div className="text-xs mt-1">Станьте первым, кто оставит комментарий!</div>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map((comment, index) => (
            <motion.div 
              key={comment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-3 bg-white/70 dark:bg-slate-700/70 rounded-lg"
            >
              <div className={`h-8 w-8 rounded-full overflow-hidden shrink-0 ${
                theme === 'light' ? 'bg-slate-200' : 'bg-slate-600'
              }`}>
                {comment.profile?.avatar_url ? (
                  <img 
                    src={comment.profile.avatar_url} 
                    alt="" 
                    className="h-full w-full object-cover" 
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm">
                    👤
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className={`text-sm font-medium ${text}`}>
                  {comment.profile?.username || 'Пользователь'}
                </div>
                <div className={`text-sm mt-1 whitespace-pre-wrap ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {comment.content}
                </div>
                <div className={`text-xs mt-1 ${muted}`}>
                  {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                
                {/* Debug info для каждого комментария */}
                <details className="mt-1">
                  <summary className="text-xs text-gray-400 cursor-pointer">Debug</summary>
                  <div className="text-xs text-gray-400 mt-1">
                    <div>Comment ID: {comment.id}</div>
                    <div>User ID: {comment.user_id}</div>
                    <div>Post ID: {comment.post_id}</div>
                    <div>Profile: {JSON.stringify(comment.profile)}</div>
                  </div>
                </details>
              </div>
              
              {user?.id === comment.user_id && (
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`p-1 rounded border text-xs transition-colors ${
                    theme === 'light'
                      ? 'border-red-300 text-red-600 hover:bg-red-50'
                      : 'border-red-600 text-red-400 hover:bg-red-600/20'
                  }`}
                  onClick={() => deleteComment(comment.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Форма добавления комментария */}
      {user ? (
        <div className="space-y-2">
          <textarea
            className={`w-full rounded-lg border px-3 py-2 text-sm resize-none ${
              theme === 'light'
                ? 'bg-white border-gray-200 focus:border-blue-500'
                : 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-200`}
            placeholder="Напишите комментарий..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                addComment();
              }
            }}
          />
          <div className="flex justify-end">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={addComment}
              disabled={!newComment.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {submitting && (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Отправка...' : 'Отправить'}
            </motion.button>
          </div>
        </div>
      ) : (
        <div className={`text-center py-4 ${muted}`}>
          <div className="text-sm">Войдите, чтобы оставить комментарий</div>
        </div>
      )}
    </div>
  );
}
