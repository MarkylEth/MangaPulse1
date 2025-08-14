'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Loader2, Mail, Lock, User, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useTheme } from '@/lib/theme/context'
import Image from 'next/image'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { theme } = useTheme()
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { signIn, signUp } = useAuth()

  // Update mode when initialMode changes
  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setError('')
    setSuccess('')
    setShowPassword(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      let result
      if (mode === 'login') {
        result = await signIn(email, password)
      } else {
        if (!fullName.trim()) {
          setError('Пожалуйста, введите полное имя')
          setLoading(false)
          return
        }
        result = await signUp(email, password, fullName)
      }

      if (result.error) {
        if (result.error.message.includes('Invalid login credentials')) {
          setError('Неверный email или пароль')
        } else if (result.error.message.includes('User already registered')) {
          setError('Пользователь с таким email уже зарегистрирован')
        } else if (result.error.message.includes('Password should be at least')) {
          setError('Пароль должен содержать минимум 6 символов')
        } else {
          setError(result.error.message)
        }
      } else {
        if (mode === 'register') {
          setSuccess('Проверьте вашу электронную почту для подтверждения регистрации')
          // Don't close immediately for registration
        } else {
          handleClose()
        }
      }
    } catch (err) {
      setError('Произошла ошибка. Попробуйте еще раз')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
  }

  const bgClass = theme === 'light' 
    ? 'bg-white border-gray-200' 
    : 'bg-slate-800 border-slate-700'
  
  const inputClass = theme === 'light'
    ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500'
    : 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500'

  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${bgClass}`}
          >
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <Image
                      src="/logodark.png"
                      alt="MangaPulse"
                      width={32}
                      height={32}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${textClass}`}>
                      {mode === 'login' ? 'Добро пожаловать!' : 'Создать аккаунт'}
                    </h2>
                    <p className={`text-sm ${mutedTextClass}`}>
                      {mode === 'login' 
                        ? 'Войдите в свой аккаунт' 
                        : 'Присоединяйтесь к нашему сообществу'
                      }
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClose}
                  className={`p-2 rounded-full transition-colors ${
                    theme === 'light' 
                      ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                      Полное имя
                    </label>
                    <div className="relative">
                      <User className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${mutedTextClass}`} />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all ${inputClass}`}
                        placeholder="Введите ваше полное имя"
                        required={mode === 'register'}
                      />
                    </div>
                  </motion.div>
                )}

                <div>
                  <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                    Email адрес
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${mutedTextClass}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all ${inputClass}`}
                      placeholder="example@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-3 ${textClass}`}>
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${mutedTextClass}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full pl-12 pr-14 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all ${inputClass}`}
                      placeholder="Введите пароль"
                      minLength={6}
                      required
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors ${mutedTextClass} hover:${textClass}`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </motion.button>
                  </div>
                  {mode === 'register' && (
                    <p className={`text-xs mt-2 ${mutedTextClass}`}>
                      Пароль должен содержать минимум 6 символов
                    </p>
                  )}
                </div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success Message */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500"
                    >
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{success}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {mode === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
                </motion.button>
              </form>

              {/* Switch Mode */}
              <div className="mt-8 text-center">
                <div className={`flex items-center gap-4 mb-4`}>
                  <div className={`flex-1 h-px ${theme === 'light' ? 'bg-gray-200' : 'bg-slate-600'}`} />
                  <span className={`text-sm font-medium ${mutedTextClass}`}>или</span>
                  <div className={`flex-1 h-px ${theme === 'light' ? 'bg-gray-200' : 'bg-slate-600'}`} />
                </div>
                <p className={`text-sm ${mutedTextClass}`}>
                  {mode === 'login' ? 'Еще нет аккаунта?' : 'Уже есть аккаунт?'}
                  {' '}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={switchMode}
                    className="text-blue-500 hover:text-blue-600 font-semibold transition-colors"
                  >
                    {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
                  </motion.button>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
