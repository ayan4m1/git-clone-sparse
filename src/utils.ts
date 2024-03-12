import { existsSync } from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { coerce, satisfies } from 'semver';
import { mkdir, readFile, rm } from 'fs/promises';
import { basename, dirname, resolve } from 'path';
import { exec as rawExec, spawn } from 'child_process';

export type ExecuteResults = [string, string];

export type CloneSparseOptions = {
  globs: boolean;
  force: boolean;
};

const exec = promisify(rawExec);

const getInstallDirectory = (): string =>
  dirname(fileURLToPath(import.meta.url));

const getPackageJsonPath = (): string =>
  resolve(getInstallDirectory(), '..', 'package.json');

const isGitInstallValid = async (): Promise<boolean> => {
  try {
    const [version] = await executeCommand("git -v | cut -d' ' -f3");

    const gitVersion = coerce(version);
    if (!gitVersion) {
      return false;
    }

    return satisfies(gitVersion, '>=2.25.0');
  } catch {
    return false;
  }
};

const executeCommand = async (
  command: string,
  cwd: string = './',
  args: string[] = []
): Promise<ExecuteResults> => {
  const { stdout, stderr } = await exec(
    `${command} ${args.join(' ')}`.trim().replace(/\\n$/, ''),
    { cwd }
  );

  return [stdout, stderr];
};

const executeGitCommand = (cwd: string, args: string[] = []): Promise<void> =>
  new Promise(
    (resolve: () => void, reject: (reason?: string | Error) => void) => {
      const stderr = [];
      const process = spawn('git', args, { cwd, stdio: [0, 0, 'pipe'] });

      process.stderr.setEncoding('utf-8');
      process.stderr.on('data', (chunk) => stderr.push(chunk));
      process.on('error', () => reject(`Error occurred during execution!`));
      process.on('close', (code: number) =>
        code === 0
          ? resolve()
          : reject(`Exited with code ${code}. Details:\n\n${stderr.join('')}`)
      );
    }
  );

export const getPackageVersion = async (): Promise<string> =>
  JSON.parse(await readFile(getPackageJsonPath(), 'utf-8'))?.version;

export async function cloneSparse(
  cwd: string,
  repoUrl: string,
  paths: string[],
  opts?: CloneSparseOptions
): Promise<void> {
  try {
    if (!repoUrl || !cwd || !paths.length) {
      throw new Error('Invalid arguments supplied!');
    }

    if (!isGitInstallValid()) {
      throw new Error('Git >= 2.25.0 was not found!');
    }

    if (repoUrl.indexOf('://') === 1) {
      const protocol = repoUrl.includes('@') ? 'ssh' : 'https';

      repoUrl = `git+${protocol}://${repoUrl}`;
    }

    const workingCopyParent = basename(dirname(cwd));
    if (!existsSync(workingCopyParent)) {
      console.log(`Creating ${workingCopyParent} to contain repo...`);
      await mkdir(workingCopyParent, {
        recursive: true
      });
    }

    const workingCopyDir = basename(cwd);
    const { globs, force } = opts;
    if (existsSync(cwd) && force) {
      console.log('Removing existing working copy...');
      await rm(workingCopyDir, {
        force: true,
        recursive: true
      });
    } else if (!force) {
      throw new Error(`${cwd} already exists, refusing to overwrite it!`);
    }

    console.log('Pre-flight checks passed, performing bare clone...');
    await executeGitCommand(workingCopyParent, [
      'clone',
      '-n',
      '--depth',
      '1',
      '--filter=tree:0',
      repoUrl,
      workingCopyDir
    ]);
    console.log('Adding desired paths to sparse-checkout...');
    paths = paths.map((path) => path.replace(/"/g, '').replace(/^\./, ''));
    if (!globs) {
      await executeGitCommand(cwd, [
        'sparse-checkout',
        'set',
        '--no-cone',
        ...paths
      ]);
    } else {
      await executeGitCommand(cwd, ['sparse-checkout', 'init']);
      await executeCommand(`echo !/* > .git/info/sparse-checkout`, cwd);
      for (const path of paths) {
        await executeCommand(`echo ${path} >> .git/info/sparse-checkout`, cwd);
      }
    }
    console.log('Performing final checkout...');
    // todo: add progress bar
    await executeGitCommand(cwd, ['checkout']);
    console.log('Complete!');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
