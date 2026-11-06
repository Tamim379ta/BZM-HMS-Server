import { MongoClient } from 'mongodb'


const client = new MongoClient(process.env.MONGODB_URI)
console.log('URI:', process.env.MONGODB_URI)

export const db = client.db("bzm-hms")

export const connectDB = async () => {
  await client.connect()
  console.log('MongoDB connected')
}