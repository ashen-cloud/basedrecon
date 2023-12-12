import fs from 'fs'
import os from 'os'
import { v4 } from 'uuid'

export interface ITarget {
  id: string | null
  url: string
  ip: string | null
  active: boolean | null
  domains: string[] | null
  headers: string[] | null
  scans: string[] | null
  dirTree: any | null
}

// const targetSchema: Schema = new mongoose.Schema({
//   url: { type: String, required: true },
//   ip: { type: String, required: false },
//   active: { type: Boolean, required: false, default: true },
//   domains: { type: [String], required: false, default: []  },
//   headers: { type: [String], required: false, default: [] },
//   scans: { type: [String], required: false, default: [] },
//   dirTree: { type: Schema.Types.Mixed, required: false, default: {} },
// })


export interface IHost {
  id: string | null
  ip: string
  name: string
  user: string
  password: string
  active: boolean
}

// const hostSchema: Schema = new mongoose.Schema({
//   ip: { type: String, required: true },
//   user: { type: String, required: true },
//   password: { type: String, required: true },
//   name: { type: String, required: false },
//   active: { type: Boolean, required: true },
// })

const cacheName = 'basedrecon'

const homeDir = os.homedir()

export const dataPath = homeDir + '/' + '.cache/' + cacheName

fs.mkdirSync(dataPath, { recursive: true })

export class DB {
  static mut: [{ model: string, locked: boolean, handle: fs.promises.FileHandle }?] = []

  static async find(model: string, pattern: any) {
    const handle = await fs.promises.open(dataPath + '/' + model + '.json', 'r')

    let idx = DB.mut.findIndex(x => x.model === model)

    if (DB.mut[idx]) {
      DB.mut[idx].locked = true
    } else {
      DB.mut.push({ model, locked: true, handle })
    }
  }
}

