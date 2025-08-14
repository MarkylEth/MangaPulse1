'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, UserCheck, UserX, Shield, Crown, Users, 
  MoreHorizontal, Mail, Calendar, Ban, CheckCircle,
  AlertTriangle, Loader2, Filter
} from 'lucide-react'
import { useTheme } from '@/lib/theme/context'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/database.types'
import Image from 'next/image'

type Profile = Tables<'profiles'>

export function UserManagement() {
  const { theme } = useTheme()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'
  const cardClass = theme === 'light' 
    ? 'bg-white border-gray-200 shadow-sm' 
    : 'bg-slate-800 border-slate-700 shadow-lg'

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    const supabase = createClient()
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
      
      if (error) throw error
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
      
      setShowRoleModal(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating user role:', error)
    }
  }

  const getRoleBadge = (role: string | null) => {
    const roles = {
      admin: { label: 'Админ', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      moderator: { label: 'Модератор', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      user: { label: 'Пользователь', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' }
    }
    const roleData = roles[role as keyof typeof roles] || roles.user
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${roleData.color}`}>
        {roleData.label}
      </span>
    )
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = (
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className={mutedTextClass}>Загрузка пользователей...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Управление пользователями</h1>
        <p className={mutedTextClass}>
          Управляйте пользователями, назначайте роли и модерируйте аккаунты
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: 'Всего пользователей', value: users.length, icon: Users, color: 'from-blue-500 to-blue-600' },
          { title: 'Администраторов', value: users.filter(u => u.role === 'admin').length, icon: Crown, color: 'from-red-500 to-red-600' },
          { title: 'Модераторов', value: users.filter(u => u.role === 'moderator').length, icon: Shield, color: 'from-yellow-500 to-yellow-600' },
          { title: 'Активных', value: users.filter(u => !u.role || u.role === 'user').length, icon: UserCheck, color: 'from-green-500 to-green-600' }
        ].map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border ${cardClass}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${textClass}`}>{stat.value}</p>
                  <p className={`text-sm ${mutedTextClass}`}>{stat.title}</p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Search and Filters */}
      <div className={`p-4 rounded-xl border ${cardClass}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${mutedTextClass}`} />
            <input
              type="text"
              placeholder="Поиск пользователей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900'
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className={`w-5 h-5 ${mutedTextClass}`} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900'
                  : 'bg-slate-700 border-slate-600 text-white'
              }`}
            >
              <option value="all">Все роли</option>
              <option value="user">Пользователи</option>
              <option value="moderator">Модераторы</option>
              <option value="admin">Администраторы</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={`rounded-xl border ${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'light' ? 'bg-gray-50' : 'bg-slate-700/50'}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>
                  Пользователь
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>
                  Роль
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>
                  Дата регистрации
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${mutedTextClass}`}>
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`hover:${theme === 'light' ? 'bg-gray-50' : 'bg-slate-700/50'} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-purple-500">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt="Avatar"
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-semibold">
                            {user.username?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold ${textClass}`}>
                          {user.username || user.full_name || 'Без имени'}
                        </p>
                        <p className={`text-sm ${mutedTextClass}`}>{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${mutedTextClass}`} />
                      <span className={`text-sm ${textClass}`}>
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedUser(user)
                        setShowRoleModal(true)
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'light'
                          ? 'hover:bg-gray-100 text-gray-600'
                          : 'hover:bg-slate-600 text-slate-400'
                      }`}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </motion.button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md rounded-xl border ${cardClass} p-6`}
          >
            <h3 className={`text-lg font-bold ${textClass} mb-4`}>
              Изменить роль пользователя
            </h3>
            <div className="mb-6">
              <p className={mutedTextClass}>
                Пользователь: <span className={`font-semibold ${textClass}`}>
                  {selectedUser.username || selectedUser.full_name}
                </span>
              </p>
              <p className={mutedTextClass}>
                Текущая роль: {getRoleBadge(selectedUser.role)}
              </p>
            </div>
            
            <div className="space-y-3">
              {['user', 'moderator', 'admin'].map((role) => (
                <motion.button
                  key={role}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateUserRole(selectedUser.id, role)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedUser.role === role
                      ? theme === 'light'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : theme === 'light'
                        ? 'border-gray-200 hover:bg-gray-50'
                        : 'border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize font-semibold">
                      {role === 'user' ? 'Пользователь' : role === 'moderator' ? 'Модератор' : 'Администратор'}
                    </span>
                    {selectedUser.role === role && <CheckCircle className="w-5 h-5 text-green-500" />}
                  </div>
                </motion.button>
              ))}
            </div>
            
            <div className="flex gap-3 mt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowRoleModal(false)
                  setSelectedUser(null)
                }}
                className={`flex-1 px-4 py-2 border rounded-lg font-semibold transition-all ${
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Отмена
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
