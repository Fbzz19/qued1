import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Lock, Globe, Trash2, X, Film, Tv, Heart, CreditCard as Edit3, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { posterUrl } from '../lib/tmdb';
import type { List, ListItem } from '../lib/supabase';

interface ListsPageProps {
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
  viewUserId?: string;
  viewUsername?: string;
}

interface ListWithItems extends List {
  items: ListItem[];
  isLiked?: boolean;
  isFollowed?: boolean;
  owner_username?: string;
}

export default function ListsPage({ onBack, onMediaClick, viewUserId, viewUsername }: ListsPageProps) {
  const { user, profile } = useAuth();
  const targetUserId = viewUserId ?? user?.id;
  const isOwn = !viewUserId || viewUserId === user?.id;

  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [activeList, setActiveList] = useState<ListWithItems | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [createError, setCreateError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadLists = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);

    const query = supabase.from('lists').select('*').eq('user_id', targetUserId);
    const { data: rawLists } = isOwn ? await query.order('created_at', { ascending: false }) : await query.eq('is_public', true).order('created_at', { ascending: false });

    if (!rawLists) { setLoading(false); return; }

    // Fetch items for each list
    const listIds = rawLists.map(l => l.id);
    const { data: allItems } = listIds.length
      ? await supabase.from('list_items').select('*').in('list_id', listIds)
      : { data: [] };

    // Fetch owner username if viewing someone else
    let ownerUsername = isOwn ? (profile?.username ?? '') : (viewUsername ?? '');

    // Fetch likes and follows for current user
    let likedIds = new Set<string>();
    let followedIds = new Set<string>();
    if (user && !isOwn) {
      const { data: ll } = await supabase.from('list_likes').select('list_id').eq('user_id', user.id).in('list_id', listIds);
      likedIds = new Set((ll ?? []).map((l: { list_id: string }) => l.list_id));
      const { data: lf } = await supabase.from('list_follows').select('list_id').eq('user_id', user.id).in('list_id', listIds);
      followedIds = new Set((lf ?? []).map((l: { list_id: string }) => l.list_id));
    }

    const withItems: ListWithItems[] = rawLists.map(l => ({
      ...l,
      items: (allItems ?? []).filter(i => i.list_id === l.id),
      isLiked: likedIds.has(l.id),
      isFollowed: followedIds.has(l.id),
      owner_username: ownerUsername,
    }));

    setLists(withItems);
    setLoading(false);
  }, [targetUserId, isOwn, user, profile, viewUsername]);

  useEffect(() => { loadLists(); }, [loadLists]);

  async function createList() {
    if (!user || !newName.trim()) { setCreateError('Name is required'); return; }
    const { data } = await supabase.from('lists').insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim(),
      is_public: newPublic,
    }).select().single();
    if (data) {
      setLists(ls => [{ ...data, items: [], isLiked: false, isFollowed: false }, ...ls]);
      setCreating(false);
      setNewName(''); setNewDesc(''); setNewPublic(true);
    }
  }

  async function deleteList(listId: string) {
    if (!confirm('Delete this list?')) return;
    await supabase.from('lists').delete().eq('id', listId).eq('user_id', user!.id);
    setLists(ls => ls.filter(l => l.id !== listId));
    if (activeList?.id === listId) setActiveList(null);
  }

  async function removeItem(listId: string, itemId: string) {
    await supabase.from('list_items').delete().eq('id', itemId);
    setLists(ls => ls.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l));
    if (activeList?.id === listId) {
      setActiveList(a => a ? { ...a, items: a.items.filter(i => i.id !== itemId) } : a);
    }
  }

  async function toggleLike(list: ListWithItems) {
    if (!user) return;
    if (list.isLiked) {
      await supabase.from('list_likes').delete().eq('list_id', list.id).eq('user_id', user.id);
      await supabase.from('lists').update({ like_count: Math.max(0, (list.like_count ?? 1) - 1) }).eq('id', list.id);
    } else {
      await supabase.from('list_likes').insert({ list_id: list.id, user_id: user.id });
      await supabase.from('lists').update({ like_count: (list.like_count ?? 0) + 1 }).eq('id', list.id);
    }
    setLists(ls => ls.map(l => l.id === list.id ? { ...l, isLiked: !l.isLiked, like_count: l.like_count + (l.isLiked ? -1 : 1) } : l));
  }

  async function toggleFollow(list: ListWithItems) {
    if (!user) return;
    if (list.isFollowed) {
      await supabase.from('list_follows').delete().eq('list_id', list.id).eq('user_id', user.id);
      await supabase.from('lists').update({ follower_count: Math.max(0, (list.follower_count ?? 1) - 1) }).eq('id', list.id);
    } else {
      await supabase.from('list_follows').insert({ list_id: list.id, user_id: user.id });
      await supabase.from('lists').update({ follower_count: (list.follower_count ?? 0) + 1 }).eq('id', list.id);
    }
    setLists(ls => ls.map(l => l.id === list.id ? { ...l, isFollowed: !l.isFollowed, follower_count: l.follower_count + (l.isFollowed ? -1 : 1) } : l));
  }

  async function saveListEdit(list: ListWithItems) {
    await supabase.from('lists').update({ name: list.name, description: list.description, is_public: list.is_public }).eq('id', list.id);
    setLists(ls => ls.map(l => l.id === list.id ? list : l));
    setActiveList(list);
    setEditing(false);
  }

  const displayName = isOwn ? 'My Lists' : `${viewUsername ?? 'User'}'s Lists`;

  // Active list detail view
  if (activeList) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
        <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(5,5,5,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setActiveList(null); setEditing(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <ArrowLeft size={20} />
          </button>
          {editing && isOwn ? (
            <input
              value={activeList.name}
              onChange={e => setActiveList(a => a ? { ...a, name: e.target.value } : a)}
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 18, fontWeight: 700, fontFamily: 'inherit' }}
            />
          ) : (
            <h1 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700, flex: 1 }}>{activeList.name}</h1>
          )}
          {isOwn && !editing && (
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><Edit3 size={16} /></button>
          )}
          {isOwn && editing && (
            <button onClick={() => saveListEdit(activeList)} className="btn-gold" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}>Save</button>
          )}
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px clamp(16px,3vw,32px)' }}>
          {/* List metadata */}
          <div style={{ marginBottom: 24 }}>
            {editing ? (
              <>
                <textarea
                  value={activeList.description}
                  onChange={e => setActiveList(a => a ? { ...a, description: e.target.value } : a)}
                  placeholder="Description (optional)"
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 14px', color: '#ccc', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }}
                />
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Visibility:</span>
                  {(['public', 'private'] as const).map(v => (
                    <button key={v} onClick={() => setActiveList(a => a ? { ...a, is_public: v === 'public' } : a)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${(v === 'public') === activeList.is_public ? '#f59e0b' : '#2e2e2e'}`, background: 'none', color: (v === 'public') === activeList.is_public ? '#fbbf24' : '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {v === 'public' ? <Globe size={12} style={{ display: 'inline', marginRight: 4 }} /> : <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />}{v}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {activeList.is_public ? <Globe size={13} color="#888" /> : <Lock size={13} color="#888" />}
                  <span style={{ color: '#666', fontSize: 13 }}>{activeList.is_public ? 'Public' : 'Private'}</span>
                </div>
                <span style={{ color: '#666', fontSize: 13 }}>{activeList.items.length} items</span>
                {!isOwn && (
                  <>
                    <span style={{ color: '#555', fontSize: 13 }}>{activeList.like_count ?? 0} likes</span>
                    <span style={{ color: '#555', fontSize: 13 }}>{activeList.follower_count ?? 0} followers</span>
                  </>
                )}
                {activeList.description && <p style={{ margin: 0, color: '#888', fontSize: 13, width: '100%' }}>{activeList.description}</p>}
              </div>
            )}
          </div>

          {/* Social actions for other user lists */}
          {!isOwn && user && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button onClick={() => toggleLike(activeList)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${activeList.isLiked ? 'rgba(239,68,68,.4)' : '#2e2e2e'}`, background: activeList.isLiked ? 'rgba(239,68,68,.1)' : 'none', color: activeList.isLiked ? '#f87171' : '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Heart size={13} fill={activeList.isLiked ? 'currentColor' : 'none'} /> {activeList.like_count ?? 0} Likes
              </button>
              <button onClick={() => toggleFollow(activeList)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${activeList.isFollowed ? 'rgba(245,158,11,.4)' : '#2e2e2e'}`, background: activeList.isFollowed ? 'rgba(245,158,11,.06)' : 'none', color: activeList.isFollowed ? '#fbbf24' : '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Users size={13} /> {activeList.isFollowed ? 'Following' : 'Follow'}
              </button>
            </div>
          )}

          {/* Items grid */}
          {activeList.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Film size={32} color="#2a2a2a" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, color: '#555', fontSize: 14 }}>No items in this list yet</p>
              {isOwn && <p style={{ margin: '6px 0 0', color: '#444', fontSize: 13 }}>Add films or shows from their detail pages</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px,15vw,150px),1fr))', gap: 12 }}>
              {activeList.items.map(item => (
                <div key={item.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => onMediaClick(item.tmdb_id, item.media_type)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
                  >
                    <div className="poster-card" style={{ aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', border: '1px solid #1e1e1e', background: '#111', marginBottom: 6 }}>
                      {item.poster_path
                        ? <img src={posterUrl(item.poster_path)!} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.media_type === 'tv' ? <Tv size={20} color="#333" /> : <Film size={20} color="#333" />}
                          </div>
                      }
                    </div>
                    <p style={{ margin: 0, color: '#ccc', fontSize: 11, textAlign: 'left', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</p>
                  </button>
                  {isOwn && (
                    <button
                      onClick={() => removeItem(activeList.id, item.id)}
                      title="Remove"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(5,5,5,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>{displayName}</h1>
        </div>
        {isOwn && user && (
          <button
            onClick={() => setCreating(true)}
            className="btn-gold"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', borderRadius: 10 }}
          >
            <Plus size={14} /> New List
          </button>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px clamp(16px,3vw,32px)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>Loading...</div>
        ) : lists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Film size={40} color="#1e1e1e" style={{ marginBottom: 16 }} />
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: 15 }}>{isOwn ? "You haven't created any lists yet" : 'No public lists'}</p>
            {isOwn && <p style={{ margin: 0, color: '#444', fontSize: 13 }}>Create a list to organize your films and shows</p>}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setActiveList(list)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color .2s, background .2s', width: '100%' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLButtonElement).style.background = '#111'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.background = '#0d0d0d'; }}
              >
                {/* Mini poster strip */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {list.items.slice(0, 3).map((item, i) => (
                    <div key={i} style={{ width: 36, height: 54, borderRadius: 6, overflow: 'hidden', background: '#1a1a1a' }}>
                      {item.poster_path
                        ? <img src={posterUrl(item.poster_path)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Film size={12} color="#333" />
                          </div>
                      }
                    </div>
                  ))}
                  {list.items.length === 0 && (
                    <div style={{ width: 36, height: 54, borderRadius: 6, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={12} color="#333" />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#e5e5e5', fontSize: 15, fontWeight: 600 }}>{list.name}</span>
                    {list.is_public ? <Globe size={12} color="#555" /> : <Lock size={12} color="#555" />}
                  </div>
                  {list.description && <p style={{ margin: '0 0 6px', color: '#666', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.description}</p>}
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ color: '#555', fontSize: 12 }}>{list.items.length} items</span>
                    {list.like_count > 0 && <span style={{ color: '#555', fontSize: 12 }}>{list.like_count} likes</span>}
                    {list.follower_count > 0 && <span style={{ color: '#555', fontSize: 12 }}>{list.follower_count} followers</span>}
                  </div>
                </div>

                {isOwn && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                    title="Delete list"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 6, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create list modal */}
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24 }}
          onClick={() => setCreating(false)}>
          <div style={{ background: '#111', border: '1px solid #2e2e2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>Create New List</h3>
              <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}><X size={16} /></button>
            </div>
            <input
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(''); }}
              placeholder="List name *"
              maxLength={100}
              style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${createError ? '#ef4444' : '#2e2e2e'}`, borderRadius: 10, padding: '10px 14px', color: '#e5e5e5', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />
            {createError && <p style={{ margin: '-4px 0 10px', color: '#ef4444', fontSize: 12 }}>{createError}</p>}
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              rows={3}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 14px', color: '#ccc', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {[{ v: true, label: 'Public', icon: <Globe size={13} /> }, { v: false, label: 'Private', icon: <Lock size={13} /> }].map(({ v, label, icon }) => (
                <button key={label} onClick={() => setNewPublic(v)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: `1px solid ${newPublic === v ? '#f59e0b' : '#2e2e2e'}`, background: newPublic === v ? 'rgba(245,158,11,.08)' : 'none', color: newPublic === v ? '#fbbf24' : '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <button onClick={createList} className="btn-gold" style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 14 }}>
              Create List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
