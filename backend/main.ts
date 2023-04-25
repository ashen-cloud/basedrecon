import mongoose from 'mongoose'
import express, { Request, Response, NextFunction } from 'express'
import { connectDb, Host } from './db'

const app = express()

const PORT = process.env.PORT || 8600

connectDb().then(db => {

    app.get('/ping', async (req, res) => {
        res.send('pong')
    })

    app.post('/host', async (req, res) => {
        const { ip, name, password } = req.body
        let { user } = req.body

        if (!user) {
            user = 'root'
        }

        const host: Host = new Host({
            ip, name, password, user
        })

        await user.save()

        res.send(user)
    })

    app.listen(PORT, () => {
      console.log('started server on port', PORT)
    })
})
