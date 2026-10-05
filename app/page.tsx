'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function HomePage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEmployee = async () => {
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
        console.error('Gagal memuat data pegawai:', error.message)
      } else {
        setEmployee(data)
      }
      setLoading(false)
    }

    fetchEmployee()
  }, [router])

  const menuCategories = [
    {
      category: 'DATA PRIBADI & KELUARGA (DATA UTAMA)',
      type: 'pink',
      items: [
        { title: 'Data Pribadi', slug: 'data-pribadi', icon: '👤' },
      ]
    },
    {
      category: 'RIWAYAT PEKERJAAN & LAYANAN (DATA INPUT/OUTPUT)',
      type: 'green',
      items: [
        { title: 'Jabatan', slug: 'jabatan', icon: '👔', customPath: '/dashboard/jabatan' },
        { title: 'Pangkat', slug: 'pangkat', icon: '⭐', customPath: '/dashboard/pangkat' },
        { title: 'Gaji Berkala', slug: 'gaji', icon: '💰', customPath: '/dashboard/gaji' },
        { title: 'Angka Kredit', slug: 'angka-kredit', icon: '📊', customPath: '/dashboard/angka-kredit' },
        { title: 'Diklat / Sertifikasi', slug: 'diklat', icon: '📜', customPath: '/dashboard/diklat' },
        { title: 'SKP', slug: 'skp', icon: '📈', customPath: '/dashboard/skp' },
        { title: 'Penghargaan', slug: 'penghargaan', icon: '🏆', customPath: '/dashboard/penghargaan' },
        { title: 'Hukuman Disiplin', slug: 'hukuman-disiplin', icon: '⚖️', customPath: '/dashboard/hukuman-disiplin' },
      ]
    }
  ]

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Memuat data pegawai...</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Kiri */}
      <aside className="w-64 bg-white border-r hidden md:block p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <img 
            src="data:image/png;base64,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" 
            alt="Logo PU" 
            className="w-8 h-8 object-contain"
          />
          <span className="text-xs font-bold text-[#1b2a4a] leading-tight">
            SIMPEG Sistem Informasi<br/>KepegawaianBBWS VIII
          </span>
        </div>
        <nav className="space-y-2 text-sm">
          <a href="/dashboard" className="block p-2.5 rounded bg-sky-900 text-white font-semibold">Halaman Utama</a>
          <a href="/dashboard/data-pribadi" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Data Saya</a>
          <a href="#" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Riwayat Kepegawaian</a>
          <a href="/dashboard/info-pekerja" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Info Kepegawaian</a>
          <a href="/dashboard/tambah-pegawai" className="block p-2.5 rounded hover:bg-gray-100 text-gray-700">Tambah Pegawai</a>
        </nav>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-gray-800">Halaman Utama</h1>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-full shadow-sm border">
            <span className="text-sm font-semibold text-gray-700 px-2">
              {employee ? employee.nama : 'Pengguna'}
            </span>
            <span className="bg-sky-500 text-white text-xs px-3 py-1 rounded-full font-mono">
              {employee ? employee.nip : '-'}
            </span>
          </div>
        </div>

        {/* Render Menu Grid dengan Ikon */}
        {menuCategories.map((cat, idx) => (
          <div key={idx} className="mb-8">
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">
              {cat.category}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cat.items.map((item: any, i) => (
                <div 
                  key={i}
                  onClick={() => {
                    if (item.customPath) {
                      router.push(item.customPath)
                    } else {
                      router.push(`/dashboard/${item.slug}`)
                    }
                  }}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-sky-300 transition cursor-pointer flex flex-col items-center text-center justify-center h-32 relative group"
                >
                  <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${cat.type === 'pink' ? 'bg-pink-500' : 'bg-green-500'}`} />
                  
                  {/* Bagian Ikon */}
                  <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition">
                    {item.icon}
                  </div>

                  <span className="text-xs font-semibold text-gray-700">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}