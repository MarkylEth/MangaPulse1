import { useAuth } from './context'

export const useAdminPermissions = () => {
  const { profile } = useAuth()
  
  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator' || isAdmin
  
  return {
    isAdmin,
    isModerator,
    canManageUsers: isAdmin,
    canModerateManga: isModerator,
    canModerateComments: isModerator,
    canManageContent: isModerator,
  }
}
