'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function TambahPegawaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // State untuk form pegawai baru
  const [formData, setFormData] = useState({
    nip: '',
    nip_lama: '',
    nama: '',
    password: '',
    role: 'user', // Default sebagai user biasa
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: 'Laki-laki',
    agama: 'Islam',
    alamat: '',
    no_telp: '',
    email: '',
    pendidikan_terakhir: '',
    institusi_pendidikan: '',
    tahun_lulus: '',
    nama_ayah: '',
    nama_ibu: '',
    nama_pasangan: '',
    jumlah_anak: 0,
  })

  // State untuk file foto
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  useEffect(() => {
    // ==========================================
    // SESSION GUARD / VALIDASI KEAMANAN SESI & 12 JAM
    // ==========================================
    const nipAktif = localStorage.getItem('nip_aktif')
    const roleAktif = localStorage.getItem('role_aktif')
    const loginTime = localStorage.getItem('login_time')
    const DUABELAS_JAM_MS = 12 * 60 * 60 * 1000 // 12 jam dalam milidetik

    // 1. Cek apakah user sudah login atau belum
    if (!nipAktif || !loginTime) {
      router.push('/login')
      return
    }

    // 2. Validasi batas waktu 12 jam
    const waktuSekarang = new Date().getTime()
    const selisihWaktu = waktuSekarang - parseInt(loginTime)

    if (selisihWaktu > DUABELAS_JAM_MS) {
      localStorage.clear()
      alert('Sesi Anda telah kedaluwarsa (lebih dari 12 jam). Silakan login kembali.')
      router.push('/login')
      return
    }

    // 3. Cek apakah role yang login benar-benar 'admin'
    if (roleAktif !== 'admin') {
      alert('Peringatan Keamanan: Akses Ditolak! Halaman ini khusus untuk Administrator.')
      router.push('/dashboard')
      return
    }

    setIsAdmin(true)
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let publicUrl = ''

      // Jika admin mengupload foto untuk pegawai baru
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop()
        const fileName = `foto_${formData.nip}_${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(fileName, fotoFile)

        if (uploadError) {
          alert('Gagal mengupload foto: ' + uploadError.message)
          setLoading(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('arsip_sk')
          .getPublicUrl(fileName)

        publicUrl = urlData.publicUrl
      }

      // Payload data ke tabel employees
      const newEmployee = {
        nip: formData.nip,
        nip_lama: formData.nip_lama || null,
        nama: formData.nama,
        password: formData.password || formData.nip, // Jika password kosong, disamakan dengan NIP
        role: formData.role,
        tempat_lahir: formData.tempat_lahir || null,
        tanggal_lahir: formData.tanggal_lahir || null,
        jenis_kelamin: formData.jenis_kelamin || null,
        agama: formData.agama || null,
        alamat: formData.alamat || null,
        no_telp: formData.no_telp || null,
        email: formData.email || null,
        pendidikan_terakhir: formData.pendidikan_terakhir || null,
        institusi_pendidikan: formData.institusi_pendidikan || null,
        tahun_lulus: formData.tahun_lulus ? parseInt(formData.tahun_lulus) : null,
        nama_ayah: formData.nama_ayah || null,
        nama_ibu: formData.nama_ibu || null,
        nama_pasangan: formData.nama_pasangan || null,
        jumlah_anak: formData.jumlah_anak ? parseInt(String(formData.jumlah_anak)) : 0,
        foto_url: publicUrl || null,
      }

      const { error } = await supabase
        .from('employees')
        .insert([newEmployee])

      if (error) {
        alert('Gagal menambahkan pegawai: ' + error.message)
      } else {
        alert('Pegawai baru berhasil ditambahkan!')
        router.push('/dashboard')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Jika belum terverifikasi sebagai admin, tampilkan pesan pemuatan sesi
  if (!isAdmin) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500 text-sm">Memverifikasi sesi keamanan admin...</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Navigasi */}
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
          <a href="#" className="block p-2 rounded hover:bg-gray-100 text-gray-700">Data Saya</a>
          <a href="#" className="block p-2 rounded hover:bg-gray-100 text-gray-700">Riwayat Kepegawaian</a>
          <a href="#" className="block p-2 rounded hover:bg-gray-100 text-gray-700">Info Kepegawaian</a>
          <a href="#" className="block p-2.5 rounded bg-sky-900 text-white font-semibold">Tambah Pegawai</a>
        </nav>
      </aside>

      {/* Konten Utama Form */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-1">
          🏠 / Dashboard / <span className="text-gray-800 font-medium">Tambah Pegawai Baru</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-6">Formulir Pendaftaran Pegawai Baru</h1>

        <div className="mb-4">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 text-sm bg-white border px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
          >
            ← Kembali ke Dashboard
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6 text-sm">
            
            {/* Akun & Role */}
            <div>
              <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Informasi Akun & Login</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-gray-700">NIP (Nomor Induk Pegawai) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: 198406042025211045"
                    value={formData.nip} 
                    onChange={(e) => setFormData({...formData, nip: e.target.value})} 
                    className="w-full border rounded p-2 mt-1" 
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Password Awal *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Biasanya disamakan dengan NIP"
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    className="w-full border rounded p-2 mt-1" 
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Hak Akses (Role) *</label>
                  <select 
                    value={formData.role} 
                    onChange={(e) => setFormData({...formData, role: e.target.value})} 
                    className="w-full border rounded p-2 mt-1 bg-white"
                  >
                    <option value="user">User (Pegawai Biasa - Read Only)</option>
                    <option value="admin">Admin (Full Akses)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Data Pribadi & Foto */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Data Pribadi & Foto</h3>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <label className="block font-medium text-gray-700 mb-1">Foto Formal (Format: JPG / PNG)</label>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFotoFile(e.target.files[0])
                    }
                  }}
                  className="w-full border rounded p-1.5 bg-white text-xs text-gray-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-700">Nama Lengkap</label>
                  <input type="text" required value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">NIP Lama</label>
                  <input type="text" value={formData.nip_lama} onChange={(e) => setFormData({...formData, nip_lama: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Tempat Lahir</label>
                  <input type="text" value={formData.tempat_lahir} onChange={(e) => setFormData({...formData, tempat_lahir: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Tanggal Lahir</label>
                  <input type="date" value={formData.tanggal_lahir} onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Jenis Kelamin</label>
                  <select value={formData.jenis_kelamin} onChange={(e) => setFormData({...formData, jenis_kelamin: e.target.value})} className="w-full border rounded p-2 mt-1 bg-white">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Agama</label>
                  <input type="text" value={formData.agama} onChange={(e) => setFormData({...formData, agama: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium text-gray-700">Alamat</label>
                  <textarea value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} className="w-full border rounded p-2 mt-1" rows={2} />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">No. Telepon</label>
                  <input type="text" value={formData.no_telp} onChange={(e) => setFormData({...formData, no_telp: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full border rounded p-2 mt-1" />
                </div>
              </div>
            </div>

            {/* Pendidikan */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Pendidikan Formal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block font-medium text-gray-700">Pendidikan Terakhir</label><input type="text" value={formData.pendidikan_terakhir} onChange={(e) => setFormData({...formData, pendidikan_terakhir: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="block font-medium text-gray-700">Institusi Pendidikan</label><input type="text" value={formData.institusi_pendidikan} onChange={(e) => setFormData({...formData, institusi_pendidikan: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="block font-medium text-gray-700">Tahun Lulus</label><input type="number" value={formData.tahun_lulus} onChange={(e) => setFormData({...formData, tahun_lulus: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
              </div>
            </div>

            {/* Keluarga */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Data Keluarga</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block font-medium text-gray-700">Nama Ayah</label><input type="text" value={formData.nama_ayah} onChange={(e) => setFormData({...formData, nama_ayah: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="block font-medium text-gray-700">Nama Ibu</label><input type="text" value={formData.nama_ibu} onChange={(e) => setFormData({...formData, nama_ibu: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="block font-medium text-gray-700">Nama Pasangan</label><input type="text" value={formData.nama_pasangan} onChange={(e) => setFormData({...formData, nama_pasangan: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="block font-medium text-gray-700">Jumlah Anak</label><input type="number" value={formData.jumlah_anak} onChange={(e) => setFormData({...formData, jumlah_anak: parseInt(e.target.value) || 0})} className="w-full border rounded p-2 mt-1" /></div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button 
                type="button" 
                onClick={() => router.push('/dashboard')} 
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold transition"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
              >
                {loading ? 'Menyimpan Data...' : 'Simpan Pegawai Baru'}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}