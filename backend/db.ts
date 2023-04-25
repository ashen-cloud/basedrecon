import mongoose, { Document, Model, Schema } from 'mongoose'

export interface Host extends Document {
  ip: string
  name: string
  user: string
  password: string
}

const hostSchema: Schema = new mongoose.Schema({
  ip: { type: String, required: true },
  user: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: false },
})

const Host: Model<Host> = mongoose.model<Host>('Host', hostSchema)

const name = 'basedscan'

async function connectDb(): Promise<mongoose.Mongoose> {
  try {

    await mongoose.connect(`mongodb://localhost/${name}`)
    console.log(`connected to ${name}`)

    return mongoose;

  } catch (error) {

    console.error(`could not connect to ${name}`, error)
    throw error;

  }
}

export { connectDb, Host }
