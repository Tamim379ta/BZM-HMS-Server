import { db } from '../config/db.js'

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

export const buildMedicine = (raw) => {
  const name = clean(raw.name)
  if (!name) return null
  const genericName = clean(raw.genericName)
  const strength = clean(raw.strength)
  const form = clean(raw.form)

  return {
    name,
    genericName,
    strength,
    form,
    nameLower: name.toLowerCase(),
    genericLower: genericName.toLowerCase(),
    strengthLower: strength.toLowerCase(),
    formLower: form.toLowerCase(),
  }
}

export const ensureMedicineIndexes = async () => {
  const col = db.collection('medicines')
  await col.createIndex({ nameLower: 1 })
  await col.createIndex({ genericLower: 1 })
  await col.createIndex({ nameLower: 1, strengthLower: 1, formLower: 1 }, { unique: true })
}