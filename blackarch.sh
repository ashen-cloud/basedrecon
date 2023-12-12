yes | pacman --noprogressbar -Syuu
curl -O https://blackarch.org/strap.sh
chmod +x strap.sh
./strap.sh # assumes we're root

yes | pacman --noprogressbar -Syuu
yes | pacman --noprogressbar -S git wget

git clone https://github.com/danielmiessler/SecLists
git clone https://github.com/emadshanab/WordLists-20111129
git clone https://github.com/drtychai/wordlists
