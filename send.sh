#!/usr/bin/bash

HOSTS_PATH="hosts"

# PATH="${1:-testscript.sh}"

printf -v TERM_Q '%q' xterm

for SCRIPT in "$@"
do
  while IFS=' ' read -r USER IP PASSWORD
  do
    if [[ -z "$PASSWORD" ]] then
      echo "connecting to $IP as $USER with privatekey"
      echo
      /usr/bin/ssh $USER@$IP "TERM=$TERM_Q bash -s" < $SCRIPT
    else
      echo "connecting to $IP as $USER with password"
      echo
      /usr/bin/sshpass -p "$PASSWORD" /usr/bin/ssh -o StrictHostKeyChecking=no "$USER@$IP" 'bash -s' < $SCRIPT
    fi
  done < "$HOSTS_PATH"

done

