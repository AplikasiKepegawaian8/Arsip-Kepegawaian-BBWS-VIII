'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function RiwayatGajiPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('riwayat')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // State form tambah/ajukan data Gaji Berkala
  const [formGaji, setFormGaji] = useState({
    gajiPokok: '',
    tmtGaji: '',
    noSk: ''
  })
  const [fileSk, setFileSk] = useState<File | null>(null)

  // State form edit data Gaji Berkala
  const [editId, setEditId] = useState<string | null>('')
  const [formEditGaji, setFormEditGaji] = useState({
    gajiPokok: '',
    tmtGaji: '',
    noSk: ''
  })
  const [editFileSk, setEditFileSk] = useState<File | null>(null)

  const [gajiList, setGajiList] = useState<any[]>([])
  const [verifikasiList, setVerifikasiList] = useState<any[]>([])
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

      // 2. Ambil data riwayat gaji dengan relasi ke tabel employees
      const roleAktif = localStorage.getItem('role_aktif')
      const isUserAdmin = roleAktif === 'admin'

      let query = supabase
        .from('salary_history')
        .select('*, employees(nama, nip)')
        .order('tmt_gaji', { ascending: false })

      if (!isUserAdmin) {
        query = query.eq('employee_id', empData.id)
      }

      const { data: salaryData, error: salaryError } = await query

      if (salaryError) {
        console.error('Gagal memuat riwayat gaji:', salaryError.message)
      } else {
        const dataMentah = salaryData || []
        
        const dataUtama = isUserAdmin ? dataMentah : dataMentah.filter(item => item.employee_id === empData.id)
        const verifikasi = dataMentah.filter(item => !item.status_verifikasi || item.status_verifikasi === 'Pending')

        if (isUserAdmin) {
          setVerifikasiList(dataMentah.filter(item => item.status_verifikasi && item.status_verifikasi !== 'Diterima'))
          setGajiList(dataUtama)
        } else {
          setGajiList(dataUtama)
          setVerifikasiList(verifikasi)
        }

        const diterima = dataMentah.filter(item => !item.status_verifikasi || item.status_verifikasi === 'Diterima')
        setLogList(diterima.map(item => ({
          id: item.id,
          aktivitas: `Penambahan Gaji Pokok: Rp ${parseInt(item.gaji_pokok || 0).toLocaleString('id-ID')}`,
          waktu: item.updated_at,
          user: item.employees?.nama || empData.nama
        })))
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  // Fungsi Tambah/Ajukan Data Gaji ke Supabase
  const handleTambahGaji = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return

    setUploading(true)
    let publicUrl = null

    try {
      if (fileSk) {
        const fileExt = fileSk.name.split('.').pop()
        const fileName = `gaji_${employee.nip}_${Date.now()}.${fileExt}`
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
        gaji_pokok: parseFloat(formGaji.gajiPokok) || 0,
        tmt_gaji: formGaji.tmtGaji,
        no_sk: formGaji.noSk,
        arsip_sk_url: publicUrl,
        status_verifikasi: isAdmin ? 'Diterima' : 'Pending',
        updated_by: employee.nama,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('salary_history')
        .insert([dataBaru])
        .select('*, employees(nama, nip)')

      if (error) {
        alert('Gagal menyimpan data gaji ke Supabase: ' + error.message)
      } else {
        alert(isAdmin ? 'Data gaji berhasil ditambahkan!' : 'Usulan gaji berhasil dikirim dan menunggu verifikasi admin.')
        if (data) {
          const itemBaru = data[0]
          setGajiList([itemBaru, ...gajiList])
          if (!isAdmin) {
            setVerifikasiList([itemBaru, ...verifikasiList])
          }
        }
        setFormGaji({
          gajiPokok: '',
          tmtGaji: '',
          noSk: ''
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
    setFormEditGaji({
      gajiPokok: item.gaji_pokok?.toString() || '',
      tmtGaji: item.tmt_gaji || '',
      noSk: item.no_sk || ''
    })
    setEditFileSk(null)
    setShowEditModal(true)
  }

  // Fungsi Simpan Perubahan Edit Gaji (Hanya Admin)
  const handleUpdateGaji = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin || !editId) return

    setUploading(true)
    let publicUrl = undefined

    try {
      if (editFileSk) {
        const fileExt = editFileSk.name.split('.').pop()
        const fileName = `gaji_edit_${Date.now()}.${fileExt}`
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
        gaji_pokok: parseFloat(formEditGaji.gajiPokok) || 0,
        tmt_gaji: formEditGaji.tmtGaji,
        no_sk: formEditGaji.noSk,
        updated_at: new Date().toISOString()
      }

      if (publicUrl) {
        dataUpdate.arsip_sk_url = publicUrl
      }

      const { data, error } = await supabase
        .from('salary_history')
        .update(dataUpdate)
        .eq('id', editId)
        .select('*, employees(nama, nip)')

      if (error) {
        alert('Gagal memperbarui data gaji: ' + error.message)
      } else {
        alert('Data gaji berhasil diperbarui!')
        if (data) {
          const itemUpdated = data[0]
          setGajiList(gajiList.map(item => item.id === editId ? itemUpdated : item))
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

  // Fungsi Aksi Admin: Verifikasi (Terima / Tolak)
  const handleVerifikasiStatus = async (id: string, status: 'Diterima' | 'Ditolak') => {
    const { error } = await supabase
      .from('salary_history')
      .update({ status_verifikasi: status })
      .eq('id', id)

    if (error) {
      alert('Gagal memperbarui status verifikasi: ' + error.message)
    } else {
      alert(`Pengajuan berhasil ${status.toLowerCase()}!`)
      setGajiList(gajiList.map(item => item.id === id ? { ...item, status_verifikasi: status } : item))
      setVerifikasiList(verifikasiList.map(item => item.id === id ? { ...item, status_verifikasi: status } : item))
    }
  }

  // Fungsi Hapus Data Gaji (Hanya Admin)
  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Akses ditolak! Hanya admin yang dapat menghapus data.')
      return
    }

    if (confirm('Apakah Anda yakin ingin menghapus riwayat gaji ini?')) {
      const { error } = await supabase
        .from('salary_history')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Gagal menghapus data: ' + error.message)
      } else {
        setGajiList(gajiList.filter((item) => item.id !== id))
        setVerifikasiList(verifikasiList.filter((item) => item.id !== id))
        alert('Data berhasil dihapus.')
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data gaji dari database...</div>
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
              🏠 / Data-saya / <span className="text-gray-800 font-medium">Riwayat Gaji</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Riwayat Gaji</h1>
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
            Riwayat Gaji
          </button>
          <button 
            onClick={() => setActiveTab('verifikasi')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'verifikasi' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Proses Verifikasi <span className="bg-[#1b2a4a] text-white text-xs px-2 py-0.5 rounded-full">{isAdmin ? verifikasiList.filter(i => i.status_verifikasi === 'Pending').length : verifikasiList.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('log')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'log' ? 'bg-sky-100 text-sky-800 font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Log
          </button>
        </div>

        {/* TAB 1: RIWAYAT GAJI (DENGAN KOLOM STATUS DI SAMPING KANAN NO SK) */}
        {activeTab === 'riwayat' && (
          <div>
            <div className="mb-4">
              <button 
                onClick={() => setShowModal(true)}
                className="bg-[#1b2a4a] hover:bg-sky-900 text-white text-xs font-bold px-5 py-3 rounded-lg shadow transition tracking-wider uppercase"
              >
                {isAdmin ? '+ TAMBAH DATA' : '+ AJUKAN USULAN GAJI'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="p-3 text-center">NO</th>
                      {isAdmin && <th className="p-3">PEGAWAI</th>}
                      <th className="p-3">GAJI POKOK</th>
                      <th className="p-3">TMT GAJI</th>
                      <th className="p-3">NO SK</th>
                      <th className="p-3 text-center">STATUS</th>
                      <th className="p-3 text-center">ARSIP</th>
                      <th className="p-3">TERAKHIR DIPERBARUI</th>
                      {isAdmin && <th className="p-3 text-center">AKSI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs text-gray-700">
                    {gajiList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 7} className="p-8 text-center text-gray-400 italic">
                          Belum ada data riwayat gaji.
                        </td>
                      </tr>
                    ) : (
                      gajiList.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-center font-semibold">{index + 1}</td>
                          {isAdmin && (
                            <td className="p-3 font-semibold text-sky-800">
                              {item.employees?.nama || '-'}
                              <div className="text-[10px] text-gray-500 font-mono">{item.employees?.nip}</div>
                            </td>
                          )}
                          <td className="p-3 font-semibold text-emerald-600">Rp {parseInt(item.gaji_pokok || 0).toLocaleString('id-ID')}</td>
                          <td className="p-3">{item.tmt_gaji}</td>
                          <td className="p-3 font-mono text-[11px]">{item.no_sk}</td>
                          {/* KOLOM STATUS DI SAMPING KANAN NO SK */}
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              item.status_verifikasi === 'Diterima' ? 'bg-emerald-100 text-emerald-800' :
                              item.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {item.status_verifikasi || 'Diterima'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {item.arsip_sk_url ? (
                              <a 
                                href={item.arsip_sk_url} 
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
                          <td className="p-3 font-mono text-[10px] text-gray-500 whitespace-pre-line">
                            {item.employees?.nama || employee?.nama}<br/>{new Date(item.updated_at).toLocaleString()}
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
                <span className="text-xs text-gray-500">Menampilkan {gajiList.length} data</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROSES VERIFIKASI */}
        {activeTab === 'verifikasi' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">
              {isAdmin ? 'Antrean Proses Verifikasi Usulan Gaji (Semua Pegawai)' : 'Status Pengajuan Usulan Gaji Saya'}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 uppercase">
                    <th className="p-3 text-center">No</th>
                    {isAdmin && <th className="p-3">Nama Pegawai</th>}
                    <th className="p-3">Gaji Pokok</th>
                    <th className="p-3">TMT Gaji</th>
                    <th className="p-3">No SK</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Berkas</th>
                    {isAdmin && <th className="p-3 text-center">Aksi Verifikasi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {verifikasiList.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 6} className="p-6 text-center text-gray-400 italic">
                        Tidak ada pengajuan gaji yang sedang dalam proses verifikasi.
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
                        <td className="p-3 font-semibold text-emerald-600">Rp {parseInt(item.gaji_pokok || 0).toLocaleString('id-ID')}</td>
                        <td className="p-3">{item.tmt_gaji}</td>
                        <td className="p-3 font-mono">{item.no_sk}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            item.status_verifikasi === 'Diterima' ? 'bg-emerald-100 text-emerald-800' :
                            item.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status_verifikasi || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {item.arsip_sk_url ? (
                            <a href={item.arsip_sk_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">📄 Lihat PDF</a>
                          ) : (
                            '-'
                          )}
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

        {/* TAB 3: LOG AKTIVITAS */}
        {activeTab === 'log' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Log Riwayat Aktivitas Gaji</h3>
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

        {/* Modal Tambah / Ajukan Gaji */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">
                {isAdmin ? 'Tambah Riwayat Gaji Baru' : 'Ajukan Usulan Riwayat Gaji'}
              </h3>
              <form onSubmit={handleTambahGaji} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Gaji Pokok (Rp)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Contoh: 4455200"
                    value={formGaji.gajiPokok}
                    onChange={(e) => setFormGaji({...formGaji, gajiPokok: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">TMT Gaji (Tanggal Berlaku)</label>
                  <input 
                    type="date" 
                    required
                    value={formGaji.tmtGaji}
                    onChange={(e) => setFormGaji({...formGaji, tmtGaji: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nomor SK</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Masukkan nomor SK..."
                    value={formGaji.noSk}
                    onChange={(e) => setFormGaji({...formGaji, noSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Upload Berkas SK Gaji (PDF)</label>
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
                    {uploading ? 'Mengirim...' : (isAdmin ? 'Simpan Gaji' : 'Kirim Usulan')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit Gaji (Hanya Admin) */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Edit Riwayat Gaji</h3>
              <form onSubmit={handleUpdateGaji} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Gaji Pokok (Rp)</label>
                  <input 
                    type="number" 
                    required
                    value={formEditGaji.gajiPokok}
                    onChange={(e) => setFormEditGaji({...formEditGaji, gajiPokok: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">TMT Gaji (Tanggal Berlaku)</label>
                  <input 
                    type="date" 
                    required
                    value={formEditGaji.tmtGaji}
                    onChange={(e) => setFormEditGaji({...formEditGaji, tmtGaji: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Nomor SK</label>
                  <input 
                    type="text" 
                    required
                    value={formEditGaji.noSk}
                    onChange={(e) => setFormEditGaji({...formEditGaji, noSk: e.target.value})}
                    className="w-full border rounded p-2 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Ganti Berkas SK Gaji (Opsional PDF)</label>
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