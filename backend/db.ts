import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IHost extends Document {
  ip: string
  name: string
  user: string
  password: string
  active: boolean
}

const hostSchema: Schema = new mongoose.Schema({
  ip: { type: String, required: true },
  user: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: false },
  active: { type: Boolean, required: true },
})

const Host: Model<IHost> = mongoose.model<IHost>('Host', hostSchema)

const name = 'basedscan'

const HostModel = mongoose.model('Host', hostSchema)

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

export { connectDb, Host, HostModel }
