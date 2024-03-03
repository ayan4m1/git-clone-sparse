import { program } from 'commander';

import { cloneSparse, getPackageVersion } from './utils.js';

const version = await getPackageVersion();

program
  .version(version)
  .description('Performs a "sparse" (i.e. partial) clone of a Git repository.')
  .argument('<working-copy>', 'Local Git working copy location')
  .argument('<repo-url>', 'Git repository clone URL')
  .argument('<paths...>', 'One or more paths to check out')
  .option('-f, --force', 'Forces overwriting existing working copy')
  .option('-g, --globs', 'Allow use of glob patterns in <paths...> argument')
  .action(cloneSparse)
  .parse();
