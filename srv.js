const http = require('http')
const fs = require('fs')
const path = require('path')

const server = http.createServer((req, res) => {
    const requestPath = req.url
    const callerIp = req.connection.remoteAddress || req.socket.remoteAddress

    console.log(`PATH: ${requestPath}`)
    console.log('CALLER IP', callerIp)
    console.log('HEADERS', req.headers)

    if (requestPath === '/payload') {
        const filePath = path.join(__dirname, 'payload.py')

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, {'Content-Type': 'text/plain'})
                res.end('Error reading file')
                return
            }

            res.writeHead(200, {'Content-Type': 'text/x-python'})
            res.end(data)
        });
        return
    } else if (requestPath === '/callback') {
            console.log('CALL BACK')
    } else if (requestPath === '/redirect') {
        res.writeHead(302, {'Location': '/callback'})
        res.end()
        return
    }

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(`You requested: ${requestPath}`)
});

const PORT = 3000

server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
});
