'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function RiwayatHukumanDisiplinPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('riwayat')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // State form tambah Hukuman Disiplin
  const [formHukdis, setFormHukdis] = useState({
    jenisHukuman: '',
    alasanHukuman: '',
    periodeHukuman: '',
    noSk: '',
    tanggalSk: '',
    keterangan: ''
  })
  const [fileSk, setFileSk] = useState<File | null>(null)

  // State form edit Hukuman Disiplin
  const [editId, setEditId] = useState<string | null>('')
  const [formEditHukdis, setFormEditHukdis] = useState({
    jenisHukuman: '',
    alasanHukuman: '',
    periodeHukuman: '',
    noSk: '',
    tanggalSk: '',
    keterangan: ''
  })
  const [editFileSk, setEditFileSk] = useState<File | null>(null)

  const [hukdisList, setHukdisList] = useState<any[]>([])
  const [siasnData, setSiasnData] = useState<any[]>([])
  const [logList, setLogList] = useState<any[]>([])

  useEffect(() => {
    const role = localStorage.getItem('role_aktif')
    if (role === 'admin') {
      setIsAdmin(true)
    }

    const fetchData = async () => {
      const nipAktif = localStorage.getItem('nip_aktif')
      const loginTime = localStorage.getItem('login_time')
      const DUABELAS_JAM_MS = 12 * 60 * 60 * 1000 // 12 jam dalam milidetik

      // Validasi sesi kosong atau belum login
      if (!nipAktif || !loginTime) {
        router.push('/login')
        return
      }

      // Validasi batas waktu 12 jam
      const waktuSekarang = new Date().getTime()
      const selisihWaktu = waktuSekarang - parseInt(loginTime)

      if (selisihWaktu > DUABELAS_JAM_MS) {
        localStorage.clear()
        alert('Sesi Anda telah kedaluwarsa (lebih dari 12 jam). Silakan login kembali.')
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

      // 2. Ambil data riwayat hukuman disiplin dari tabel rewards_and_disciplines (filter kategori = 'Hukuman')
      const { data: hukdisData, error: hukdisError } = await supabase
        .from('rewards_and_disciplines')
        .select('*')
        .eq('employee_id', empData.id)
        .eq('kategori', 'Hukuman')
        .order('tanggal_sk', { ascending: false })

      if (hukdisError) {
        console.error('Gagal memuat riwayat hukuman disiplin:', hukdisError.message)
      } else {
        setHukdisList(hukdisData || [])
        setSiasnData(hukdisData || [])
        setLogList((hukdisData || []).map(item => ({
          id: item.id,
          aktivitas: `Penambahan Hukuman Disiplin: ${item.jenis_hukuman || item.nama_penghargaan_atau_disiplin}`,
          waktu: item.updated_at,
          user: empData.nama
        })))
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  // Fungsi Tambah Data Hukuman Disiplin & Upload PDF ke Supabase Storage (Hanya Admin)
  const handleTambahHukdis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menambah data.')
      return
    }
    if (!employee) return

    setUploading(true)
    let publicUrl = null

    try {
      if (fileSk) {
        const fileExt = fileSk.name.split('.').pop()
        const fileName = `hukdis_${employee.nip}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(filePath, fileSk)

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
        kategori: 'Hukuman',
        jenis_hukuman: formHukdis.jenisHukuman,
        alasan_hukuman: formHukdis.alasanHukuman,
        periode_hukuman: formHukdis.periodeHukuman,
        no_sk: formHukdis.noSk,
        tanggal_sk: formHukdis.tanggalSk,
        keterangan: formHukdis.keterangan,
        nama_penghargaan_atau_disiplin: formHukdis.jenisHukuman, // Sinkronisasi kolom lama
        sk_url: publicUrl,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('rewards_and_disciplines')
        .insert([dataBaru])
        .select()

      if (error) {
        alert('Gagal menyimpan data hukuman disiplin ke Supabase: ' + error.message)
      } else {
        alert('Data hukuman disiplin berhasil disimpan!')
        if (data) {
          setHukdisList([data[0], ...hukdisList])
          setLogList([
            {
              id: data[0].id,
              aktivitas: `Penambahan Hukuman Disiplin: ${data[0].jenis_hukuman}`,
              waktu: data[0].updated_at,
              user: employee.nama
            },
            ...logList
          ])
        }
        setFormHukdis({
          jenisHukuman: '',
          alasanHukuman: '',
          periodeHukuman: '',
          noSk: '',
          tanggalSk: '',
          keterangan: ''
        })
        setFileSk(null)
        setShowModal(false)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Fungsi Membuka Modal Edit dengan Data Terpilih
  const handleOpenEdit = (item: any) => {
    setEditId(item.id)
    setFormEditHukdis({
      jenisHukuman: item.jenis_hukuman || item.nama_penghargaan_atau_disiplin || '',
      alasanHukuman: item.alasan_hukuman || '',
      periodeHukuman: item.periode_hukuman || '',
      noSk: item.no_sk || '',
      tanggalSk: item.tanggal_sk || '',
      keterangan: item.keterangan || ''
    })
    setEditFileSk(null)
    setShowEditModal(true)
  }

  // Fungsi Simpan Perubahan Edit Hukuman Disiplin (Hanya Admin)
  const handleUpdateHukdis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin || !editId) return

    setUploading(true)
    let publicUrl = undefined

    try {
      if (editFileSk) {
        const fileExt = editFileSk.name.split('.').pop()
        const fileName = `hukdis_edit_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(fileName, editFileSk)

        if (uploadError) {
          alert('Gagal mengupload file PDF: ' + uploadError.message)
          setUploading(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('arsip_sk')
          .getPublicUrl(fileName)

        publicUrl = urlData.publicUrl
      }

      const dataUpdate: any = {
        jenis_hukuman: formEditHukdis.jenisHukuman,
        alasan_hukuman: formEditHukdis.alasanHukuman,
        periode_hukuman: formEditHukdis.periodeHukuman,
        no_sk: formEditHukdis.noSk,
        tanggal_sk: formEditHukdis.tanggalSk,
        keterangan: formEditHukdis.keterangan,
        nama_penghargaan_atau_disiplin: formEditHukdis.jenisHukuman,
        updated_at: new Date().toISOString()
      }

      if (publicUrl) {
        dataUpdate.sk_url = publicUrl
      }

      const { data, error } = await supabase
        .from('rewards_and_disciplines')
        .update(dataUpdate)
        .eq('id', editId)
        .select()

      if (error) {
        alert('Gagal memperbarui data hukuman disiplin: ' + error.message)
      } else {
        alert('Data hukuman disiplin berhasil diperbarui!')
        if (data) {
          const itemUpdated = data[0]
          setHukdisList(hukdisList.map(item => item.id === editId ? itemUpdated : item))
        }
        setShowEditModal(false)
        setEditId(null)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Fungsi Hapus Data Hukuman Disiplin (Hanya Admin)
  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menghapus data.')
      return
    }

    if (confirm('Apakah Anda yakin ingin menghapus riwayat hukuman disiplin ini?')) {
      const { error } = await supabase
        .from('rewards_and_disciplines')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Gagal menghapus data: ' + error.message)
      } else {
        setHukdisList(hukdisList.filter((item) => item.id !== id))
        alert('Data berhasil dihapus.')
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data hukuman disiplin dari database...</div>
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
              SIMPEG Sistem Informasi<br/>Kepegawaian BBWS VIII
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
              🏠 / Data-saya / <span className="text-gray-800 font-medium">Riwayat Hukuman Disiplin</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Riwayat Hukuman Disiplin</h1>
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
            Riwayat Hukdis
          </button>
          <button 
            onClick={() => setActiveTab('siasn')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'siasn' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Data SIASN
          </button>
        </div>

        {/* TAB 1: RIWAYAT HUKDIS */}
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
                      <th className="p-3">JENIS HUKUMAN</th>
                      <th className="p-3">ALASAN HUKUMAN</th>
                      <th className="p-3">PERIODE HUKUMAN</th>
                      <th className="p-3">NO SK</th>
                      <th className="p-3">TGL SK</th>
                      <th className="p-3">KETERANGAN</th>
                      <th className="p-3 text-center">ARSIP DIGITAL</th>
                      {isAdmin && <th className="p-3 text-center">AKSI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs text-gray-700">
                    {hukdisList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8} className="p-8 text-center text-gray-400 italic">
                          Belum ada data riwayat hukuman disiplin. {isAdmin ? 'Silakan klik tombol "+ TAMBAH DATA" untuk menambahkan.' : ''}
                        </td>
                      </tr>
                    ) : (
                      hukdisList.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-center font-semibold">{index + 1}</td>
                          <td className="p-3 font-semibold text-red-600">{item.jenis_hukuman || item.nama_penghargaan_atau_disiplin}</td>
                          <td className="p-3">{item.alasan_hukuman || '-'}</td>
                          <td className="p-3 font-mono">{item.periode_hukuman || '-'}</td>
                          <td className="p-3 font-mono">{item.no_sk || '-'}</td>
                          <td className="p-3">{item.tanggal_sk || '-'}</td>
                          <td className="p-3">{item.keterangan || '-'}</td>
                          <td className="p-3 text-center">
                            {item.sk_url ? (
                              <a 
                                href={item.sk_url} 
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
                                {/* Tombol Edit */}
                                <button onClick={() => handleOpenEdit(item)} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Edit">✏️</button>
                                {/* Tombol Hapus */}
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
                <span className="text-xs text-gray-500">Menampilkan {hukdisList.length} data</span>
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
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Data SIASN Hukuman Disiplin</h3>
              {isAdmin && (
                <button onClick={() => alert('Sinkronisasi SIASN berhasil!')} className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  🔄 Sinkronisasi SIASN
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 uppercase">
                    <th className="p-3">Jenis Hukuman</th>
                    <th className="p-3">No SK</th>
                    <th className="p-3">Tanggal SK</th>
                  </tr>
                </thead>
                <tbody>
                  {siasnData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-gray-400 italic">Belum ada data hukuman disiplin dari server SIASN.</td>
                    </tr>
                  ) : (
                    siasnData.map((s, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3 font-semibold text-red-600">{s.jenis_hukuman}</td>
                        <td className="p-3 font-mono">{s.no_sk}</td>
                        <td className="p-3">{s.tanggal_sk}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Tambah Hukuman Disiplin (Hanya Admin) */}
        {isAdmin && showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Tambah Riwayat Hukuman Disiplin Baru</h3>
              <form onSubmit={handleTambahHukdis} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jenis Hukuman</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Hukuman Disiplin Sedang / Berat"
                    value={formHukdis.jenisHukuman}
                    onChange={(e) => setFormHukdis({...formHukdis, jenisHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Alasan Hukuman</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Tidak masuk kerja tanpa alasan..."
                    value={formHukdis.alasanHukuman}
                    onChange={(e) => setFormHukdis({...formHukdis, alasanHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Periode Hukuman</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 1 Tahun (2025 - 2026)"
                    value={formHukdis.periodeHukuman}
                    onChange={(e) => setFormHukdis({...formHukdis, periodeHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nomor SK</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: SK/02/DISIPLIN/2025"
                    value={formHukdis.noSk}
                    onChange={(e) => setFormHukdis({...formHukdis, noSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Tanggal SK</label>
                  <input 
                    type="date" 
                    required
                    value={formHukdis.tanggalSk}
                    onChange={(e) => setFormHukdis({...formHukdis, tanggalSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Keterangan</label>
                  <textarea 
                    rows={2}
                    placeholder="Keterangan tambahan..."
                    value={formHukdis.keterangan}
                    onChange={(e) => setFormHukdis({...formHukdis, keterangan: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Upload Arsip Digital SK (PDF)</label>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileSk(e.target.files[0])
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
                    {uploading ? 'Mengupload...' : 'Simpan Hukdis'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit Hukuman Disiplin (Hanya Admin) */}
        {isAdmin && showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Edit Riwayat Hukuman Disiplin</h3>
              <form onSubmit={handleUpdateHukdis} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jenis Hukuman</label>
                  <input 
                    type="text" 
                    required
                    value={formEditHukdis.jenisHukuman}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, jenisHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Alasan Hukuman</label>
                  <input 
                    type="text" 
                    value={formEditHukdis.alasanHukuman}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, alasanHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Periode Hukuman</label>
                  <input 
                    type="text" 
                    value={formEditHukdis.periodeHukuman}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, periodeHukuman: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nomor SK</label>
                  <input 
                    type="text" 
                    required
                    value={formEditHukdis.noSk}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, noSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Tanggal SK</label>
                  <input 
                    type="date" 
                    required
                    value={formEditHukdis.tanggalSk}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, tanggalSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Keterangan</label>
                  <textarea 
                    rows={2}
                    value={formEditHukdis.keterangan}
                    onChange={(e) => setFormEditHukdis({...formEditHukdis, keterangan: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Ganti Berkas Arsip Digital SK (Opsional PDF)</label>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditFileSk(e.target.files[0])
                      }
                    }}
                    className="w-full border rounded p-1.5 bg-gray-50 text-gray-600 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button 
                    type="button" 
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 font-medium"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="px-4 py-2 bg-[#1b2a4a] text-white rounded font-semibold hover:bg-sky-900 transition disabled:opacity-50"
                  >
                    {uploading ? 'Menyimpan...' : 'Simpan Perubahan'}
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