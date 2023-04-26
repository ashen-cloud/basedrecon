import express, { Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { Client } from 'ssh2'

import { connectDb, Host, HostModel } from './db'

const jsonParser = bodyParser.json()

const app = express()

app.use(jsonParser)

const PORT = process.env.PORT || 8600

export interface IHost {
  ip: string
  name: string
  user: string
  password: string
  active: boolean
}

type IExecReturn = Promise<{result: string[], code: number, signal: number}>

interface IConnectedHost extends IHost {
    execute: (cmd: string, out?: boolean) => IExecReturn
    // connection: Client
}

const _exec = (cmd: string, h: IHost, out = false): IExecReturn => {
    const connection = new Client()
    return new Promise((resolve, _) => {
        connection.on('ready', () => {
            console.log(`connection to ${h.name}-${h.ip} opened`)
            connection.exec(cmd, (err, stream) => {
                const buffer: string[] = []

                if (err) throw err
                stream.on('close', (code, signal) => {
                    console.log(`connection to ${h.name}-${h.ip} closed`)
                    connection.end()
                })
                stream.on('data', (data: string) => {
                    console.log(`data from ${h.name}-${h.ip} received`)
                    buffer.push(data.toString())
                })
                .on('end', (code: number, signal: number) => {
                    console.log(`process on ${h.name}-${h.ip} exited with code ${code}`)
                    return resolve({ result: out ? buffer : [], code, signal}) // todo: why code undefined?
                })
                .stderr.on('data', (data) => {
                    console.log(`STDERR ol ${h.name}-${h.ip}: ${data}`)
                })
            })

        }).connect({
            host: h.ip,
            port: 22,
            username: h.user,
            password: h.password
        })
    })
}

connectDb().then(db => {
    let connectedHosts: IConnectedHost[] = [];

    (async _ => {
        const hosts = await HostModel.find({ active: true })

        connectedHosts = hosts.map((h: any) => {
            
            return {
                ...h._doc,
                execute:  (cmd: string, out = true) => {
                    return new Promise(async (resolve, _) => {
                        return resolve(await _exec(cmd, h, out))
                    })
                }
            }
        })

    })()

    app.get('/ping', async (_, res) => {
        console.log(connectedHosts)
        res.send('pong')
    })

    app.post('/execute', async (req, res) => {
        const { cmd, name } = req.body

        const host = connectedHosts.find(x => x.name === name)

        const { result, code, signal } = await host.execute(cmd)

        res.json({
            code,
            signal,
            result
        })
    })

    app.get('/host/:id', async (req, res) => {
        const id = req.params.id
        const host = await HostModel.findById(id)
        res.json(host)
    })

    app.get('/host', async (_, res) => {
        const hosts = await HostModel.find()
        res.json(hosts)
    })

    app.post('/host', async (req, res) => {
        const { ip, name, password } = req.body
        let { user, active } = req.body

        if (!user) {
            user = 'root'
        }

        if (!active) {
            active = true
        }

        const host = new Host({
            ip, name, password, user, active
        })

        await host.save()

        res.json(host)
    })

    app.listen(PORT, () => {
      console.log('started server on port', PORT)
    })
})
