import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.js'
import { db } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const doctors = () => db.collection('doctors')
const TYPES = ['resident', 'special']

const toList = (v) =>
  (Array.isArray(v) ? v : String(v || '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean)
const loadDoctors = async () => {
  const ctx = await auth.$context
  const profiles = await doctors().find().sort({ createdAt: -1 }).toArray()

  return Promise.all(
    profiles.map(async (p) => {
      const u = await ctx.internalAdapter.findUserById(p.userId)
      return { ...p, name: u?.name, username: u?.username, banned: !!u?.banned }
    })
  )
}

export const adminDoctorRoutes = Router()
adminDoctorRoutes.use(requireAuth, requireRole('superadmin'))

adminDoctorRoutes.post('/', async (req, res) => {
  const { name, username, password, specialization, type } = req.body
  const degrees = toList(req.body.degrees)
  const fee = Number(req.body.fee)

  if (
    !name || !username || !password || password.length < 8 ||
    !degrees.length || !specialization?.trim() ||
    !Number.isFinite(fee) || fee < 0 || !TYPES.includes(type)
  ) {
    return res.status(400).json({
      message: 'name, username, password (8+), degrees, specialization, fee and type (resident|special) are required',
    })
  }

  const clean = username.trim().toLowerCase()
  const headers = fromNodeHeaders(req.headers)
  let user

  try {
    const result = await auth.api.createUser({
      body: {
        email: `${clean}@bzm.local`,
        password,
        name,
        role: 'doctor',
        data: { username: clean, displayUsername: username.trim() },
      },
      headers,
    })
    user = result.user
  } catch (err) {
    return res.status(400).json({ message: err.message })
  }

  try {
    const profile = {
      userId: user.id,
      degrees,
      specialization: specialization.trim(),
      fee,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await doctors().insertOne(profile)
    res.status(201).json({ _id: insertedId, ...profile, name: user.name, username: user.username })
  } catch (err) {
    await auth.api.removeUser({ body: { userId: user.id }, headers })
    res.status(500).json({ message: 'Could not create doctor profile' })
  }
})

adminDoctorRoutes.get('/', async (req, res) => {
  try {
    res.json(await loadDoctors(req))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

adminDoctorRoutes.patch('/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  const b = req.body
  const set = {}

  if (b.degrees !== undefined) {
    const d = toList(b.degrees)
    if (!d.length) return res.status(400).json({ message: 'degrees cannot be empty' })
    set.degrees = d
  }
  if (b.specialization !== undefined) {
    const s = String(b.specialization).trim()
    if (!s) return res.status(400).json({ message: 'specialization cannot be empty' })
    set.specialization = s
  }
  if (b.fee !== undefined) {
    const f = Number(b.fee)
    if (!Number.isFinite(f) || f < 0) return res.status(400).json({ message: 'Invalid fee' })
    set.fee = f
  }
  if (b.type !== undefined) {
    if (!TYPES.includes(b.type)) return res.status(400).json({ message: 'Invalid type' })
    set.type = b.type
  }
  if (!Object.keys(set).length) {
    return res.status(400).json({ message: 'Nothing to update' })
  }

  set.updatedAt = new Date()

  const updated = await doctors().findOneAndUpdate(
    { _id: new ObjectId(req.params.id) },
    { $set: set },
    { returnDocument: 'after' }
  )
  if (!updated) return res.status(404).json({ message: 'Doctor not found' })
  res.json(updated)
})

adminDoctorRoutes.delete('/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  const profile = await doctors().findOne({ _id: new ObjectId(req.params.id) })
  if (!profile) return res.status(404).json({ message: 'Doctor not found' })

  try {
    await auth.api.removeUser({
      body: { userId: profile.userId },
      headers: fromNodeHeaders(req.headers),
    })
    await doctors().deleteOne({ _id: profile._id })
    res.json({ message: 'Doctor deleted' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

export const doctorRoutes = Router()

doctorRoutes.get(
  '/',
  requireAuth,
  requireRole('receptionist', 'doctor', 'superadmin'),
  async (req, res) => {
    try {
      const all = await loadDoctors(req)
      res.json(
        all
          .filter((d) => !d.banned)
          .map(({ _id, name, degrees, specialization, fee, type }) => ({
            _id, name, degrees, specialization, fee, type,
          }))
      )
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
)