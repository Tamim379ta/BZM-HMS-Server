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