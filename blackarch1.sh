yes | pacman --noprogressbar -Syuu
yes | pacman --noprogressbar -S git wget

curl -O https://blackarch.org/strap.sh
chmod +x strap.sh
./strap.sh # assumes we're root
