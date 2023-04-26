import mongoose, { Document, Model, Schema } from 'mongoose'

export interface ITarget extends Document {
  url: string
  ip: string | null
  active: boolean | null
  domains: string[] | null
  headers: string[] | null
  scans: string[] | null
  dirTree: any | null
}

const targetSchema: Schema = new mongoose.Schema({
  url: { type: String, required: true },
  ip: { type: String, required: false },
  active: { type: Boolean, required: false, default: true },
  domains: { type: [String], required: false, default: []  },
  headers: { type: [String], required: false, default: [] },
  scans: { type: [String], required: false, default: [] },
  dirTree: { type: Schema.Types.Mixed, required: false, default: {} },
})

const Target: Model<ITarget> = mongoose.model<ITarget>('Target', targetSchema)

const TargetModel = mongoose.model('Target', targetSchema)

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

const HostModel = mongoose.model('Host', hostSchema)

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

export { connectDb, Host, HostModel, Target, TargetModel }
