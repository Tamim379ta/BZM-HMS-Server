import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { username, admin } from 'better-auth/plugins'
import { db } from '../config/db.js'
import { ac, superadmin, receptionist, doctor, lab } from './permissions.js'

export const auth = betterAuth({
  database: mongodbAdapter(db),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_URL],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [
    username(),
    admin({
      ac,
      roles: { superadmin, receptionist, doctor, lab },
      adminRoles: ['superadmin'],
      defaultRole: 'receptionist',
    }),
  ],
})