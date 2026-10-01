'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function RiwayatSkpPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('riwayat')
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // State form tambah SKP sesuai kolom Supabase
  const [formSkp, setFormSkp] = useState({
    tahun: new Date().getFullYear().toString(),
    status: 'Tahunan',
    atasanLangsung: '',
    nipAtasanLangsung: '',
    atasanAtlas: '',
    nipAtasanAtlas: '',
    nilaiSkp: '',
    nilaiPerilaku: '',
    predikat: 'Baik'
  })
  const [fileSkp, setFileSkp] = useState<File | null>(null)

  const [skpList, setSkpList] = useState<any[]>([])
  const [siasnData, setSiasnData] = useState<any[]>([])
  const [logList, setLogList] = useState<any[]>([])

  useEffect(() => {
    const role = localStorage.getItem('role_aktif')
    if (role === 'admin') {
      setIsAdmin(true)
    }

    const fetchData = async () => {
      const nipAktif = localStorage.getItem('nip_aktif')
      if (!nipAktif) {
        router.push('/login')
        return
      }

      // 1. Ambil data pegawai berdasarkan NIP
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('nip', nipAktif)
        .single()

      if (empError || !empData) {
        console.error('Gagal memuat data pegawai:', empError?.message)
        setLoading(false)
        return
      }

      setEmployee(empData)

      // 2. Ambil data riwayat SKP dari tabel skp_history
      const { data: skpData, error: skpError } = await supabase
        .from('skp_history')
        .select('*')
        .eq('employee_id', empData.id)
        .order('tahun', { ascending: false })

      if (skpError) {
        console.error('Gagal memuat riwayat SKP:', skpError.message)
      } else {
        setSkpList(skpData || [])
        setSiasnData(skpData || [])
        setLogList((skpData || []).map(item => ({
          id: item.id,
          aktivitas: `Penambahan SKP Tahun ${item.tahun} (${item.status || 'Tahunan'})`,
          waktu: item.updated_at,
          user: empData.nama
        })))
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  // Fungsi Tambah Data SKP & Upload PDF ke Supabase Storage (Hanya Admin)
  const handleTambahSkp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menambah data.')
      return
    }
    if (!employee) return

    setUploading(true)
    let publicUrl = null

    try {
      if (fileSkp) {
        const fileExt = fileSkp.name.split('.').pop()
        const fileName = `skp_${employee.nip}_${formSkp.tahun}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(filePath, fileSkp)

        if (uploadError) {
          alert('Gagal mengupload file PDF: ' + uploadError.message)
          setUploading(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('arsip_sk')
          .getPublicUrl(filePath)

        publicUrl = urlData.publicUrl
      }

      const dataBaru = {
        employee_id: employee.id,
        tahun: parseInt(formSkp.tahun) || new Date().getFullYear(),
        status: formSkp.status,
        atasan_langsung: formSkp.atasanLangsung,
        nip_atasan_langsung: formSkp.nipAtasanLangsung,
        atasan_atlas: formSkp.atasanAtlas,
        nip_atasan_atlas: formSkp.nipAtasanAtlas,
        nilai_skp: parseFloat(formSkp.nilaiSkp) || 0,
        nilai_perilaku: parseFloat(formSkp.nilaiPerilaku) || 0,
        predikat: formSkp.predikat,
        file_skp_url: publicUrl,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('skp_history')
        .insert([dataBaru])
        .select()

      if (error) {
        alert('Gagal menyimpan data SKP ke Supabase: ' + error.message)
      } else {
        alert('Data SKP berhasil disimpan!')
        if (data) {
          setSkpList([data[0], ...skpList])
          setLogList([
            {
              id: data[0].id,
              aktivitas: `Penambahan SKP Tahun ${data[0].tahun} (${data[0].status})`,
              waktu: data[0].updated_at,
              user: employee.nama
            },
            ...logList
          ])
        }
        setFormSkp({
          tahun: new Date().getFullYear().toString(),
          status: 'Tahunan',
          atasanLangsung: '',
          nipAtasanLangsung: '',
          atasanAtlas: '',
          nipAtasanAtlas: '',
          nilaiSkp: '',
          nilaiPerilaku: '',
          predikat: 'Baik'
        })
        setFileSkp(null)
        setShowModal(false)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Fungsi Hapus Data SKP (Hanya Admin)
  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menghapus data.')
      return
    }

    if (confirm('Apakah Anda yakin ingin menghapus riwayat SKP ini?')) {
      const { error } = await supabase
        .from('skp_history')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Gagal menghapus data: ' + error.message)
      } else {
        setSkpList(skpList.filter((item) => item.id !== id))
        alert('Data berhasil dihapus.')
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data SKP dari database...</div>
  }

  return (
   <div className="flex min-h-screen bg-gray-50">
        <aside className="w-64 bg-white border-r hidden md:block p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img 
              src="data:image/png;base64,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" 
              alt="Logo PU" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xs font-bold text-[#1b2a4a] leading-tight">
              ARSIP KEPEGAWAIAN<br/>BBWS VIII
            </span>
          </div>
          <nav className="space-y-1 text-sm">
            <a href="/dashboard" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Halaman Utama</a>
            <a href="#" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Data Saya</a>
            <a href="/dashboard" className="block p-2.5 rounded bg-sky-900 text-white font-semibold">Riwayat Kepegawaian</a>
            <a href="#" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Info Kepegawaian</a>
          </nav>
        </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              🏠 / Data-saya / <span className="text-gray-800 font-medium">Riwayat SKP</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Riwayat SKP</h1>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-full shadow-sm border">
            <span className="text-sm font-semibold text-gray-700 px-2">{employee?.nama || 'Pengguna'}</span>
            <span className="bg-sky-500 text-white text-xs px-3 py-1 rounded-full font-mono">{employee?.nip || '-'}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-sm bg-white border px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
          >
            ← Kembali
          </button>
        </div>

        {/* Tab Navigasi Sekunder */}
        <div className="flex items-center gap-2 mb-6 border-b pb-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('riwayat')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'riwayat' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Riwayat SKP
          </button>
          <button 
            onClick={() => setActiveTab('siasn')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'siasn' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Data SIASN
          </button>
          <button 
            onClick={() => setActiveTab('log')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'log' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Log
          </button>
        </div>

        {/* TAB 1: RIWAYAT SKP */}
        {activeTab === 'riwayat' && (
          <div>
            {isAdmin && (
              <div className="mb-4">
                <button 
                  onClick={() => setShowModal(true)}
                  className="bg-[#1b2a4a] hover:bg-sky-900 text-white text-xs font-bold px-5 py-3 rounded-lg shadow transition tracking-wider uppercase"
                >
                  + TAMBAH DATA
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="p-3 text-center">NO</th>
                      <th className="p-3">TAHUN</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3">ATASAN LANGSUNG</th>
                      <th className="p-3">ATASAN ATLAS</th>
                      <th className="p-3">NILAI SKP</th>
                      <th className="p-3">NILAI PERILAKU</th>
                      <th className="p-3">PREDIKAT</th>
                      <th className="p-3 text-center">FILE SKP</th>
                      {isAdmin && <th className="p-3 text-center">AKSI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs text-gray-700">
                    {skpList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} className="p-8 text-center text-gray-400 italic">
                          Belum ada data riwayat SKP. {isAdmin ? 'Silakan klik tombol "+ TAMBAH DATA" untuk menambahkan.' : ''}
                        </td>
                      </tr>
                    ) : (
                      skpList.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-center font-semibold">{index + 1}</td>
                          <td className="p-3 font-bold">{item.tahun}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[11px] font-medium border border-sky-200">
                              {item.status || 'Tahunan'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{item.atasan_langsung || '-'}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{item.nip_atasan_langsung}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{item.atasan_atlas || '-'}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{item.nip_atasan_atlas}</div>
                          </td>
                          <td className="p-3 font-bold text-emerald-600">{item.nilai_skp || '-'}</td>
                          <td className="p-3 font-bold text-blue-600">{item.nilai_perilaku || '-'}</td>
                          <td className="p-3 font-semibold">{item.predikat || '-'}</td>
                          <td className="p-3 text-center">
                            {item.file_skp_url ? (
                              <a 
                                href={item.file_skp_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block text-sky-600 hover:text-sky-800 font-medium underline"
                                title="Lihat Berkas PDF"
                              >
                                📄 Buka PDF
                              </a>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">Tidak ada file</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Hapus">🗑️</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-4 bg-white border-t">
                <span className="text-xs text-gray-500">Menampilkan {skpList.length} data</span>
                <div className="flex gap-1">
                  <button className="px-3 py-1 border rounded text-xs text-gray-500 hover:bg-gray-100">⟨</button>
                  <button className="px-3 py-1 bg-[#1b2a4a] text-white rounded text-xs font-bold">1</button>
                  <button className="px-3 py-1 border rounded text-xs text-gray-500 hover:bg-gray-100">⟩</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DATA SIASN */}
        {activeTab === 'siasn' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Data SIASN SKP</h3>
              {isAdmin && (
                <button onClick={() => alert('Sinkronisasi SIASN SKP berhasil!')} className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  🔄 Sinkronisasi SIASN
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 uppercase">
                    <th className="p-3">Tahun</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Nilai SKP</th>
                    <th className="p-3">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {siasnData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 italic">Belum ada data SKP dari server SIASN.</td>
                    </tr>
                  ) : (
                    siasnData.map((s, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3 font-semibold">{s.tahun}</td>
                        <td className="p-3">{s.status || 'Tahunan'}</td>
                        <td className="p-3 font-bold text-emerald-600">{s.nilai_skp}</td>
                        <td className="p-3">{s.predikat}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LOG AKTIVITAS */}
        {activeTab === 'log' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Log Riwayat Aktivitas SKP</h3>
            {logList.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">Belum ada catatan aktivitas.</p>
            ) : (
              <div className="space-y-3">
                {logList.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border text-xs">
                    <div>
                      <span className="font-semibold text-gray-800">{log.aktivitas}</span>
                      <p className="text-gray-500 text-[11px] mt-0.5">Oleh: {employee?.nama}</p>
                    </div>
                    <span className="font-mono text-gray-400 text-[11px]">{new Date(log.waktu).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Tambah SKP (Hanya Admin) */}
        {isAdmin && showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Tambah Riwayat SKP Baru</h3>
              <form onSubmit={handleTambahSkp} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Tahun</label>
                    <input 
                      type="number" 
                      required
                      placeholder="2026"
                      value={formSkp.tahun}
                      onChange={(e) => setFormSkp({...formSkp, tahun: e.target.value})}
                      className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Status / Periode</label>
                    <select 
                      value={formSkp.status}
                      onChange={(e) => setFormSkp({...formSkp, status: e.target.value})}
                      className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500 bg-white"
                    >
                      <option value="Tahunan">Tahunan</option>
                      <option value="Periode 1">Periode 1</option>
                      <option value="Periode 2">Periode 2</option>
                      <option value="Periode 3">Periode 3</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nama Atasan Langsung</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Chairul Huda S.T."
                    value={formSkp.atasanLangsung}
                    onChange={(e) => setFormSkp({...formSkp, atasanLangsung: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">NIP Atasan Langsung</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 197011211990031003"
                    value={formSkp.nipAtasanLangsung}
                    onChange={(e) => setFormSkp({...formSkp, nipAtasanLangsung: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nama Atasan ATLAS (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Nama Atasan ATLAS..."
                    value={formSkp.atasanAtlas}
                    onChange={(e) => setFormSkp({...formSkp, atasanAtlas: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">NIP Atasan ATLAS (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="NIP Atasan ATLAS..."
                    value={formSkp.nipAtasanAtlas}
                    onChange={(e) => setFormSkp({...formSkp, nipAtasanAtlas: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Nilai SKP</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Contoh: 89.5"
                      value={formSkp.nilaiSkp}
                      onChange={(e) => setFormSkp({...formSkp, nilaiSkp: e.target.value})}
                      className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Nilai Perilaku</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Contoh: 90.2"
                      value={formSkp.nilaiPerilaku}
                      onChange={(e) => setFormSkp({...formSkp, nilaiPerilaku: e.target.value})}
                      className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Predikat</label>
                  <select 
                    value={formSkp.predikat}
                    onChange={(e) => setFormSkp({...formSkp, predikat: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500 bg-white"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                    <option value="Kurang">Kurang</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Upload Berkas SKP (PDF)</label>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileSkp(e.target.files[0])
                      }
                    }}
                    className="w-full border rounded p-1.5 bg-gray-50 text-gray-600 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 font-medium"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="px-4 py-2 bg-[#1b2a4a] text-white rounded font-semibold hover:bg-sky-900 transition disabled:opacity-50"
                  >
                    {uploading ? 'Mengupload...' : 'Simpan SKP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}