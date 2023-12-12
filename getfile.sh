#!/usr/bin/bash

HOSTS_PATH="hosts"

REMOTE_FILE_PATH="${1}"
LOCAL_DIR="out"

# Ensure the local directory exists
mkdir -p "$LOCAL_DIR"

while IFS=' ' read -r USER IP PASSWORD
do
  if [[ -z "$PASSWORD" ]]; then
    echo "copying file from $IP as $USER using private key"
    echo
    /usr/bin/scp "$USER@$IP:$REMOTE_FILE_PATH" "$LOCAL_DIR/"
  else
    echo "copying file from $IP as $USER using password"
    echo
    /usr/bin/sshpass -p "$PASSWORD" /usr/bin/scp -o StrictHostKeyChecking=no "$USER@$IP:$REMOTE_FILE_PATH" "$LOCAL_DIR/"
  fi
done < "$HOSTS_PATH"
