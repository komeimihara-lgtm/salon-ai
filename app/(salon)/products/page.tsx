'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Package, Camera } from 'lucide-react'
import { fetchProducts, createProduct, updateProduct, deleteProduct, adjustStock, type Product } from '@/lib/products'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 商品追加・編集モーダル
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState(0)
  const [formCost, setFormCost] = useState(0)
  const [formStock, setFormStock] = useState(0)
  const [formThreshold, setFormThreshold] = useState(3)
  const [formMemo, setFormMemo] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // 在庫調整モーダル
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [stockType, setStockType] = useState<'in' | 'adjust'>('in')
  const [stockQty, setStockQty] = useState(1)
  const [stockMemo, setStockMemo] = useState('')
  const [stockSaving, setStockSaving] = useState(false)

  // AIインポートモーダル
  const [showImport, setShowImport] = useState(false)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<Omit<Product, 'id' | 'salon_id' | 'created_at'>[] | null>(null)
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState('')

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try { setProducts(await fetchProducts()) }
    catch { showToast('読み込みに失敗しました', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    setFormName(''); setFormPrice(0); setFormCost(0); setFormStock(0); setFormThreshold(3); setFormMemo('')
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditTarget(p)
    setFormName(p.name); setFormPrice(p.price); setFormCost(p.cost); setFormStock(p.stock); setFormThreshold(p.low_stock_threshold); setFormMemo(p.memo || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setFormSaving(true)
    try {
      const data = { name: formName.trim(), category: '物販', price: formPrice, cost: formCost, stock: formStock, low_stock_threshold: formThreshold, memo: formMemo }
      if (editTarget) { const updated = await updateProduct(editTarget.id, data); setProducts(prev => prev.map(p => p.id === updated.id ? updated : p)) }
      else { const created = await createProduct(data); setProducts(prev => [created, ...prev]) }
      setShowForm(false)
      showToast(editTarget ? '商品を更新しました' : '商品を追加しました')
    } catch { showToast('保存に失敗しました', 'error') }
    finally { setFormSaving(false) }
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`「${p.name}」を削除しますか？`)) return
    try { await deleteProduct(p.id); setProducts(prev => prev.filter(x => x.id !== p.id)); showToast('削除しました') }
    catch { showToast('削除に失敗しました', 'error') }
  }

  const handleStock = async () => {
    if (!stockTarget) return
    setStockSaving(true)
    try {
      await adjustStock(stockTarget.id, stockType, stockQty, stockMemo)
      showToast('在庫を更新しました')
      setStockTarget(null)
      load()
    } catch { showToast('在庫更新に失敗しました', 'error') }
    finally { setStockSaving(false) }
  }

  const handleImportExtract = async () => {
    if (importFiles.length === 0) return
    setImportLoading(true); setImportError(''); setImportPreview(null)
    try {
      const formData = new FormData()
      importFiles.forEach(f => formData.append('files', f))
      const res = await fetch('/api/products/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const items = (json.products || []).map((p: { name?: string; price?: number; cost?: number; stock?: number; memo?: string }) => ({
        name: String(p.name ?? ''),
        category: '物販',
        price: Number(p.price ?? 0),
        cost: Number(p.cost ?? 0),
        stock: Number(p.stock ?? 0),
        low_stock_threshold: 3,
        memo: p.memo,
      }))
      setImportPreview(items)
      setImportSelected(new Set(items.map((_: unknown, i: number) => i)))
    } catch (e) { setImportError(e instanceof Error ? e.message : '読み取りに失敗しました') }
    finally { setImportLoading(false) }
  }

  const handleImportSave = async () => {
    if (!importPreview) return
    setImportLoading(true)
    try {
      const toSave = importPreview.filter((_, i) => importSelected.has(i))
      for (const p of toSave) await createProduct(p)
      showToast(`${toSave.length}件の商品を登録しました`)
      setShowImport(false); setImportFiles([]); setImportPreview(null)
      load()
    } catch { showToast('登録に失敗しました', 'error') }
    finally { setImportLoading(false) }
  }

  const lowStockProducts = products.filter(p => p.stock <= p.low_stock_threshold)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans text-base font-bold text-text-main">商品管理</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-light-lav text-text-main rounded-xl text-sm font-bold hover:bg-lavender/30 transition-all">
            <Camera className="w-4 h-4" />納品書AI読み取り
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl text-sm font-bold">
            <Plus className="w-4 h-4" />商品追加
          </button>
        </div>
      </div>

      {/* 在庫アラート */}
      {lowStockProducts.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">在庫残少・在庫切れの商品があります</p>
            <p className="text-amber-700 text-sm">{lowStockProducts.map(p => `${p.name}（残${p.stock}個）`).join('　')}</p>
          </div>
        </div>
      )}

      {/* 商品一覧 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 text-rose animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-text-sub">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>商品がまだ登録されていません</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map(p => {
            const isLow = p.stock <= p.low_stock_threshold
            return (
              <div key={p.id} className="bg-white rounded-2xl p-4 card-shadow">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-text-main">{p.name}</p>
                  {isLow && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium shrink-0">残少</span>}
                </div>
                <p className="text-xl font-bold text-rose mb-1">¥{p.price.toLocaleString()}</p>
                <p className="text-sm text-text-sub mb-3">在庫: {p.stock}個　仕入: ¥{p.cost.toLocaleString()}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setStockTarget(p); setStockType('in'); setStockQty(1); setStockMemo('') }}
                    className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100">
                    在庫追加
                  </button>
                  <button onClick={() => openEdit(p)} className="p-2 text-text-sub hover:text-rose rounded-xl"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p)} className="p-2 text-text-sub hover:text-red-600 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 商品追加・編集モーダル */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-main">{editTarget ? '商品を編集' : '商品を追加'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-text-sub" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-text-sub block mb-1">商品名 *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-sub block mb-1">販売価格（円）</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
                <div><label className="text-xs text-text-sub block mb-1">仕入価格（円）</label>
                  <input type="number" value={formCost} onChange={e => setFormCost(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-sub block mb-1">在庫数</label>
                  <input type="number" value={formStock} onChange={e => setFormStock(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
                <div><label className="text-xs text-text-sub block mb-1">残少アラート数</label>
                  <input type="number" value={formThreshold} onChange={e => setFormThreshold(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
              </div>
              <div><label className="text-xs text-text-sub block mb-1">メモ</label>
                <input value={formMemo} onChange={e => setFormMemo(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-text-main font-bold">キャンセル</button>
              <button onClick={handleSave} disabled={formSaving || !formName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold disabled:opacity-50">
                {formSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 在庫調整モーダル */}
      {stockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-main">在庫を追加：{stockTarget.name}</h3>
              <button onClick={() => setStockTarget(null)}><X className="w-5 h-5 text-text-sub" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[{ value: 'in', label: '入荷' }, { value: 'adjust', label: '棚卸し（数量を直接指定）' }].map(opt => (
                  <button key={opt.value} onClick={() => setStockType(opt.value as 'in' | 'adjust')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold ${stockType === opt.value ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div><label className="text-xs text-text-sub block mb-1">{stockType === 'in' ? '追加数量' : '在庫数量（変更後）'}</label>
                <input type="number" value={stockQty} onChange={e => setStockQty(Number(e.target.value))} min={0}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
              <div><label className="text-xs text-text-sub block mb-1">メモ（任意）</label>
                <input value={stockMemo} onChange={e => setStockMemo(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStockTarget(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold">キャンセル</button>
              <button onClick={handleStock} disabled={stockSaving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold disabled:opacity-50">
                {stockSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AIインポートモーダル */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col card-shadow">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-text-main">📷 納品書AI読み取り</h3>
              <button onClick={() => { setShowImport(false); setImportFiles([]); setImportPreview(null) }}><X className="w-5 h-5 text-text-sub" /></button>
            </div>
            {!importPreview ? (
              <>
                <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-rose transition-all mb-4">
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setImportFiles(Array.from(e.target.files || []).slice(0, 10))} />
                  {importFiles.length > 0
                    ? <p className="font-medium text-text-main">{importFiles.length}枚選択済み</p>
                    : <><p className="text-4xl mb-2">📷</p><p className="text-text-sub">納品書・在庫リストの画像をアップロード（最大10枚）</p></>}
                </label>
                {importError && <p className="text-red-500 text-sm mb-3">{importError}</p>}
                <button onClick={handleImportExtract} disabled={importLoading || importFiles.length === 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {importLoading ? <><Loader2 className="w-5 h-5 animate-spin" />読み取り中...</> : '✨ AIで読み取る'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="font-bold text-text-main">読み取り結果（{importPreview.length}件）</p>
                  <div className="flex gap-2">
                    <button onClick={() => setImportPreview(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">やり直す</button>
                    <button onClick={handleImportSave} disabled={importLoading || importSelected.size === 0}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold text-sm disabled:opacity-50">
                      {importSelected.size}件を登録
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-light-lav/50 sticky top-0">
                      <tr>
                        <th className="p-3 text-left">
                          <input type="checkbox"
                            checked={importSelected.size === importPreview.length}
                            onChange={() => setImportSelected(
                              importSelected.size === importPreview.length
                                ? new Set()
                                : new Set(importPreview.map((_, i) => i))
                            )} />
                        </th>
                        <th className="p-3 text-left text-text-sub font-medium">商品名</th>
                        <th className="p-3 text-left text-text-sub font-medium">販売価格</th>
                        <th className="p-3 text-left text-text-sub font-medium">仕入価格</th>
                        <th className="p-3 text-left text-text-sub font-medium">数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((p, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="p-3">
                            <input type="checkbox" checked={importSelected.has(i)}
                              onChange={() => setImportSelected(prev => {
                                const next = new Set(prev)
                                next.has(i) ? next.delete(i) : next.add(i)
                                return next
                              })} />
                          </td>
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3">¥{p.price.toLocaleString()}</td>
                          <td className="p-3">¥{p.cost.toLocaleString()}</td>
                          <td className="p-3">{p.stock}個</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
