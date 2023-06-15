# keeb.dev

Powers https://keeb.dev

# Creating a new post

Creating a new post requires an image built from the Dockerfile with the `--target` of new saved as `keeb/hexo-new-base`

Generate this by running

`docker build -t keeb/hexo-new-base --target new .`

in the root directory.

Once this is done, generate a new post by executing the `new.sh` script.

From the root directory

`./scripts/new.sh POST NAME FOREVER..`



# local preview
To preview any chages

`docker-compose --profile serve up`


# 
