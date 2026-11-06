import 'dotenv/config'
import { connectDB } from '../config/db.js'
import { auth } from '../lib/auth.js'

const run = async () => {
  await connectDB("bzm-hms")

  const username = process.env.SEED_ADMIN_USERNAME
  const password = process.env.SEED_ADMIN_PASSWORD
  const email = `${username}@bzm.local`

  const ctx = await auth.$context

  const existing = await ctx.internalAdapter.findUserByEmail(email)
  if (existing) {
    console.log('Super Admin already exists')
    process.exit(0)
  }

  const hash = await ctx.password.hash(password)

  const user = await ctx.internalAdapter.createUser({
    email,
    name: 'Super Admin',
    username,
    displayUsername: username,
    role: 'superadmin',
    emailVerified: true,
  })

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hash,
  })

  console.log('Super Admin created:', username)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})