import 'dotenv/config'
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import { connectDB, db } from '../config/db.js'
import { buildMedicine, ensureMedicineIndexes } from '../lib/medicines.js'

const file = process.argv[2] || 'data/medicines.csv'

const run = async () => {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`)
    process.exit(1)
  }

  await connectDB()
  await ensureMedicineIndexes()

  const rows = parse(fs.readFileSync(file), {
    columns: (header) => header.map((h) => h.trim().toLowerCase().replace(/[\s_]/g, '')),
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  })

  const ops = []
  const seen = new Set()
  let skipped = 0

  for (const r of rows) {
    const m = buildMedicine({
      name: r.name,
      genericName: r.genericname || r.generic,
      strength: r.strength,
      form: r.form,
    })
    if (!m) {
      skipped++
      continue
    }

    const key = `${m.nameLower}|${m.strengthLower}|${m.formLower}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)

    const now = new Date()
    ops.push({
      updateOne: {
        filter: { nameLower: m.nameLower, strengthLower: m.strengthLower, formLower: m.formLower },
        update: { $set: { ...m, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    })
  }

  let inserted = 0
  let updated = 0
  for (let i = 0; i < ops.length; i += 1000) {
    const result = await db.collection('medicines').bulkWrite(ops.slice(i, i + 1000), { ordered: false })
    inserted += result.upsertedCount
    updated += result.modifiedCount
  }

  console.log(`Done. Added: ${inserted}, updated: ${updated}, skipped (blank or duplicate rows): ${skipped}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})