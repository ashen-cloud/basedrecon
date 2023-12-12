#!/usr/bin/python3

import requests
import sys
import os

hostName = 'arch'
hostIp = os.environ['LINODE_HOST']
hostUser = os.environ['LINODE_USER']
hostPassword = os.environ['LINODE_PASSWORD']

proto = 'http://'
host = proto + '127.0.0.1'
port = 4999

name = sys.argv[1] if len(sys.argv) > 1 else 'ping'

r = {
    'ping': lambda: requests.get(f'{host}:{port}/ping').text,
    'addhost': lambda: requests.post(f'{host}:{port}/host', json={
                                         'ip': hostIp,
                                         'name': hostName,
                                         'password': hostPassword,
                                         'user': hostUser,
                                         'active': True,
                                     }).json()
}


def call(n):
    try:
        print(r[n]())
    except requests.exceptions.ConnectionError:
        print('SERVER NOT STARTED')


call(name)
