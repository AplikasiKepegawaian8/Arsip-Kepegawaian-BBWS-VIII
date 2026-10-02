'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function DynamicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>({})

  // State untuk mendeteksi apakah akun yang login adalah admin
  const [isAdmin, setIsAdmin] = useState(false)

  // State untuk file foto baru & status upload
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // Mengecek role aktif dari localStorage
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

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('nip', nipAktif)
        .single()

      if (error) {
        console.error('Gagal memuat data:', error.message)
      } else {
        setEmployee(data)
        setFormData(data)
      }
      setLoading(false)
    }

    fetchData()
  }, [router])

  // Fungsi untuk menyimpan SELURUH perubahan data & upload foto ke Supabase
  const handleUpdateAll = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    let publicUrl = formData.foto_url // Pertahankan foto lama jika tidak ada file baru yang diupload

    try {
      // Jika user memilih file foto baru
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop()
        const fileName = `foto_${employee.nip}_${Date.now()}.${fileExt}`
        
        // Mengupload ke bucket 'arsip_sk' di Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('arsip_sk')
          .upload(fileName, fotoFile)

        if (uploadError) {
          alert('Gagal mengupload foto: ' + uploadError.message)
          setUploading(false)
          return
        }

        // Mengambil Public URL dari foto yang baru diupload
        const { data: urlData } = supabase.storage
          .from('arsip_sk')
          .getPublicUrl(fileName)

        publicUrl = urlData.publicUrl
      }

      const updatePayload = {
        // Data Pribadi & Identitas
        nama: formData.nama,
        nip_lama: formData.nip_lama,
        tempat_lahir: formData.tempat_lahir,
        tanggal_lahir: formData.tanggal_lahir,
        jenis_kelamin: formData.jenis_kelamin,
        agama: formData.agama,
        alamat: formData.alamat,
        no_telp: formData.no_telp,
        email: formData.email,
        // Data Pendidikan
        pendidikan_terakhir: formData.pendidikan_terakhir,
        institusi_pendidikan: formData.institusi_pendidikan,
        tahun_lulus: formData.tahun_lulus ? parseInt(formData.tahun_lulus) : null,
        // Data Keluarga (Orang Tua, Pasangan, Anak)
        nama_ayah: formData.nama_ayah,
        nama_ibu: formData.nama_ibu,
        nama_pasangan: formData.nama_pasangan,
        jumlah_anak: formData.jumlah_anak !== undefined ? parseInt(formData.jumlah_anak) : 0,
        // URL Foto baru/lama
        foto_url: publicUrl
      }

      const { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('nip', employee.nip)

      if (error) {
        alert('Gagal memperbarui data: ' + error.message)
      } else {
        alert('Semua data dan foto berhasil diperbarui!')
        const updatedData = { ...formData, foto_url: publicUrl }
        setEmployee(updatedData)
        setFormData(updatedData)
        setFotoFile(null)
        setIsEditing(false)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data...</div>
  }

  // ==========================================
  // HALAMAN DATA PRIBADI (MENCAKUP SEMUA DATA GABUNGAN)
  // ==========================================
  if (slug === 'data-pribadi' || slug === 'pendidikan' || slug === 'orang-tua' || slug === 'pasangan' || slug === 'data-anak') {
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
          <a href="/dashboard/data-pribadi" className="block p-2.5 rounded bg-sky-900 text-white font-semibold">Data Saya</a>
          <a href="#" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Riwayat Kepegawaian</a>
          <a href="/dashboard/info-pekerja" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Info Kepegawaian</a>
          <a href="/dashboard/tambah-pegawai" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Tambah Pegawai</a>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <div className="text-xs text-gray-500 mb-1">
            🏠 / Data-saya / <span className="text-gray-800 font-medium">Data Lengkap Pegawai</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-6">Informasi Data Lengkap</h1>

          <div className="mb-4">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm bg-white border px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700">
              ← Kembali
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center pb-4 mb-6 border-b">
              <h2 className="text-base font-bold text-gray-800">Data Utama, Pendidikan & Keluarga</h2>
              <div className="flex gap-2">
                
                {/* Tombol UBAH SEMUA DATA hanya muncul jika akun yang login adalah ADMIN */}
                {isAdmin && (
                  <>
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="bg-[#1b2a4a] hover:bg-sky-900 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition">
                        ✎ UBAH SEMUA DATA
                      </button>
                    ) : (
                      <button onClick={() => setIsEditing(false)} className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition">
                        BATAL
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {!isEditing ? (
              // TAMPILAN READ-ONLY (MENAMPILKAN SEMUA DATA SEKALIGUS)
              <div className="space-y-6">
                {/* Bagian 1: Identitas & Foto */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start pb-6 border-b">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-500 mb-2 self-start">Foto Formal :</span>
                    {employee?.foto_url ? (
                      <img src={employee.foto_url} alt="Foto Formal" className="w-32 h-44 object-cover rounded border shadow-sm" />
                    ) : (
                      <div className="w-32 h-44 bg-gray-100 border rounded flex items-center justify-center text-gray-400 text-xs italic text-center p-2">Belum ada foto</div>
                    )}
                  </div>
                  <div className="md:col-span-3 space-y-3 text-sm">
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">NIP Lama</span><span className="col-span-2 font-semibold text-gray-800">: {employee?.nip_lama || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">NIP Baru</span><span className="col-span-2 font-semibold text-gray-800">: {employee?.nip || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Nama Lengkap</span><span className="col-span-2 font-semibold text-gray-800">: {employee?.nama || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Tempat, Tanggal Lahir</span><span className="col-span-2 text-gray-800">: {employee?.tempat_lahir || '-'}, {employee?.tanggal_lahir || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Jenis Kelamin</span><span className="col-span-2 text-gray-800">: {employee?.jenis_kelamin || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Agama</span><span className="col-span-2 text-gray-800">: {employee?.agama || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Alamat</span><span className="col-span-2 text-gray-800">: {employee?.alamat || '-'}</span></div>
                    <div className="grid grid-cols-3 pb-2"><span className="text-gray-500 font-medium">No. Telepon / Email</span><span className="col-span-2 text-gray-800">: {employee?.no_telp || '-'} / {employee?.email || '-'}</span></div>
                  </div>
                </div>

                {/* Bagian 2: Pendidikan */}
                <div>
                  <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Pendidikan Formal</h3>
                  <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Pendidikan Terakhir</span><span className="col-span-2 font-semibold">: {employee?.pendidikan_terakhir || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Institusi Pendidikan</span><span className="col-span-2 font-semibold">: {employee?.institusi_pendidikan || '-'}</span></div>
                    <div className="grid grid-cols-3"><span className="text-gray-500 font-medium">Tahun Lulus</span><span className="col-span-2 font-semibold">: {employee?.tahun_lulus || '-'}</span></div>
                  </div>
                </div>

                {/* Bagian 3: Keluarga (Orang Tua, Pasangan, Anak) */}
                <div>
                  <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Data Keluarga</h3>
                  <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Nama Ayah</span><span className="col-span-2 font-semibold">: {employee?.nama_ayah || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Nama Ibu</span><span className="col-span-2 font-semibold">: {employee?.nama_ibu || '-'}</span></div>
                    <div className="grid grid-cols-3 border-b pb-2"><span className="text-gray-500 font-medium">Nama Pasangan</span><span className="col-span-2 font-semibold">: {employee?.nama_pasangan || '-'}</span></div>
                    <div className="grid grid-cols-3"><span className="text-gray-500 font-medium">Jumlah Anak</span><span className="col-span-2 font-semibold">: {employee?.jumlah_anak ?? 0} Orang</span></div>
                  </div>
                </div>
              </div>
            ) : (
              // FORM EDIT GABUNGAN + UPLOAD FOTO
              <form onSubmit={handleUpdateAll} className="space-y-6 text-sm">
                {/* 1. Edit Data Pribadi & Foto */}
                <div>
                  <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Edit Foto & Data Pribadi</h3>
                  
                  {/* Bagian Input Upload Foto Formal */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                    <label className="block font-medium text-gray-700 mb-1">Ganti Foto Formal (Format: JPG / PNG)</label>
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
                    <p className="text-[11px] text-gray-400 mt-1">Biarkan kosong jika tidak ingin mengubah foto saat ini.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block font-medium text-gray-700">Nama Lengkap</label><input type="text" value={formData.nama || ''} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">NIP Lama</label><input type="text" value={formData.nip_lama || ''} onChange={(e) => setFormData({...formData, nip_lama: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Tempat Lahir</label><input type="text" value={formData.tempat_lahir || ''} onChange={(e) => setFormData({...formData, tempat_lahir: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Tanggal Lahir</label><input type="date" value={formData.tanggal_lahir || ''} onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Jenis Kelamin</label><input type="text" value={formData.jenis_kelamin || ''} onChange={(e) => setFormData({...formData, jenis_kelamin: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Agama</label><input type="text" value={formData.agama || ''} onChange={(e) => setFormData({...formData, agama: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div className="md:col-span-2"><label className="block font-medium text-gray-700">Alamat</label><textarea value={formData.alamat || ''} onChange={(e) => setFormData({...formData, alamat: e.target.value})} className="w-full border rounded p-2 mt-1" rows={2} /></div>
                    <div><label className="block font-medium text-gray-700">No. Telepon</label><input type="text" value={formData.no_telp || ''} onChange={(e) => setFormData({...formData, no_telp: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Email</label><input type="email" value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                  </div>
                </div>

                {/* 2. Edit Pendidikan */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Edit Pendidikan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block font-medium text-gray-700">Pendidikan Terakhir</label><input type="text" value={formData.pendidikan_terakhir || ''} onChange={(e) => setFormData({...formData, pendidikan_terakhir: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Institusi Pendidikan</label><input type="text" value={formData.institusi_pendidikan || ''} onChange={(e) => setFormData({...formData, institusi_pendidikan: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Tahun Lulus</label><input type="number" value={formData.tahun_lulus || ''} onChange={(e) => setFormData({...formData, tahun_lulus: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                  </div>
                </div>

                {/* 3. Edit Keluarga */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Edit Data Keluarga</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block font-medium text-gray-700">Nama Ayah</label><input type="text" value={formData.nama_ayah || ''} onChange={(e) => setFormData({...formData, nama_ayah: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Nama Ibu</label><input type="text" value={formData.nama_ibu || ''} onChange={(e) => setFormData({...formData, nama_ibu: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Nama Pasangan</label><input type="text" value={formData.nama_pasangan || ''} onChange={(e) => setFormData({...formData, nama_pasangan: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                    <div><label className="block font-medium text-gray-700">Jumlah Anak</label><input type="number" value={formData.jumlah_anak ?? 0} onChange={(e) => setFormData({...formData, jumlah_anak: e.target.value})} className="w-full border rounded p-2 mt-1" /></div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-6 border-t">
                  <button type="submit" disabled={uploading} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition disabled:opacity-50">
                    {uploading ? 'Mengupload Foto & Menyimpan...' : 'Simpan Semua Perubahan ke Database'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ==========================================
  // TAMPILAN DEFAULT MENU LAINNYA
  // ==========================================
  return (
    <div className="p-8">
      <button onClick={() => router.push('/dashboard')} className="mb-4 text-sm bg-white border px-3 py-1.5 rounded">← Kembali</button>
      <h1 className="text-xl font-bold uppercase">Riwayat {slug.replace(/-/g, ' ')}</h1>
      <p className="text-sm text-gray-600 mt-2">Halaman detail untuk menu ini sedang dipersiapkan.</p>
    </div>
  )
}