---
title: NVIDIA on Docker
date: 2023-06-15 17:36:24
tags: llm, stable diffusion, arch, docker
---


Assumptions:

* Updated Arch Linux
* NVIDIA Hardware
* Docker installed
* git for AUR

AUR URLS
* [nvidia-container-toolkit](https://aur.archlinux.org/packages/nvidia-container-toolkit)
* [libnvidia-container-tools](https://aur.archlinux.org/packages/libnvidia-container-tools)


Steps

Install each of the AUR's as you would normally, that is

* `git clone` the appropriate URL provided on the page
* `makepkg` in the directory containing the `PKGBUILD`
* Once the package is made `pacman -U <package_name>`


Test

There's 2 ways to ensure this is running correctly. Run `docker run --gpus all -it busybox /bin/sh`

If there are no errors, congrats, GPU's are now available within your containers

## Bonus - Run Stable Diffusion

Follow the instructions [here](https://github.com/AbdBarho/stable-diffusion-webui-docker/wiki/Setup)

