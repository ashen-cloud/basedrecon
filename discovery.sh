#!/usr/bin/bash

binaries=("dnsx", "httpx", "jq", "tew", "gospider", "puredns", "nmap")

echo "Starting scan:"

HOST=$1

# find subdomains
echo $HOST | subfinder | anew subs.txt | wc -l
shuffledns -d $HOST -mode bruteforce -w "/home/c0/SecLists/Discovery/DNS/bug-bounty-program-subdomains-trickest-inventory.txt" -r "/home/c0/resolvers.txt" | anew subs.txt | wc -l

# resolve discovered ones
puredns resolve "./subs.txt" -r "/home/c0/resolvers.txt" -w "./resolved.txt" | wc -l
dnsx -l "./resolved.txt" -json -o "./dns.json" | jq -r '.a?[]?' | anew "./ips.txt" | wc -l

# ports and servers
nmap -T4 -vv -iL "./ips.txt" --top-ports 3000 -n --open -oX "./nmap.xml"
tew -x "./nmap.xml" -dnsx "./dns.json" --vhost -o "./hostport.txt" | httpx -sr -srd "./responses" -json -o "./http.json"

cat "./http.json" | jq -r '.url' | sed -e 's/:80$//g' -e 's/:443$//g' | sort -u > "./http.txt"

# crawling
gospider -S "./http.txt" --json | grep "{" | jq -r '.output?' | tee "./crawl.txt"

# js
cat "./crawl.txt" | grep "\.js" | httpx -sr -srd js
