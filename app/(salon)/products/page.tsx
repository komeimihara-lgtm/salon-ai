'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil, X, Loader2, Camera } from 'lucide-react'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  type Product,
} from '@/lib/products'

type ImportProduct = { id: string; name: string; price: number; quantity: number; memo?: string; needsReview?: boolean }

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (items: ImportProduct[]) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportProduct[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const handleExtract = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください')
      return
    }
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const formData = new FormData()
      files.slice(0, 10).forEach(f => formData.append('files', f))
      const res = await fetch('/api/products/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const items: ImportProduct[] = (json.products || []).map((p: { name?: string; price?: number; quantity?: number; memo?: string }, i: number) => ({
        id: `imp-${Date.now()}-${i}`,
        name: String(p.name ?? ''),
        price: Number(p.price ?? 0),
        quantity: Number(p.quantity ?? 1),
        memo: p.memo,
      }))
      setPreview(items)
      setSelectedIds(new Set(items.map(x => x.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取りに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (!preview) return
    onImport(preview.filter(x => selectedIds.has(x.id)))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-text-main">📷 納品書AI読み取り</h3>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-rose rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 mb-4">
          <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm" />
          {files.length > 0 && <p className="text-sm text-text-sub">{files.length}件選択（最大10枚）</p>}
        </div>
        <button onClick={handleExtract} disabled={loading || files.length === 0}
          className="w-full py-3 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          {loading ? '読み取り中...' : '読み取り実行'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {preview && preview.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto mt-4 border rounded-xl p-3 mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2"><input type="checkbox" checked={selectedIds.size === preview.length} onChange={() => selectedIds.size === preview.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(preview.map(x => x.id)))} /></th>
                    <th className="text-left p-2">商品名</th>
                    <th className="text-left p-2">単価</th>
                    <th className="text-left p-2">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="p-2"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => setSelectedIds(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} /></td>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2">¥{p.price.toLocaleString()}</td>
                      <td className="p-2">{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleImport} className="w-full py-3 bg-rose text-white rounded-xl font-bold">
              選択をインポート
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [stockModal, setStockModal] = useState<Product | null>(null)
  const [stockQty, setStockQty] = useState(0)
  const [stockMemo, setStockMemo] = useState('')
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', category: '物販', price: 0, cost: 0, stock: 0, low_stock_threshold: 5, barcode: '', memo: '' })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchProducts()
      setProducts(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const lowStockProducts = products.filter(p => p.stock <= p.low_stock_threshold)
  const outOfStock = products.filter(p => p.stock <= 0)

  const handleCreate = async () => {
    if (!form.name.trim()) return
    try {
      const p = await createProduct({ ...form, barcode: form.barcode || undefined, memo: form.memo || undefined })
      setProducts(prev => [...prev, p])
      setShowAdd(false)
      setForm({ name: '', category: '物販', price: 0, cost: 0, stock: 0, low_stock_threshold: 5, barcode: '', memo: '' })
    } catch (e) {
      alert(e instanceof Error ? e.message : '登録に失敗しました')
    }
  }

  const handleUpdate = async () => {
    if (!editProduct) return
    try {
      const p = await updateProduct(editProduct.id, { ...editProduct })
      setProducts(prev => prev.map(x => x.id === p.id ? p : x))
      setEditProduct(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    try {
      await deleteProduct(id)
      setProducts(prev => prev.filter(x => x.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  const handleStockAdd = async () => {
    if (!stockModal || stockQty <= 0) return
    try {
      await adjustStock(stockModal.id, 'in', stockQty, stockMemo)
      await refresh()
      setStockModal(null)
      setStockQty(0)
      setStockMemo('')
    } catch (e) {
      alert(e instanceof Error ? e.message : '在庫追加に失敗しました')
    }
  }

  const handleImport = async (items: ImportProduct[]) => {
    for (const it of items) {
      try {
        await createProduct({
          name: it.name,
          category: '物販',
          price: it.price,
          cost: 0,
          stock: it.quantity ?? 1,
          low_stock_threshold: 5,
        })
      } catch (e) {
        console.error(e)
      }
    }
    await refresh()
    setShowImport(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 在庫切れ・残少アラート */}
      {(outOfStock.length > 0 || lowStockProducts.length > 0) && (
        <div className="space-y-2">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-red-700">在庫切れ: {outOfStock.length}件</p>
              <p className="text-xs text-red-600">{outOfStock.map(p => p.name).join(', ')}</p>
            </div>
          )}
          {lowStockProducts.length > 0 && outOfStock.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-amber-700">残少アラート: {lowStockProducts.length}件</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="font-dm-sans text-lg font-bold text-rose">商品管理</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 bg-light-lav text-text-main rounded-xl font-medium hover:bg-rose/10">
            <Camera className="w-4 h-4" />📷 納品書AI読み取り
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
            <Plus className="w-4 h-4" />＋商品追加
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-12 h-12 text-rose animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 card-shadow border border-gray-100 overflow-hidden">
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-4 -mt-4 mb-3" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-text-main">{p.name}</p>
                  <p className="text-xl font-bold text-rose mt-1">¥{p.price.toLocaleString()}</p>
                  <p className="text-sm text-text-sub mt-0.5">在庫: {p.stock} · {p.category}</p>
                  {p.stock <= p.low_stock_threshold && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">残少</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setStockModal(p); setStockQty(0); setStockMemo('') }} className="flex-1 py-2 rounded-lg bg-light-lav text-sm font-medium hover:bg-rose/10">在庫追加</button>
                <button onClick={() => setEditProduct(p)} className="p-2 text-text-sub hover:text-rose rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-text-sub hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 商品追加モーダル */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">商品追加</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-text-sub block mb-1">商品名 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2 rounded-xl border" placeholder="例: 化粧水" /></div>
              <div><label className="text-xs text-text-sub block mb-1">カテゴリ</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2 rounded-xl border" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-sub block mb-1">販売価格</label><input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) || 0 }))} className="w-full px-4 py-2 rounded-xl border" /></div>
                <div><label className="text-xs text-text-sub block mb-1">原価</label><input type="number" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value) || 0 }))} className="w-full px-4 py-2 rounded-xl border" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-sub block mb-1">在庫数</label><input type="number" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) || 0 }))} className="w-full px-4 py-2 rounded-xl border" /></div>
                <div><label className="text-xs text-text-sub block mb-1">残少閾値</label><input type="number" value={form.low_stock_threshold || ''} onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) || 5 }))} className="w-full px-4 py-2 rounded-xl border" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl border">キャンセル</button>
              <button onClick={handleCreate} disabled={!form.name.trim()} className="flex-1 py-2 rounded-xl bg-rose text-white font-bold disabled:opacity-50">追加</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">商品編集</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-text-sub block mb-1">商品名</label><input value={editProduct.name} onChange={e => setEditProduct(p => p ? { ...p, name: e.target.value } : null)} className="w-full px-4 py-2 rounded-xl border" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-sub block mb-1">販売価格</label><input type="number" value={editProduct.price} onChange={e => setEditProduct(p => p ? { ...p, price: Number(e.target.value) || 0 } : null)} className="w-full px-4 py-2 rounded-xl border" /></div>
                <div><label className="text-xs text-text-sub block mb-1">在庫数</label><input type="number" value={editProduct.stock} onChange={e => setEditProduct(p => p ? { ...p, stock: Number(e.target.value) || 0 } : null)} className="w-full px-4 py-2 rounded-xl border" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditProduct(null)} className="flex-1 py-2 rounded-xl border">キャンセル</button>
              <button onClick={handleUpdate} className="flex-1 py-2 rounded-xl bg-rose text-white font-bold">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 在庫追加モーダル */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-2">在庫追加: {stockModal.name}</h3>
            <p className="text-sm text-text-sub mb-1">現在の在庫: {stockModal.stock}</p>
            <input type="number" value={stockQty || ''} onChange={e => setStockQty(Number(e.target.value) || 0)} placeholder="数量" className="w-full px-4 py-2 rounded-xl border mb-2" min={1} />
            <input value={stockMemo} onChange={e => setStockMemo(e.target.value)} placeholder="メモ（任意）" className="w-full px-4 py-2 rounded-xl border mb-2" />
            <div className="flex gap-2">
              <button onClick={() => { setStockModal(null); setStockQty(0); setStockMemo('') }} className="flex-1 py-2 rounded-xl border">キャンセル</button>
              <button onClick={handleStockAdd} disabled={stockQty <= 0} className="flex-1 py-2 rounded-xl bg-rose text-white font-bold disabled:opacity-50">追加</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
    </div>
  )
}
