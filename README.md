# git-clone-sparse

[![npm version](https://badge.fury.io/js/@ayan4m1%2Fgit-clone-sparse.svg)](https://badge.fury.io/js/@ayan4m1%2Fgit-clone-sparse)

## features

- Written in TypeScript
- Small footprint
- Saves time when cloning large repos

## requirements

- Node 18+

## installation

> npm i -g @ayan4m1/git-clone-sparse

## usage

> git-clone-sparse ./local-dir https://github.com/user/repo ./path1/ ./path2/

OR

> git-clone-sparse -g ./local-dir https://github.com/user/repo "\*\*/\*.safetensors"

Each command creates a directory called `local-dir` in your current working directory and then clones the specified URL. If you use **glob mode**, pass the `-g` flag. If you want to use a list of directories instead, do not use the `-g` flag.

## api

```ts
import cloneSparse from '@ayan4m1/git-clone-sparse';

...

// todo: handle program.opts() call
await cloneSparse(
  './new-repo-dir', // working copy directory
  'https://github.com/ayan4m1/git-clone-sparse' // repo URL
  ['./README.md'] // paths to include
);
```
