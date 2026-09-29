import { useRouter } from 'next/navigation'

export const useAuthGuard = (requiredRole?: 'admin' | 'user') => {
  const router = useRouter()

  const checkSession = () => {
    const nipAktif = localStorage.getItem('nip_aktif')
    const roleAktif = localStorage.getItem('role_aktif')

    // 1. Jika belum login sama sekali, lempar ke halaman login
    if (!nipAktif) {
      router.push('/login')
      return false
    }

    // 2. Jika halaman membutuhkan role khusus (misal: 'admin') tapi user bukan admin
    if (requiredRole && roleAktif !== requiredRole) {
      alert('Akses Ditolak: Anda tidak memiliki hak akses ke halaman ini!')
      router.push('/dashboard')
      return false
    }

    return true
  }

  return { checkSession }
}