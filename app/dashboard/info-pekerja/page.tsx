'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function InfoPegawaiPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // State untuk modal detail pegawai yang dipilih
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // State untuk modal Edit data pegawai (khusus admin)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})

  useEffect(() => {
    const role = localStorage.getItem('role_aktif')
    if (role === 'admin') {
      setIsAdmin(true)
    }

    const fetchDataAndValidateSession = async () => {
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

      // Ambil data user yang sedang login untuk header
      const { data: userData } = await supabase
        .from('employees')
        .select('*')
        .eq('nip', nipAktif)
        .single()

      if (userData) setCurrentUser(userData)

      // Ambil daftar SELURUH pegawai untuk direktori
      const { data: listData, error } = await supabase
        .from('employees')
        .select('*')
        .order('nama', { ascending: true })

      if (error) {
        console.error('Gagal memuat daftar pegawai:', error.message)
      } else {
        setEmployees(listData || [])
      }
      setLoading(false)
    }

    fetchDataAndValidateSession()
  }, [router])

  const fetchData = async () => {
    const nipAktif = localStorage.getItem('nip_aktif')

    const { data: userData } = await supabase
      .from('employees')
      .select('*')
      .eq('nip', nipAktif)
      .single()

    if (userData) setCurrentUser(userData)

    const { data: listData, error } = await supabase
      .from('employees')
      .select('*')
      .order('nama', { ascending: true })

    if (error) {
      console.error('Gagal memuat daftar pegawai:', error.message)
    } else {
      setEmployees(listData || [])
    }
  }

  // Filter pencarian pegawai berdasarkan nama atau NIP
  const filteredEmployees = employees.filter(emp => 
    emp.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.nip?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Fungsi saat baris pegawai diklik (membuka detail)
  const handleRowClick = (emp: any, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    setSelectedEmployee(emp)
    setIsModalOpen(true)
  }

  // Fungsi untuk menghapus data pegawai (Admin Only)
  const handleDelete = async (nip: string, nama: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm(`Apakah Anda yakin ingin menghapus data pegawai "${nama}" (NIP: ${nip})?`)) {
      return
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('nip', nip)

    if (error) {
      alert('Gagal menghapus pegawai: ' + error.message)
    } else {
      alert('Data pegawai berhasil dihapus!')
      fetchData()
    }
  }

  // Fungsi untuk membuka form edit (Admin Only)
  const handleOpenEdit = (emp: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditFormData(emp)
    setIsEditModalOpen(true)
  }

  // Fungsi untuk menyimpan perubahan update data pegawai secara lengkap
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('employees')
      .update({
        nama: editFormData.nama,
        nip_lama: editFormData.nip_lama || null,
        tempat_lahir: editFormData.tempat_lahir || null,
        tanggal_lahir: editFormData.tanggal_lahir || null,
        jenis_kelamin: editFormData.jenis_kelamin || null,
        agama: editFormData.agama || null,
        alamat: editFormData.alamat || null,
        no_telp: editFormData.no_telp || null,
        email: editFormData.email || null,
        pendidikan_terakhir: editFormData.pendidikan_terakhir || null,
        institusi_pendidikan: editFormData.institusi_pendidikan || null,
        tahun_lulus: editFormData.tahun_lulus ? parseInt(editFormData.tahun_lulus) : null,
        nama_ayah: editFormData.nama_ayah || null,
        nama_ibu: editFormData.nama_ibu || null,
        nama_pasangan: editFormData.nama_pasangan || null,
        jumlah_anak: editFormData.jumlah_anak !== undefined && editFormData.jumlah_anak !== '' ? parseInt(editFormData.jumlah_anak) : 0,
        role: editFormData.role,
      })
      .eq('nip', editFormData.nip)

    setLoading(false)

    if (error) {
      alert('Gagal memperbarui data: ' + error.message)
    } else {
      alert('Data pegawai berhasil diperbarui!')
      setIsEditModalOpen(false)
      fetchData()
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data direktori pegawai...</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Kiri (Tanpa Tombol Logout) */}
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
          <a href="/dashboard/data-pribadi" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Data Saya</a>
          <a href="#" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Riwayat Kepegawaian</a>
          <a href="/dashboard/info-pekerja" className="block p-2.5 rounded bg-sky-900 text-white font-semibold">Info Kepegawaian</a>
          {isAdmin && (
            <a href="/dashboard/tambah-pegawai" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Tambah Pegawai</a>
          )}
        </nav>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Direktori Info Kepegawaian</h1>
            <p className="text-xs text-gray-500 mt-0.5">Daftar seluruh pegawai aktif di lingkungan BBWS VIII</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button 
                onClick={() => router.push('/dashboard/tambah-pegawai')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                ➕ TAMBAH PEGAWAI BARU
              </button>
            )}

            <div className="flex items-center gap-3 bg-white p-2 rounded-full shadow-sm border">
              <span className="text-sm font-semibold text-gray-700 px-2">
                {currentUser ? currentUser.nama : 'Pengguna'}
              </span>
              <span className="bg-sky-500 text-white text-xs px-3 py-1 rounded-full font-mono">
                {currentUser ? currentUser.nip : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Kotak Pencarian & Tabel Direktori */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
            <h2 className="text-base font-bold text-gray-800">Daftar Pegawai ({filteredEmployees.length})</h2>
            <input 
              type="text"
              placeholder="Cari berdasarkan Nama atau NIP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-full md:w-72 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-3 font-semibold">No</th>
                  <th className="p-3 font-semibold">Foto</th>
                  <th className="p-3 font-semibold">Nama Lengkap & Gelar</th>
                  <th className="p-3 font-semibold">NIP</th>
                  <th className="p-3 font-semibold">Jabatan / Kontak</th>
                  <th className="p-3 font-semibold">Role</th>
                  {isAdmin && <th className="p-3 font-semibold text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp, index) => (
                    <tr 
                      key={emp.id || index} 
                      onClick={(e) => handleRowClick(emp, e)}
                      className="border-b hover:bg-sky-50 transition cursor-pointer"
                      title="Klik untuk melihat detail lengkap pegawai"
                    >
                      <td className="p-3 text-gray-500">{index + 1}</td>
                      <td className="p-3">
                        {emp.foto_url ? (
                          <img src={emp.foto_url} alt="Foto" className="w-10 h-12 object-cover rounded border" />
                        ) : (
                          <div className="w-10 h-12 bg-gray-100 rounded border flex items-center justify-center text-[10px] text-gray-400">No Foto</div>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-sky-900 underline">{emp.nama || '-'}</td>
                      <td className="p-3 font-mono text-xs text-gray-600">{emp.nip || '-'}</td>
                      <td className="p-3 text-gray-600 text-xs">
                        <div>Telp: {emp.no_telp || '-'}</div>
                        <div className="text-gray-400">{emp.email || '-'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
                          {emp.role ? emp.role.toUpperCase() : 'USER'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={(e) => handleOpenEdit(emp, e)}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                              title="Edit Data"
                            >
                              ✏️ Edit
                            </button>
                            <button 
                              onClick={(e) => handleDelete(emp.nip, emp.nama, e)}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                              title="Hapus Data"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-gray-400 italic">Tidak ada pegawai yang ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL DETAIL PEGAWAI */}
      {isModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3 flex items-center gap-2">
              <span>📋 Detail Informasi Pegawai</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-6 bg-sky-50 p-4 rounded-xl border border-sky-100 mb-6">
              {selectedEmployee.foto_url ? (
                <img src={selectedEmployee.foto_url} alt="Foto Profil" className="w-24 h-32 object-cover rounded-lg border shadow-sm" />
              ) : (
                <div className="w-24 h-32 bg-gray-200 rounded-lg border flex items-center justify-center text-xs text-gray-400 font-medium">Tanpa Foto</div>
              )}
              <div className="text-center sm:text-left space-y-1">
                <h3 className="text-xl font-bold text-gray-800">{selectedEmployee.nama}</h3>
                <p className="text-sm font-mono text-sky-700 font-semibold">NIP: {selectedEmployee.nip}</p>
                {selectedEmployee.nip_lama && <p className="text-xs text-gray-500">NIP Lama: {selectedEmployee.nip_lama}</p>}
                <div className="pt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedEmployee.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
                    Role: {selectedEmployee.role ? selectedEmployee.role.toUpperCase() : 'USER'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 text-sm">
              <div>
                <h4 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-2 border-b pb-1">Data Pribadi & Kontak</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border">
                  <div><span className="text-gray-500 text-xs block">Tempat, Tanggal Lahir:</span> <span className="font-medium">{selectedEmployee.tempat_lahir || '-'}, {selectedEmployee.tanggal_lahir || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Jenis Kelamin:</span> <span className="font-medium">{selectedEmployee.jenis_kelamin || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Agama:</span> <span className="font-medium">{selectedEmployee.agama || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">No. Telepon:</span> <span className="font-medium">{selectedEmployee.no_telp || '-'}</span></div>
                  <div className="md:col-span-2"><span className="text-gray-500 text-xs block">Email:</span> <span className="font-medium">{selectedEmployee.email || '-'}</span></div>
                  <div className="md:col-span-2"><span className="text-gray-500 text-xs block">Alamat:</span> <span className="font-medium">{selectedEmployee.alamat || '-'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-2 border-b pb-1">Pendidikan Formal</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border">
                  <div><span className="text-gray-500 text-xs block">Pendidikan Terakhir:</span> <span className="font-medium">{selectedEmployee.pendidikan_terakhir || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Institusi Pendidikan:</span> <span className="font-medium">{selectedEmployee.institusi_pendidikan || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Tahun Lulus:</span> <span className="font-medium">{selectedEmployee.tahun_lulus || '-'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-2 border-b pb-1">Data Keluarga</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border">
                  <div><span className="text-gray-500 text-xs block">Nama Ayah:</span> <span className="font-medium">{selectedEmployee.nama_ayah || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Nama Ibu:</span> <span className="font-medium">{selectedEmployee.nama_ibu || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Nama Pasangan:</span> <span className="font-medium">{selectedEmployee.nama_pasangan || '-'}</span></div>
                  <div><span className="text-gray-500 text-xs block">Jumlah Anak:</span> <span className="font-medium">{selectedEmployee.jumlah_anak ?? '-'}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-lg font-semibold text-xs transition"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM EDIT PEGAWAI */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3">
              ✏️ Edit Data Pegawai: {editFormData.nama}
            </h2>

            <form onSubmit={handleUpdateSubmit} className="space-y-6 text-sm">
              <div>
                <h3 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-3 border-b pb-1">Data Pribadi & Kontak</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700">Nama Lengkap & Gelar</label>
                    <input 
                      type="text" 
                      value={editFormData.nama || ''} 
                      onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">NIP (Primary Key - Tidak Dapat Diubah)</label>
                    <input 
                      type="text" 
                      value={editFormData.nip || ''} 
                      disabled 
                      className="w-full border rounded p-2 mt-1 bg-gray-100 text-gray-500 cursor-not-allowed" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">NIP Lama</label>
                    <input 
                      type="text" 
                      value={editFormData.nip_lama || ''} 
                      onChange={(e) => setEditFormData({...editFormData, nip_lama: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Hak Akses (Role)</label>
                    <select 
                      value={editFormData.role || 'user'} 
                      onChange={(e) => setEditFormData({...editFormData, role: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 bg-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="user">USER</option>
                      <option value="admin">ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Tempat Lahir</label>
                    <input 
                      type="text" 
                      value={editFormData.tempat_lahir || ''} 
                      onChange={(e) => setEditFormData({...editFormData, tempat_lahir: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      value={editFormData.tanggal_lahir || ''} 
                      onChange={(e) => setEditFormData({...editFormData, tanggal_lahir: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Jenis Kelamin</label>
                    <select 
                      value={editFormData.jenis_kelamin || ''} 
                      onChange={(e) => setEditFormData({...editFormData, jenis_kelamin: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 bg-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Pilih Jenis Kelamin</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Agama</label>
                    <input 
                      type="text" 
                      value={editFormData.agama || ''} 
                      onChange={(e) => setEditFormData({...editFormData, agama: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">No. Telepon</label>
                    <input 
                      type="text" 
                      value={editFormData.no_telp || ''} 
                      onChange={(e) => setEditFormData({...editFormData, no_telp: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Email</label>
                    <input 
                      type="email" 
                      value={editFormData.email || ''} 
                      onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-medium text-gray-700">Alamat</label>
                    <textarea 
                      value={editFormData.alamat || ''} 
                      onChange={(e) => setEditFormData({...editFormData, alamat: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                      rows={2} 
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-3 border-b pb-1">Pendidikan Formal</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700">Pendidikan Terakhir</label>
                    <input 
                      type="text" 
                      value={editFormData.pendidikan_terakhir || ''} 
                      onChange={(e) => setEditFormData({...editFormData, pendidikan_terakhir: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Institusi Pendidikan</label>
                    <input 
                      type="text" 
                      value={editFormData.institusi_pendidikan || ''} 
                      onChange={(e) => setEditFormData({...editFormData, institusi_pendidikan: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Tahun Lulus</label>
                    <input 
                      type="number" 
                      value={editFormData.tahun_lulus || ''} 
                      onChange={(e) => setEditFormData({...editFormData, tahun_lulus: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sky-800 uppercase text-xs tracking-wider mb-3 border-b pb-1">Data Keluarga</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700">Nama Ayah</label>
                    <input 
                      type="text" 
                      value={editFormData.nama_ayah || ''} 
                      onChange={(e) => setEditFormData({...editFormData, nama_ayah: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Nama Ibu</label>
                    <input 
                      type="text" 
                      value={editFormData.nama_ibu || ''} 
                      onChange={(e) => setEditFormData({...editFormData, nama_ibu: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Nama Pasangan (Suami/Istri)</label>
                    <input 
                      type="text" 
                      value={editFormData.nama_pasangan || ''} 
                      onChange={(e) => setEditFormData({...editFormData, nama_pasangan: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Jumlah Anak</label>
                    <input 
                      type="number" 
                      value={editFormData.jumlah_anak ?? ''} 
                      onChange={(e) => setEditFormData({...editFormData, jumlah_anak: e.target.value})} 
                      className="w-full border rounded p-2 mt-1 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-xs transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg font-semibold text-xs transition"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}