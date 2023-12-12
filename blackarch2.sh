echo "SigLevel = Never" >> /etc/pacman.conf

yes | pacman --noprogressbar -Syuu

git clone https://github.com/danielmiessler/SecLists
git clone https://github.com/emadshanab/WordLists-20111129
git clone https://github.com/drtychai/wordlists
