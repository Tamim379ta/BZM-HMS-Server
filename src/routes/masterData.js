import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { db } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

const num = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

const bool = (v) => (typeof v === 'boolean' ? v : null)

const oneOf = (list) => (v) => (list.includes(v) ? v : null)

const toId = (v) => (typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v) ? new ObjectId(v) : null)

const createCrud = ({ collection, fields, beforeSave, beforeDelete }) => {
  const col = () => db.collection(collection)
  const collation = { locale: 'en', strength: 2 }

  const validate = (body, partial) => {
    const data = {}
    for (const [key, field] of Object.entries(fields)) {
      if (body[key] === undefined) {
        if (partial) continue
        if (field.default !== undefined) {
          data[key] = field.default
          continue
        }
        return { error: `${key} is required` }
      }
      const value = field.parse(body[key])
      if (value === null) return { error: `Invalid ${key}` }
      data[key] = value
    }
    return { data }
  }

  const isDuplicate = async (name, excludeId) => {
    const filter = { name }
    if (excludeId) filter._id = { $ne: excludeId }
    return !!(await col().findOne(filter, { collation }))
  }

  const list = async (req, res) => {
    try {
      res.json(await col().find().sort({ createdAt: -1 }).toArray())
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }

  const admin = Router()
  admin.use(requireAuth, requireRole('superadmin'))

  admin.get('/', list)

  admin.post('/', async (req, res) => {
    try {
      const { data, error } = validate(req.body, false)
      if (error) return res.status(400).json({ message: error })

      const problem = beforeSave ? await beforeSave(data) : null
      if (problem) return res.status(400).json({ message: problem })

      if (await isDuplicate(data.name)) {
        return res.status(409).json({ message: 'An entry with this name already exists' })
      }

      const now = new Date()
      const doc = { ...data, createdAt: now, updatedAt: now }
      await col().insertOne(doc)
      res.status(201).json(doc)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  admin.patch('/:id', async (req, res) => {
    try {
      const id = toId(req.params.id)
      if (!id) return res.status(400).json({ message: 'Invalid id' })

      const { data, error } = validate(req.body, true)
      if (error) return res.status(400).json({ message: error })
      if (!Object.keys(data).length) {
        return res.status(400).json({ message: 'Nothing to update' })
      }

      const problem = beforeSave ? await beforeSave(data) : null
      if (problem) return res.status(400).json({ message: problem })

      if (data.name && (await isDuplicate(data.name, id))) {
        return res.status(409).json({ message: 'An entry with this name already exists' })
      }

      const updated = await col().findOneAndUpdate(
        { _id: id },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!updated) return res.status(404).json({ message: 'Not found' })
      res.json(updated)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  admin.delete('/:id', async (req, res) => {
    try {
      const id = toId(req.params.id)
      if (!id) return res.status(400).json({ message: 'Invalid id' })

      const doc = await col().findOne({ _id: id })
      if (!doc) return res.status(404).json({ message: 'Not found' })

      const problem = beforeDelete ? await beforeDelete(doc) : null
      if (problem) return res.status(409).json({ message: problem })

      await col().deleteOne({ _id: id })
      res.json({ message: 'Deleted' })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  const read = Router()
  read.get('/', requireAuth, requireRole('superadmin', 'receptionist', 'doctor', 'lab'), list)

  return { admin, read }
}

export const beds = createCrud({
  collection: 'beds',
  fields: {
    name: { parse: str },
    type: { parse: str },
    costPerDay: { parse: num },
    status: { parse: oneOf(['available', 'occupied', 'maintenance']), default: 'available' },
  },
})

export const labRooms = createCrud({
  collection: 'labRooms',
  fields: {
    name: { parse: str },
    type: { parse: str },
    active: { parse: bool, default: true },
  },
  beforeDelete: async (room) => {
    const used = await db.collection('labTests').countDocuments({ roomId: room._id })
    return used ? `This room has ${used} lab test(s) assigned. Reassign or delete them first.` : null
  },
})

export const labTests = createCrud({
  collection: 'labTests',
  fields: {
    name: { parse: str },
    category: { parse: str },
    price: { parse: num },
    roomId: { parse: toId },
    available: { parse: bool, default: true },
  },
  beforeSave: async (data) => {
    if (!data.roomId) return null
    const room = await db.collection('labRooms').findOne({ _id: data.roomId })
    return room ? null : 'Lab room not found'
  },
})