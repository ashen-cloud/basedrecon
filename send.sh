#!/usr/bin/bash

HOSTS_PATH="hosts"

PATH="${1:-testscript.sh}"

while IFS=' ' read -r USER IP PASSWORD
do
  if [[ -z "$PASSWORD" ]] then
    echo "connecting to $IP as $USER with privatekey"
    echo
    /usr/bin/ssh $USER@$IP 'bash -s' < $PATH
  else
    echo "connecting to $IP as $USER with password"
    echo
    /usr/bin/sshpass -p "$PASSWORD" /usr/bin/ssh -o StrictHostKeyChecking=no "$USER@$IP" 'bash -s' < "$PATH"
  fi
done < "$HOSTS_PATH"
