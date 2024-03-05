import { existsSync } from 'fs';
import { promisify } from 'util';
import { program } from 'commander';
import { fileURLToPath } from 'url';
import { coerce, satisfies } from 'semver';
import { mkdir, readFile, rm } from 'fs/promises';
import { basename, dirname, resolve } from 'path';
import { exec as rawExec, spawn } from 'child_process';

export type ExecuteOptions = {
  cwd?: string;
  command: string;
  args?: string[];
};

export type GitExecuteOptions = {
  cwd: string;
  args?: string[];
};

export type ExecuteResults = [string, string];

const exec = promisify(rawExec);

const createAppender = (array: string[]) => (chunk: string) =>
  array.push(chunk);

const getInstallDirectory = (): string =>
  dirname(fileURLToPath(import.meta.url));

const getPackageJsonPath = (): string =>
  resolve(getInstallDirectory(), '..', 'package.json');

const isGitInstallValid = async (): Promise<boolean> => {
  try {
    const [version] = await executeCommand({
      command: "git -v | cut -d' ' -f3"
    });

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
  options: ExecuteOptions
): Promise<ExecuteResults> => {
  const { args, command, cwd } = options;
  const { stdout, stderr } = await exec(
    `${command} ${args?.join(' ') ?? ''}`.trim().replace(/\\n$/, ''),
    {
      cwd: cwd ?? './'
    }
  );

  return [stdout, stderr];
};

const executeGitCommand = (
  options: GitExecuteOptions
): Promise<ExecuteResults> =>
  new Promise(
    (
      resolve: (value: ExecuteResults) => void,
      reject: (reason?: string | Error) => void
    ) => {
      const { cwd, args } = options;
      const [stdout, stderr] = [[], []];
      const process = spawn('git', args ?? [], { cwd });

      process.stdout.setEncoding('utf-8');
      process.stderr.setEncoding('utf-8');
      process.stdout.on('data', createAppender(stdout));
      process.stderr.on('data', createAppender(stderr));

      process.on('error', () =>
        reject(`Error occurred during execution:\n\n${stderr.join('\n')}`)
      );
      process.on('close', (code: number) => {
        if (code !== 0) {
          reject(`Exited with code ${code}\n\n${stderr.join('\n')}`);
        } else {
          resolve([stdout.join('\n'), stderr.join('\n')]);
        }
      });
    }
  );

export const getPackageVersion = async (): Promise<string> =>
  JSON.parse(await readFile(getPackageJsonPath(), 'utf-8'))?.version;

export async function cloneSparse(
  cwd: string,
  repoUrl: string,
  paths: string[]
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
    const { globs, force } = program.opts();
    if (force) {
      console.log('Removing existing working copy...');
      await rm(workingCopyDir, {
        force: true,
        recursive: true
      });
    } else if (existsSync(cwd)) {
      throw new Error(`${cwd} already exists, refusing to overwrite it!`);
    }

    console.log('Pre-flight checks passed, cloning repo...');
    paths = paths.map((path) => path.replace(/"/g, '').replace(/^\./, ''));
    await executeGitCommand({
      cwd: workingCopyParent,
      args: [
        'clone',
        '-n',
        '--depth',
        '1',
        '--filter=tree:0',
        repoUrl,
        workingCopyDir
      ]
    });
    console.log('Adding desired paths to sparse-checkout...');
    if (!globs) {
      await executeGitCommand({
        cwd,
        args: ['sparse-checkout', 'set', '--no-cone', ...paths]
      });
    } else {
      await executeGitCommand({
        cwd,
        args: ['sparse-checkout', 'init']
      });
      await executeCommand({
        cwd,
        command: `echo !/* > .git/info/sparse-checkout`
      });
      for (const path of paths) {
        await executeCommand({
          cwd,
          command: `echo ${path} >> .git/info/sparse-checkout`
        });
      }
    }
    console.log('Performing final checkout...');
    await executeGitCommand({
      cwd,
      args: ['checkout']
    });
    console.log('Complete!');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
