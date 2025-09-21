# keeb.dev

Powers https://keeb.dev

# Creating a new post

Build the Docker image:

`docker build -t keeb/keeb.dev .`

Generate a new post by executing the `new.sh` script.

From the root directory

`./scripts/new.sh POST NAME FOREVER..`



# local preview
To preview any chages

`docker-compose --profile serve up`


# deployment

Run ./scripts/deploy.sh

