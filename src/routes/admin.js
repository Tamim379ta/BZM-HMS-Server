import { Router } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const STAFF_ROLES = ['receptionist', 'doctor', 'lab']

router.post('/staff', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { name, username, password, role } = req.body

  if (!name || !username || !password || !STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'name, username, password and a valid role are required' })
  }

  const clean = username.trim().toLowerCase()

  try {
    const result = await auth.api.createUser({
      body: {
        email: `${clean}@bzm.local`,
        password,
        name,
        role,
        data: { username: clean, displayUsername: username.trim() },
      },
      headers: fromNodeHeaders(req.headers),
    })
    res.status(201).json(result.user)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

export default router








const getTarget = async (req, res) => {
  const ctx = await auth.$context
  const target = await ctx.internalAdapter.findUserById(req.params.id)

  if (!target) {
    res.status(404).json({ message: 'User not found' })
    return null
  }
  if (target.role === 'superadmin' || target.id === req.user.id) {
    res.status(403).json({ message: 'This account cannot be modified' })
    return null
  }
  return target
}

router.get('/staff', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const result = await auth.api.listUsers({
      query: { limit: 200, sortBy: 'createdAt', sortDirection: 'desc' },
      headers: fromNodeHeaders(req.headers),
    })
    const staff = result.users.filter((u) => u.role !== 'superadmin')
    res.json(staff)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.patch('/staff/:id/ban', requireAuth, requireRole('superadmin'), async (req, res) => {
  const target = await getTarget(req, res)
  if (!target) return

  try {
    await auth.api.banUser({
      body: { userId: target.id, banReason: req.body.reason || 'Blocked by admin' },
      headers: fromNodeHeaders(req.headers),
    })
    res.json({ message: 'User blocked' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.patch('/staff/:id/unban', requireAuth, requireRole('superadmin'), async (req, res) => {
  const target = await getTarget(req, res)
  if (!target) return

  try {
    await auth.api.unbanUser({
      body: { userId: target.id },
      headers: fromNodeHeaders(req.headers),
    })
    res.json({ message: 'User unblocked' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.patch('/staff/:id/password', requireAuth, requireRole('superadmin'), async (req, res) => {
  const target = await getTarget(req, res)
  if (!target) return

  const { password } = req.body
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  try {
    const headers = fromNodeHeaders(req.headers)
    await auth.api.setUserPassword({ body: { userId: target.id, newPassword: password }, headers })
    await auth.api.revokeUserSessions({ body: { userId: target.id }, headers })
    res.json({ message: 'Password reset, user signed out everywhere' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.delete('/staff/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  const target = await getTarget(req, res)
  if (!target) return

  try {
    await auth.api.removeUser({
      body: { userId: target.id },
      headers: fromNodeHeaders(req.headers),
    })
    res.json({ message: 'User deleted' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})