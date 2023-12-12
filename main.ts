import express, { Request, Response, NextFunction } from 'express'
import bodyParser from 'body-parser'
import { Client } from 'ssh2'
import fs from 'fs-extra'
import os from 'os'

// import { Host, HostModel, Target, TargetModel } from './db'

const jsonParser = bodyParser.json()

const app = express()

app.use(jsonParser)

const PORT = process.env.PORT || 8600

const homeDir = os.homedir()

const WORKING_DIR = process.env.WORKING_DIR || `${homeDir}/Basedscan/`

const todayDir = WORKING_DIR + new Date().toISOString().split('T')[0]

const getFinalPath = (toolName: string, targetUrl: string): string => {
    const targetDir = todayDir + '/' + targetUrl
    const toolDir = targetDir + '/' + toolName
    fs.mkdirpSync(toolDir)
    const filePath = toolDir + '/' + new Date().toString().split(' ')[4] + '.txt'
    return filePath
}

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
type IEndCb = () => Promise<void>

interface IConnectedHost extends IHost {
    execute: (cmd: string, out?: boolean, cb?: IDataCb) => IExecReturn
    // connection: Client
}

const _exec = (cmd: string, h: IHost, out = true, dataCb?: IDataCb, stderrCb?: IDataCb, endCb?: IEndCb): IExecReturn => {
    const connection = new Client()
    return new Promise((resolve, _) => {
        connection.on('ready', () => {
            console.log(`connection to ${h.name}-${h.ip} opened`)
            connection.exec(cmd, (err, stream) => {
                const buffer: string[] = []

                if (err) throw err
                stream.on('close', (code: any, signal: any) => {
                    console.log(`connection to ${h.name}-${h.ip} closed`)
                    connection.end()
                    resolve({ result: out ? buffer : [], code, signal })
                })
                stream.on('data', (data: string) => {
                    // console.log(`data from ${h.name}-${h.ip} received`)
                    if (dataCb) {
                        dataCb(data)
                    }
                    if (out) {
                        buffer.push(data.toString())
                    }
                })
                .on('end', (code: number, signal: number) => {
                    console.log(`process on ${h.name}-${h.ip} exited with code ${code}`)
                    if (endCb) {
                        endCb()
                    }
                    return resolve({ result: out ? buffer : [], code, signal }) // todo: why code undefined?
                })
                .stderr.on('data', (data) => {
                    data = data.toString()
                    // console.log(`STDERR on ${h.name}-${h.ip}: ${data}`)
                    if (stderrCb) {
                        stderrCb(data)
                    }
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

const _tools = [
    'amass',
    'ffuf',
    'assetfinder',
    'subfinder',
    'nmap',
]

let connectedHosts: IConnectedHost[] = [];

(async _ => {
    const hosts = await HostModel.find({ active: true })

    connectedHosts = hosts.map((h: any) => {
        
        return {
            ...h._doc,
            execute:  (cmd: string, out = true, dataCb?: IDataCb, stderrCb?: IDataCb) => {
                return new Promise(async (resolve, _) => {
                    return resolve(await _exec(cmd, h, out, dataCb, stderrCb))
                })
            }
        }
    })

})()

app.get('/ping', async (_, res) => {
    console.log(connectedHosts)
    res.send('pong')
})

app.post('/full-dns-fuzz', async (req, res) => {
    const { targetUrl, hostName, protocol: _protocol } = req.body

    const host = connectedHosts.find(x => x.name === hostName)

    const target = await TargetModel.findOne({ url: targetUrl })

    const dnsTools = [
        ({ url, limit = 1000, t = 40 }) => {
            return `amass enum -passive -active -d ${url} -max-dns-queries ${limit}`
        },
        ({ url, limit = 1000, t = 40 }) => {
            return `subfinder -all -recursive -list SecLists/Discovery/DNS/subdomains-top1million-5000.txt -silent -t ${t} -rl ${limit} -d ${url}`
        },
        ({ url, limit = 1000, t = 40 }) => {
            return `assetfinder ${url}`
        },
    ]

    const resultPromises: Promise<any>[] = []

    const foundDomains: Set<string> = new Set()

    for (const tool of dnsTools) {
        const command = tool({
            url: targetUrl,
        })

        const toolName = command.split(' ')[0]

        const filePath = getFinalPath(toolName, targetUrl)

        const r = _exec(command, host, false, async (data) => {
            fs.writeFileSync(filePath, data, { flag: 'a+' })
            const domain = data.toString()
            console.log('domain found', toolName, domain)
            foundDomains.add(domain.replaceAll('\n', ''))
        }, async (data) => {
            data = data.toString()
            console.log('DATA STDERR', toolName, data.toString())
        }, async () => {
            target.scans.push(filePath)
            await target.save()
        })

        resultPromises.push(r)
    }

    await Promise.all(resultPromises)

    target.domains = [...foundDomains, ...target.domains]

    await target.save()

    res.json({ success: 1 })
})

app.post('/portscan', async (req, res) => {
    const {
        targetUrl,
        aFlag,
        svFlag,
        top100,
        hostName,
    } = req.body

    const cmd = ({
        aFlag = true,
        svFlag = true,
        top100 = true,
        T = 3,
    }) => `nmap ${aFlag ? '-A' : ''} ${svFlag ? '-sV' : ''} -T${T} ${top100 ? '-F' : ''} ${targetUrl}`

    const host = connectedHosts.find(x => x.name === hostName)
    
    const command = cmd({ aFlag, svFlag, top100 })

    const toolName = command.split(' ')[0]

    const filePath = getFinalPath(toolName, targetUrl)

    await _exec(command, host, false, async (data) => {
        fs.writeFileSync(filePath, data, { flag: 'a+' })
    })

    return res.json({ success: 1 })
})

app.post('/full-dir-fuzz', async (req, res) => {
    const { targetUrl, hostName, protocol: _protocol } = req.body

    const host = connectedHosts.find(x => x.name === hostName)

    const target = await TargetModel.findOne({ url: targetUrl })

    const createCmd = ({
        protocol = _protocol || 'https://',
        domain = '',
        url = '',
        // dir = '',
        // list = '~/SecLists/Discovery/Web-Content/common.txt',
        list = '~/SecLists/Discovery/Web-Content/common.txt',
        mc = '200,201,202,203,204,206,301',
        rate = 10000,
        t = 40,
        e = '/',
    }) => {
        if (domain.length) domain += '.'
        // if (dir.length) dir += '/'
        // console.log('WTF', protocol, domain, url)
        return `ffuf -u ${protocol}${domain}${url}/FUZZ -recursion -fr 'not found|404' -w ${list} -mc ${mc} -rate ${rate} -t ${t}`
    }

    const filePath = getFinalPath('ffuf', targetUrl)

    if (!target.domains.length) {
        target.domains.push('')
    }

    for (const _domain of target.domains) {

        const command = createCmd({
            url: targetUrl,
            domain: _domain,
        })

        await _exec(command, host, false, async (data) => {
            fs.writeFileSync(filePath, data, { flag: 'a+' })
        }, async (data) => {
            data = data.toString()
            console.log('DATA', data)
        })

    }

    target.scans.push(filePath)

    await target.save()

    res.json({ success: 1, filePath })
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
    const { 
        url,
        active,
        domains,
        headers,
        scans,
        dirTree,
    } = req.body

    const target = new Target({
        url,
        active: active || true,
        domains: domains || [],
        headers: headers || [],
        scans: scans || [],
        dirTree: dirTree || {},
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



/*                                      TRASH
 *
 *                              
         const results: any = []


         target.dirTree = tree
        results.push({ files: allFiles, dirs: allDirs, tree })

        const allDirs: any = {}
        const allFiles: string[] = []

        const tree: any = {}


 



                                                        const dataSt = data.toString()
                const dataEscaped = JSON.stringify(dataSt)
                console.log('DATA ESCAPED', dataEscaped)
                const dataCleaned = dataEscaped.split('* FUZZ: ').pop().replaceAll('\\n', '').replace('"', '')
                allHits.push(dataCleaned)

 

if (data.includes('[INFO]') && data.includes('Adding')) {
                    const dirPath = data.split(': ').pop().replaceAll('\n', '')
                    const dirArr = dirPath.split('/')
                    const dirName = dirArr[dirArr.length - 2]

                    allDirs[dirName] = dirPath.replace('http://', '').replace('https://', '').replace('/FUZZ', '')

                    if (allHits.includes(dirName)) {
                        let tempTree = tree
                        for (const el of dirArr) {
                            if (!el.length) {
                                continue
                            }
                            if (el.includes('FUZZ')) {
                                continue
                            }
                            if (el.includes('http')) {
                                continue
                            }
                            tempTree[el] = {}
                            tempTree = tempTree[el]
                        }
                    }

                }




   
            for (const hit of allHits) {
                if (!Object.keys(allDirs).includes(hit)) {
                    allFiles.push(hit)
                }
            }

            let i = 0
            console.log('FILES', allFiles)
            console.log('DIRS', allDirs)
            for (const file of allFiles) {
                const dirPath = (Object.values(allDirs).reverse()[i] as string).split('/')
                console.log('PATH', dirPath)
                let tempTree = tree
                let j = 0
                for (let el of dirPath) {
                    console.log('TREE', JSON.stringify(tree))
                    console.log('tree el', tree[el])
                    console.log('EL', el)
                    if (j === dirPath.length - 1) {
                        tempTree[el][file] = ''
                    }
                    if (tempTree.hasOwnProperty(el)) tempTree = tempTree[el]
                    j++
                }
                i++
            }



*/
