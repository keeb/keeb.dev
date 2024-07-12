---
title: Hexo & VSCode
date: 2022-05-28 11:02:29
tags: meta, hexo, dev
---

## Quickstart: Installation, Editing, and Deployment
[Hexo](https://github.com/hexojs/hexo) is the static site generator used to generate this blog, along with a modified version of the [cactus](https://github.com/probberechts/hexo-theme-cactus) theme.

What I like about hexo is that it's easy to install `npm install hexo-cli -g` (as root) and setup `hexo init blog` and start a server `hexo server` and create new posts `hexo new "Post"`.

Themes are just a simple, drop them into the themes directory, update the `_config.yml` to point to the correct theme, and you're off and running.

When you're done editing your auto generated `Post.md` in the `source/_posts` directory, you can `hexo generate` to build it all together into static HTML which exists in the `public` folder.

Copy the contents of the `public` folder to your favorite static site hoster, and viola, your website is ready to serve traffic.

## VSCode Remote editing
After more than 25 years using `vim` and carrying around my lightly modified `.vimrc` everywhere, I am starting to explore using IDE's. For this project, I have been using [VSCode](https://code.visualstudio.com/) because I appreciate the live preview of Markdown as I type and it's much better than SublimeText.

One habit that hasn't shaken, however, is that I really like to develop on Linux and I prefer to develop remotely. This allows me to work from any internet-connected device, seamlessly, without having to copy files or worry about committing changes in progress or really have to think about things at all. My code is just one `ssh` command away.

VSCode takes this a step further and can effectively mount remote filesystems and load source code as if it is local, seamlessly. You can follow [this guide](https://code.visualstudio.com/docs/remote/ssh) to learn how to set it up.

## Running Hexo in VSCode
The only non-trivial part of this setup is that the default launch experience in VSCode doesn't work with Hexo. This is because it is expecting to run `node` on a javascript file somewhere, but no such javascript exists. 

This is remedied by clicking on `Run -> Add Configration` or `Run -> Open Configuration` in the menubar, which will open your local `launch.json` 

Assuming you are using the latest version of hexo and installed it according to the above, the following `launch.json` will launch a `hexo server` instance so you can preview changes as you are making them

```json
{
    "version": "0.2.0",
    "configurations": [
        
        {
            "type": "node",
            "request": "launch",
            "name": "launch hexo server",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "program": "${workspaceFolder}/node_modules/hexo/bin/hexo",
            "args": [
                "server"
            ]
        }
    ]
} 
```

Adding another configuration task to run `build` your static site is similarly straghtforward, adding another configuration block like so

```json
{
    "type": "node",
    "name": "hexo generate",
    "request": "launch",
    "skipFiles": [
        "<node_internals>/**"
    ],
    "program": "${workspaceFolder}/node_modules/hexo/bin/hexo",
    "args": [
        "generate"
    ]
}
```

The final full file then looks like this

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "launch hexo server",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "program": "${workspaceFolder}/node_modules/hexo/bin/hexo",
            "args": [
                "server"
            ]
        },
        {
            "type": "node",
            "name": "hexo generate",
            "request": "launch",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "program": "${workspaceFolder}/node_modules/hexo/bin/hexo",
            "args": [
                "generate"
            ]
        }
    ]
}
```