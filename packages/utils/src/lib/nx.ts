import { context } from '@actions/github';
import { Exec } from './exec';
import * as which from 'which';
import { debug } from '@actions/core';

export interface BaseInputs {
  maxParallel: number;
  nxCloud?: boolean;
  args?: string[];
}

export async function nxCommand(
  command: string,
  target: string,
  exec: Exec,
  args: string[]
): Promise<string> {
  const binPath = 'node_modules/.bin/nx';

  try {
    debug(`🐞 Checking existence of nx`);
    await which(binPath);
  } catch {
    throw new Error("Couldn't find Nx binary, Have you run npm/yarn install?");
  }

  const wrapper = exec
    .withCommand(`${binPath} ${command}`)
    .withArgs(`--target=${target}`, ...args)
    .build();

  return wrapper();
}

export async function nxPrintAffected(
  target: string,
  exec: Exec
): Promise<string[]> {
  const projects = (
    await nxCommand('print-affected', target, exec, [
      '--select=tasks.target.project',
    ])
  ).trim();

  debug(`🐞 Affected project for ${target}: ${projects}`);

  return projects.split(', ');
}

export async function nxRunMany(
  target: string,
  inputs: BaseInputs,
  exec: Exec
): Promise<string> {
  const args = inputs.args ?? [];

  if (inputs.nxCloud) {
    args.push('--scan');
    const env: Record<string, string> = {};
    env.NX_RUN_GROUP = context.runId.toString();

    if (context.eventName === 'pull_request') {
      env.NX_BRANCH = context.payload.pull_request.number.toString();
    }

    exec.withOptions({ env });
  }

  args.push('--parallel', `--maxParallel=${inputs.maxParallel}`);

  return nxCommand('run-many', target, exec, args);
}
