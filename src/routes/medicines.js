import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { db } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { buildMedicine } from '../lib/medicines.js'

const meds = () => db.collection('medicines')
const hidden = { nameLower: 0, genericLower: 0, strengthLower: 0, formLower: 0 }
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pick = (b) => ({
  name: b.name,
  genericName: b.genericName,
  strength: b.strength,
  form: b.form,
})

export const searchRoutes = Router()

searchRoutes.get('/', requireAuth, requireRole('doctor', 'superadmin'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (!q) return res.json([])

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    const rx = new RegExp('^' + escapeRegex(q))

    const docs = await meds()
      .find({ $or: [{ nameLower: rx }, { genericLower: rx }] }, { projection: hidden })
      .sort({ nameLower: 1 })
      .limit(limit)
      .toArray()

    res.json(docs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export const adminRoutes = Router()
adminRoutes.use(requireAuth, requireRole('superadmin'))

adminRoutes.post('/', async (req, res) => {
  try {
    const m = buildMedicine(pick(req.body))
    if (!m) return res.status(400).json({ message: 'name is required' })

    const now = new Date()
    const doc = { ...m, createdAt: now, updatedAt: now }
    await meds().insertOne(doc)

    const { nameLower, genericLower, strengthLower, formLower, ...out } = doc
    res.status(201).json(out)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This medicine (name, strength, form) already exists' })
    }
    res.status(500).json({ message: err.message })
  }
})

adminRoutes.patch('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }
    const _id = new ObjectId(req.params.id)

    const existing = await meds().findOne({ _id })
    if (!existing) return res.status(404).json({ message: 'Medicine not found' })

    const body = pick(req.body)
    const merged = {}
    for (const key of Object.keys(body)) {
      merged[key] = body[key] !== undefined ? body[key] : existing[key]
    }

    const m = buildMedicine(merged)
    if (!m) return res.status(400).json({ message: 'name cannot be empty' })

    const updated = await meds().findOneAndUpdate(
      { _id },
      { $set: { ...m, updatedAt: new Date() } },
      { returnDocument: 'after', projection: hidden }
    )
    res.json(updated)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This medicine (name, strength, form) already exists' })
    }
    res.status(500).json({ message: err.message })
  }
})

adminRoutes.delete('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }
    const result = await meds().deleteOne({ _id: new ObjectId(req.params.id) })
    if (!result.deletedCount) return res.status(404).json({ message: 'Medicine not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})