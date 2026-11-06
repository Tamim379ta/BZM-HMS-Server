import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'

export const ac = createAccessControl(defaultStatements)

export const superadmin = ac.newRole({ ...adminAc.statements })
export const receptionist = ac.newRole({ user: [], session: [] })
export const doctor = ac.newRole({ user: [], session: [] })
export const lab = ac.newRole({ user: [], session: [] })