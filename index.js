import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { toNodeHandler } from 'better-auth/node'
import { connectDB } from './src/config/db.js'
import { auth } from './src/lib/auth.js'

const app = express()
const port = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.all('/api/auth/*splat', toNodeHandler(auth))
app.use(express.json())

app.get('/', (req, res) => {
  res.send('BZM HMS server running')
})

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`)
    })
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })