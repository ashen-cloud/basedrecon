import express, { Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { Client } from 'ssh2'
import fs from 'fs-extra'
import os from 'os'

import { connectDb, Host, HostModel, Target, TargetModel } from './db'

const jsonParser = bodyParser.json()

const app = express()

app.use(jsonParser)

const PORT = process.env.PORT || 8600

const homeDir = os.homedir()

const WORKING_DIR = process.env.WORKING_DIR || `${homeDir}/Basedscan/`

const todayDir = WORKING_DIR + new Date().toISOString().split('T')[0]

fs.mkdirpSync(WORKING_DIR)
fs.mkdirpSync(todayDir)

export interface IHost {
  ip: string
  name: string
  user: string
  password: string
  active: boolean
}

type IExecReturn = Promise<{result: string[], code: number, signal: number}>
type IDataCb = (data: string) => Promise<string | void>

interface IConnectedHost extends IHost {
    execute: (cmd: string, out?: boolean, cb?: IDataCb) => IExecReturn
    // connection: Client
}

const _exec = (cmd: string, h: IHost, out = true, cb?: IDataCb): IExecReturn => {
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
                    if (cb) {
                        cb(data)
                    }
                    if (out) {
                        buffer.push(data.toString())
                    }
                })
                .on('end', (code: number, signal: number) => {
                    console.log(`process on ${h.name}-${h.ip} exited with code ${code}`)
                    return resolve({ result: out ? buffer : [], code, signal}) // todo: why code undefined?
                })
                .stderr.on('data', (data) => {
                    data = data.toString()
                    console.log(`STDERR on ${h.name}-${h.ip}: ${data}`)
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
    const _tools = [
        'amass',
        'ffuf',
    ]

    let connectedHosts: IConnectedHost[] = [];

    (async _ => {
        const hosts = await HostModel.find({ active: true })

        connectedHosts = hosts.map((h: any) => {
            
            return {
                ...h._doc,
                execute:  (cmd: string, out = true, cb?: IDataCb) => {
                    return new Promise(async (resolve, _) => {
                        return resolve(await _exec(cmd, h, out, cb))
                    })
                }
            }
        })

    })()

    app.get('/ping', async (_, res) => {
        console.log(connectedHosts)
        res.send('pong')
    })

    app.post('/full-dir-map', async (req, res) => {
        const { targetUrl, hostName } = req.body

        const host = connectedHosts.find(x => x.name === hostName)

        const target = TargetModel.findOne({ url: targetUrl })

        const createCmd = ({
            protocol = 'https://',
            domain = '',
            url = '',
            dir = '',
            list = '~/SecLists/Discovery/Web-Content/common.txt',
            mc = 200,
            rate = 400,
            t = 30
        }) => {
            if (domain.length) domain += '.'
            if (dir.length) dir += '/'
            return `ffuf -u ${protocol}${domain}${url}/${dir}FUZZ -w ${list} -r -mc ${mc} -rate ${rate} -t ${t}`
        }

        const targetDir = todayDir + '/' + targetUrl
        const toolDir = targetDir + '/' + 'ffuf'
        fs.mkdirpSync(toolDir)
        const filePath = toolDir + '/' + new Date().toString().split(' ')[4] + '.txt'

        const walk = async (url = '', dir = '', domain = '', allFiles: string[] = [], allDirs: string[] = [], tree: any = {}) => {
            const { result: files } = await _exec(createCmd({
                url,
                dir,
                domain,
            }), host, true, async (data) => {
                fs.writeFileSync(filePath, data, { flag: 'a+' })
            })

            const filesSt = JSON.stringify(files)
            const found = filesSt.split('* FUZZ: ').filter(x => !x.includes('Status')).map(
                x => x.replaceAll('\n', '').replaceAll('\\n', '').replace(/[^\w\s.]/gi, "")
            )

            for (const f of found) {
                const newDirPath = dir.length ? (dir + '/' + f) : f
                const path = domain + url + '/' + newDirPath
                if (!f.includes('.')) { // sus
                    allDirs.push(path)
                    // tree[path] = []
                    await walk(url, newDirPath, domain, allFiles, allDirs, tree)
                } else {
                    allFiles.push(path)
                    // tree[path].push(path)
                }
            }

            return { allFiles, allDirs, tree }
        }

        const { allFiles, allDirs } = await walk(targetUrl)

        console.log('files', allFiles)
        console.log('dirs', allDirs)

        res.json({ files: allFiles, dirs: allDirs })
    })

    const safeInsert = async (model: any, dType: any, filter: any, fields: any) => { // dbms apis arent for humans...
        const doc = await model.findOne(filter)
        
        if (doc) {
            for (const key in fields) {
                const field = fields[key]

                if (!doc[key]) {
                    doc[key] = field
                } else {
                    if (doc[key] !== field) {
                        if (doc[key].length !== undefined && field.length !== undefined) {
                            for (const elem of field) {
                                if (!doc[key].includes(elem)) {
                                    doc[key].push(elem)
                                }
                            }
                        } else {
                            if ((!doc[key] || [''].includes(field)) && !!field) {
                                doc[key] = field
                            }
                        }
                    }
                }
            }

            await doc.save()
            return doc
        } else {
            const newDoc = new dType(fields)
            await newDoc.save()
            return newDoc
        }
    }

    app.post('/execute-long', async (req, res) => { // todo: url in command and url in dir situation
        const { cmd, name, targetUrl } = req.body

        const host = connectedHosts.find(x => x.name === name)

        const targetDir = todayDir + '/' + targetUrl
        fs.mkdirpSync(targetDir)

        const toolName = cmd.split(' ')[0]

        if (toolName === ' ') {
            return res.json({ success: 0, err: 'no command' })
        }

        let toolDir: string
        let filePath: string

         // todo: command might not be equal to package name
        toolDir = targetDir + '/' + (_tools.includes(toolName) ? toolName : '_other')
        fs.mkdirpSync(toolDir)

        filePath = toolDir + '/' + new Date().toString().split(' ')[4] + '.txt'

        const result = await safeInsert(TargetModel, Target, { url: targetUrl }, {
            url: targetUrl,
            active: true,
            domains: [],
            headers: [],
            scans: [filePath],
        })

        await host.execute(cmd, false, async (data: string) => {
            fs.writeFileSync(filePath, data, { flag: 'a+' }) // todo: stream?
        })

        return res.json({ success: 1, target: result })
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

    const setupHost = async (h: IConnectedHost) => {
        const tools = _tools.map(x => 'yes | pacman --noprogressbar -S ' + x)

        const blackArch = [
            'yes | pacman --noprogressbar -Syuu',
            'curl -O https://blackarch.org/strap.sh',
            'chmod +x strap.sh',
            './strap.sh',
            'yes | pacman --noprogressbar -Syuu',
            'yes | pacman --noprogressbar -S git wget',
            'git clone https://github.com/danielmiessler/SecLists',
            'git clone https://github.com/emadshanab/WordLists-20111129',
            'git clone https://github.com/drtychai/wordlists',
        ]

        const allCmds = [...blackArch, ...tools]

        for (const cmd of allCmds) {
            await h.execute(cmd, false)
        }
    }

    app.post('/host/setup', async (req, res) => {
        const name = req.body?.name
        const h = connectedHosts.find(x => x.name === name)
        try {
            await setupHost(h)
            return res.json({ success: 1 })
        } catch (e) {
            return res.json({ success: 0, err: e })
        }
    })

    app.get('/target/:id', async (req, res) => {
        const id = req.params.id
        const target = await TargetModel.findById(id)
        res.json(target)
    })

    app.get('/target', async (_, res) => {
        const targets = await TargetModel.find()
        res.json(targets)
    })

    app.post('/target', async (req, res) => {
        const { ip, } = req.body

        const target = new Target({
            ip, 
        })

        await target.save()

        res.json(target)
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
