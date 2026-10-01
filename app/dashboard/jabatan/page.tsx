'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function RiwayatJabatanPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('riwayat')
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // State form tambah/ajukan data Jabatan
  const [formJabatan, setFormJabatan] = useState({
    jabatan: '',
    eselon: '',
    tmtJabatan: '',
    noSk: ''
  })
  const [fileSk, setFileSk] = useState<File | null>(null)

  const [jabatanList, setJabatanList] = useState<any[]>([])
  const [verifikasiList, setVerifikasiList] = useState<any[]>([])
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

      // 2. Ambil data riwayat jabatan dengan relasi ke tabel employees (untuk menampilkan nama pengaju jika admin)
      const roleAktif = localStorage.getItem('role_aktif')
      const isUserAdmin = roleAktif === 'admin'

      let query = supabase
        .from('employee_positions')
        .select('*, employees(nama, nip)')
        .order('tmt_jabatan', { ascending: false })

      // Jika bukan admin, hanya ambil data milik pegawai yang sedang login
      if (!isUserAdmin) {
        query = query.eq('employee_id', empData.id)
      }

      const { data: posData, error: posError } = await query

      if (posError) {
        console.error('Gagal memuat riwayat jabatan:', posError.message)
      } else {
        const dataMentah = posData || []
        
        // Untuk tabel riwayat utama (hanya yang statusnya Diterima / kosong)
        const diterima = dataMentah.filter(item => !item.status_verifikasi || item.status_verifikasi === 'Diterima')
        
        // Untuk tab verifikasi (yang berstatus Pending / Ditolak)
        const verifikasi = dataMentah.filter(item => item.status_verifikasi && item.status_verifikasi !== 'Diterima')

        if (isUserAdmin) {
          // Admin melihat semua yang berstatus pending/ditolak di tab verifikasi
          setVerifikasiList(dataMentah.filter(item => item.status_verifikasi && item.status_verifikasi !== 'Diterima'))
          setJabatanList(diterima)
        } else {
          // User biasa hanya melihat miliknya sendiri
          setJabatanList(diterima.filter(item => item.employee_id === empData.id))
          setVerifikasiList(verifikasi)
        }

        setSiasnData(diterima)
        setLogList(diterima.map(item => ({
          id: item.id,
          aktivitas: `Penambahan Jabatan: ${item.jabatan}`,
          waktu: item.updated_at,
          user: item.employees?.nama || empData.nama
        })))
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  // Fungsi Tambah/Ajukan Data Jabatan ke Supabase (Bisa User & Admin)
  const handleTambahJabatan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return

    setUploading(true)
    let publicUrl = null

    try {
      if (fileSk) {
        const fileExt = fileSk.name.split('.').pop()
        const fileName = `jabatan_${employee.nip}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(fileName, fileSk)

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

      const dataBaru = {
        employee_id: employee.id,
        jabatan: formJabatan.jabatan,
        eselon: formJabatan.eselon,
        tmt_jabatan: formJabatan.tmtJabatan,
        no_sk: formJabatan.noSk,
        arsip_sk_url: publicUrl,
        status_verifikasi: isAdmin ? 'Diterima' : 'Pending', // Admin langsung diterima, User berstatus Pending
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('employee_positions')
        .insert([dataBaru])
        .select('*, employees(nama, nip)')

      if (error) {
        alert('Gagal menyimpan data jabatan: ' + error.message)
      } else {
        alert(isAdmin ? 'Data jabatan berhasil ditambahkan!' : 'Usulan jabatan berhasil dikirim dan menunggu verifikasi admin.')
        if (data) {
          const itemBaru = data[0]
          if (isAdmin) {
            setJabatanList([itemBaru, ...jabatanList])
          } else {
            setVerifikasiList([itemBaru, ...verifikasiList])
          }
        }
        setFormJabatan({ jabatan: '', eselon: '', tmtJabatan: '', noSk: '' })
        setFileSk(null)
        setShowModal(false)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Fungsi Aksi Admin: Verifikasi (Terima / Tolak)
  const handleVerifikasiStatus = async (id: string, status: 'Diterima' | 'Ditolak') => {
    const { error } = await supabase
      .from('employee_positions')
      .update({ status_verifikasi: status })
      .eq('id', id)

    if (error) {
      alert('Gagal memperbarui status verifikasi: ' + error.message)
    } else {
      alert(`Pengajuan berhasil ${status.toLowerCase()}!`)
      // Perbarui state lokal
      setVerifikasiList(verifikasiList.map(item => {
        if (item.id === id) {
          const updated = { ...item, status_verifikasi: status }
          if (status === 'Diterima') {
            setJabatanList([updated, ...jabatanList])
          }
          return updated
        }
        return item
      }))
    }
  }

  // Fungsi Hapus Data Jabatan dari Supabase (Hanya Admin)
  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menghapus data.')
      return
    }

    if (confirm('Apakah Anda yakin ingin menghapus riwayat jabatan ini dari database?')) {
      const { error } = await supabase
        .from('employee_positions')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Gagal menghapus data: ' + error.message)
      } else {
        setJabatanList(jabatanList.filter((item) => item.id !== id))
        setVerifikasiList(verifikasiList.filter((item) => item.id !== id))
        alert('Data jabatan berhasil dihapus.')
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data jabatan dari database...</div>
  }

  const jumlahPending = verifikasiList.filter(item => item.status_verifikasi === 'Pending').length

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
              🏠 / Data-saya / <span className="text-gray-800 font-medium">Riwayat Jabatan</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Riwayat Jabatan</h1>
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
            Riwayat Jabatan
          </button>
          <button 
            onClick={() => setActiveTab('verifikasi')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'verifikasi' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Proses Verifikasi <span className="bg-[#1b2a4a] text-white text-xs px-2 py-0.5 rounded-full">{isAdmin ? verifikasiList.filter(i => i.status_verifikasi === 'Pending').length : verifikasiList.length}</span>
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

        {/* TAB 1: RIWAYAT JABATAN */}
        {activeTab === 'riwayat' && (
          <div>
            <div className="mb-4">
              <button 
                onClick={() => setShowModal(true)}
                className="bg-[#1b2a4a] hover:bg-sky-900 text-white text-xs font-bold px-5 py-3 rounded-lg shadow transition tracking-wider uppercase"
              >
                {isAdmin ? '+ TAMBAH DATA' : '+ AJUKAN USULAN JABATAN'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="p-3 text-center">NO</th>
                      <th className="p-3">JABATAN</th>
                      <th className="p-3">ESELON</th>
                      <th className="p-3">TMT JABATAN</th>
                      <th className="p-3">NO SK</th>
                      <th className="p-3 text-center">ARSIP</th>
                      <th className="p-3">TERAKHIR DIPERBARUI</th>
                      {isAdmin && <th className="p-3 text-center">AKSI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs text-gray-700">
                    {jabatanList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-gray-400 italic">
                          Belum ada data riwayat jabatan.
                        </td>
                      </tr>
                    ) : (
                      jabatanList.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-center font-semibold">{index + 1}</td>
                          <td className="p-3 font-semibold">{item.jabatan}</td>
                          <td className="p-3">{item.eselon || '-'}</td>
                          <td className="p-3">{item.tmt_jabatan}</td>
                          <td className="p-3 font-mono text-[11px]">{item.no_sk}</td>
                          <td className="p-3 text-center">
                            {item.arsip_sk_url ? (
                              <a href={item.arsip_sk_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline" title="Lihat Arsip">📄 Buka PDF</a>
                            ) : (
                              <span className="text-gray-400 italic">Tidak ada</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-gray-500 whitespace-pre-line">
                            {item.employees?.nama || employee?.nama}<br/>{new Date(item.updated_at).toLocaleString()}
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
                <span className="text-xs text-gray-500">Menampilkan {jabatanList.length} data</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROSES VERIFIKASI */}
        {activeTab === 'verifikasi' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">
              {isAdmin ? 'Antrean Proses Verifikasi Usulan Jabatan (Semua Pegawai)' : 'Status Pengajuan Usulan Jabatan Saya'}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 uppercase">
                    <th className="p-3 text-center">No</th>
                    {isAdmin && <th className="p-3">Nama Pegawai</th>}
                    <th className="p-3">Jabatan</th>
                    <th className="p-3">No SK</th>
                    <th className="p-3">TMT Jabatan</th>
                    <th className="p-3 text-center">Berkas</th>
                    <th className="p-3 text-center">Status</th>
                    {isAdmin && <th className="p-3 text-center">Aksi Verifikasi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {verifikasiList.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 6} className="p-6 text-center text-gray-400 italic">
                        Tidak ada pengajuan jabatan yang sedang dalam proses verifikasi.
                      </td>
                    </tr>
                  ) : (
                    verifikasiList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 text-center font-semibold">{idx + 1}</td>
                        {isAdmin && (
                          <td className="p-3 font-semibold text-sky-800">
                            {item.employees?.nama || '-'}
                            <div className="text-[10px] text-gray-500 font-mono">{item.employees?.nip}</div>
                          </td>
                        )}
                        <td className="p-3 font-semibold">{item.jabatan}</td>
                        <td className="p-3 font-mono">{item.no_sk}</td>
                        <td className="p-3">{item.tmt_jabatan}</td>
                        <td className="p-3 text-center">
                          {item.arsip_sk_url ? (
                            <a href={item.arsip_sk_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">📄 Lihat PDF</a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            item.status_verifikasi === 'Diterima' ? 'bg-emerald-100 text-emerald-800' :
                            item.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status_verifikasi || 'Pending'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            {item.status_verifikasi === 'Pending' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleVerifikasiStatus(item.id, 'Diterima')}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700"
                                >
                                  Terima
                                </button>
                                <button 
                                  onClick={() => handleVerifikasiStatus(item.id, 'Ditolak')}
                                  className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Selesai</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DATA SIASN */}
        {activeTab === 'siasn' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Data Integrasi SIASN BKN (Jabatan)</h3>
              {isAdmin && (
                <button onClick={() => alert('Sinkronisasi SIASN Jabatan berhasil!')} className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  🔄 Sinkronisasi SIASN
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 uppercase">
                    <th className="p-3">Jabatan (SIASN)</th>
                    <th className="p-3">Eselon</th>
                    <th className="p-3">TMT Jabatan</th>
                    <th className="p-3">No SK</th>
                  </tr>
                </thead>
                <tbody>
                  {siasnData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 italic">Belum ada data dari server SIASN.</td>
                    </tr>
                  ) : (
                    siasnData.map((s, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3 font-semibold">{s.jabatan}</td>
                        <td className="p-3">{s.eselon || '-'}</td>
                        <td className="p-3">{s.tmt_jabatan}</td>
                        <td className="p-3 font-mono">{s.no_sk}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LOG AKTIVITAS */}
        {activeTab === 'log' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Log Riwayat Aktivitas Jabatan</h3>
            {logList.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">Belum ada catatan aktivitas.</p>
            ) : (
              <div className="space-y-3">
                {logList.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border text-xs">
                    <div>
                      <span className="font-semibold text-gray-800">{log.aktivitas}</span>
                      <p className="text-gray-500 text-[11px] mt-0.5">Oleh: {log.user}</p>
                    </div>
                    <span className="font-mono text-gray-400 text-[11px]">{new Date(log.waktu).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Tambah / Ajukan Jabatan */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">
                {isAdmin ? 'Tambah Riwayat Jabatan Baru' : 'Ajukan Usulan Riwayat Jabatan'}
              </h3>
              <form onSubmit={handleTambahJabatan} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Jabatan</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Analis Kepegawaian"
                    value={formJabatan.jabatan}
                    onChange={(e) => setFormJabatan({...formJabatan, jabatan: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Eselon (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: III.a / Non-Eselon"
                    value={formJabatan.eselon}
                    onChange={(e) => setFormJabatan({...formJabatan, eselon: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">TMT Jabatan</label>
                  <input 
                    type="date" 
                    required
                    value={formJabatan.tmtJabatan}
                    onChange={(e) => setFormJabatan({...formJabatan, tmtJabatan: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nomor SK</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Masukkan nomor SK..."
                    value={formJabatan.noSk}
                    onChange={(e) => setFormJabatan({...formJabatan, noSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Upload Berkas SK Jabatan (PDF)</label>
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
                    {uploading ? 'Mengirim...' : (isAdmin ? 'Simpan Jabatan' : 'Kirim Usulan')}
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