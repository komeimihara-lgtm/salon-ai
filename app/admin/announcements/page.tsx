'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, X } from 'lucide-react'

type Announcement = {
  id: string
  title: string
  body: string
  type: 'info' | 'update' | 'maintenance' | 'important'
  target_plan: string
  is_published: boolean
  published_at: string | null
  created_at: string
}

const TYPE_CONFIG = {
  info: { label: 'お知らせ', color: 'bg-blue-100 text-blue-700' },
  update: { label: 'アップデート', color: 'bg-green-100 text-green-700' },
  maintenance: { label: 'メンテナンス', color: 'bg-yellow-100 text-yellow-700' },
  important: { label: '重要', color: 'bg-red-100 text-red-700' },
}

const PLAN_OPTIONS = [
  { value: 'all', label: '全プラン' },
  { value: 'LITE', label: 'LITE' },
  { value: 'PRO', label: 'PRO' },
  { value: 'MAX', label: 'MAX' },
]

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', body: '', type: 'info', target_plan: 'all', is_published: false })

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements')
      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const openCreate = () => {
    setEditId(null)
    setForm({ title: '', body: '', type: 'info', target_plan: 'all', is_published: false })
    setShowModal(true)
  }

  const openEdit = (a: Announcement) => {
    setEditId(a.id)
    setForm({ title: a.title, body: a.body, type: a.type, target_plan: a.target_plan, is_published: a.is_published })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      if (editId) {
        await fetch(`/api/admin/announcements/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      setShowModal(false)
      fetchAnnouncements()
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    fetchAnnouncements()
  }

  const togglePublish = async (a: Announcement) => {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !a.is_published }),
    })
    fetchAnnouncements()
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex items-center justify-between">
        <div>
          <div className="w-12 h-[3px] bg-gradient-to-r from-[#1a2744] to-[#C9A84C] mb-3 rounded-full" />
          <h2 className="text-2xl font-bold text-[#1a2744]">お知らせ管理</h2>
          <p className="text-gray-500 text-sm mt-1">サロン向けのお知らせを作成・管理します</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1a2744] to-[#C9A84C] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> 新規作成
        </button>
      </div>

      {/* お知らせ一覧 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">お知らせはまだありません</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {announcements.map(a => (
              <div key={a.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_CONFIG[a.type]?.color || ''}`}>
                        {TYPE_CONFIG[a.type]?.label || a.type}
                      </span>
                      <span className="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">
                        {a.target_plan === 'all' ? '全プラン' : a.target_plan}
                      </span>
                      {a.is_published ? (
                        <span className="text-[10px] text-green-600 flex items-center gap-0.5"><Eye className="w-3 h-3" /> 公開中</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><EyeOff className="w-3 h-3" /> 下書き</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{a.title}</p>
                    {a.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(a.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => togglePublish(a)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                      {a.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(a)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg card-shadow">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[#1a2744]">{editId ? 'お知らせ編集' : '新規お知らせ'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">タイトル</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">本文</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">種別</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                    <option value="info">お知らせ</option>
                    <option value="update">アップデート</option>
                    <option value="maintenance">メンテナンス</option>
                    <option value="important">重要</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">対象プラン</label>
                  <select value={form.target_plan} onChange={e => setForm(f => ({ ...f, target_plan: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                    {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-600">公開する</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">キャンセル</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-gradient-to-r from-[#1a2744] to-[#C9A84C] text-white rounded-xl hover:opacity-90">{editId ? '更新' : '作成'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
