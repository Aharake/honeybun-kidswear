import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Whether this account is an admin and
  // whether the database has the admins list yet (the shopper-accounts update).
  const [role, setRole] = useState({ forUser: undefined, isAdmin: false, accountsReady: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    let active = true
    // Always asks the database, even with nobody signed in, so the storefront
    // knows whether shopper accounts are switched on.
    supabase
      .from('admins')
      .select('user_id')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          // No admins table yet: the old single-admin setup. Any signed-in
          // user is the admin, and shopper accounts stay switched off so a
          // shopper can never be mistaken for one.
          setRole({ forUser: userId, isAdmin: Boolean(userId), accountsReady: false })
          return
        }
        setRole({
          forUser: userId,
          isAdmin: Boolean(userId) && (data || []).some((row) => row.user_id === userId),
          accountsReady: true,
        })
      })
    return () => {
      active = false
    }
  }, [userId])

  // The answer only counts for the user it was asked about; right after a
  // sign-in it is stale until the new check comes back.
  const roleChecked = role.forUser === userId

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  const signUp = (email, password, name) =>
    supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
  const sendPasswordReset = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account/reset` })
  const updatePassword = (password) => supabase.auth.updateUser({ password })

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    roleChecked,
    isAdmin: roleChecked && role.isAdmin,
    accountsReady: role.accountsReady,
    signIn,
    signOut,
    signUp,
    sendPasswordReset,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
