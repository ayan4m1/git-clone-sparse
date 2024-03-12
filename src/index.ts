import { program } from 'commander';

import { cloneSparse, getPackageVersion } from './utils.js';

try {
  const description =
    'Performs a "sparse" (i.e. partial) clone of a Git repository.';
  const version = await getPackageVersion();
  const handler = (cwd: string, repoUrl: string, paths: string[]) => {
    const { globs, force } = program.opts();

    cloneSparse(cwd, repoUrl, paths, {
      force,
      globs
    });
  };

  await program
    .version(version)
    .description(description)
    .argument('<working-copy>', 'Local Git working copy location')
    .argument('<repo-url>', 'Git repository clone URL')
    .argument('<paths...>', 'One or more paths to include in checkout')
    .option('-f, --force', 'Force overwriting existing working copy')
    .option('-g, --globs', 'Allow use of glob patterns in <paths...> argument')
    .action(handler)
    .parseAsync();
} catch (error) {
  console.error(error);
  process.exit(1);
}

export default cloneSparse;
