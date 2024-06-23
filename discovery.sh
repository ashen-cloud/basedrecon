#!/usr/bin/bash

binaries=("dnsx", "httpx", "jq", "tew", "gospider", "puredns", "nmap")

echo "Starting scan:"

mkdir -p "./scans"

HOST=$1
DIR="./$HOST"

# Create directory for the host
mkdir -p "./scans/$DIR"

# find subdomains
echo $HOST | subfinder | anew "$DIR/subs.txt" | wc -l
shuffledns -d $HOST -mode bruteforce -w "/home/c0/SecLists/Discovery/DNS/bug-bounty-program-subdomains-trickest-inventory.txt" -r "/home/c0/resolvers.txt" | anew "$DIR/subs.txt" | wc -l

# resolve discovered ones
puredns resolve "$DIR/subs.txt" -r "/home/c0/resolvers.txt" -w "$DIR/resolved.txt" | wc -l
dnsx -l "$DIR/resolved.txt" -json -o "$DIR/dns.json" | jq -r '.a?[]?' | anew "$DIR/ips.txt" | wc -l

# ports and servers
nmap -T4 -vv -iL "$DIR/ips.txt" --top-ports 3000 -n --open -oX "$DIR/nmap.xml"
tew -x "$DIR/nmap.xml" -dnsx "$DIR/dns.json" --vhost -o "$DIR/hostport.txt" | httpx -sr -srd "$DIR/responses" -json -o "$DIR/http.json"

cat "$DIR/http.json" | jq -r '.url' | sed -e 's/:80$//g' -e 's/:443$//g' | sort -u > "$DIR/http.txt"

# crawling
gospider -S "$DIR/http.txt" --json | grep "{" | jq -r '.output?' | tee "$DIR/crawl.txt"

# js
cat "$DIR/crawl.txt" | grep "\.js" | httpx -sr -srd "$DIR/js"