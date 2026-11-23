import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type Recording = {
  method: string;
  path: string;
  status: number;
  contentType: string;
  body: unknown;
};

export type StoredRecording = Recording & { file: string; sequence: number };

const RECORDING_FILE = /^(?<key>.+)-(?<sequence>\d+)\.json$/;

const requestOf = ({ input, init }: { input: string | URL | Request; init?: RequestInit }) => {
  const url = input instanceof Request ? input.url : String(input);
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

  return { method: method.toUpperCase(), path: new URL(url).pathname };
};

export const recordingFileOf = ({
  method,
  path,
  sequence,
}: {
  method: string;
  path: string;
  sequence: number;
}) =>
  `${method.toLowerCase()}-${path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-')}-${sequence}.json`;

export const createReplayFetch = ({ directory }: { directory: string }): typeof fetch => {
  const served = new Map<string, number>();

  return async (input, init) => {
    const { method, path } = requestOf({ input, init });
    const key = `${method} ${path}`;
    const sequence = served.get(key) ?? 0;
    const file = join(directory, recordingFileOf({ method, path, sequence }));

    if (!existsSync(file)) {
      throw new Error(`No recording for ${method} ${path} (#${sequence})`);
    }

    const recording = JSON.parse(await readFile(file, 'utf8')) as Recording;

    if (recording.method !== method || recording.path !== path) {
      throw new Error(`No recording for ${method} ${path}: ${file} is ${recording.path}`);
    }

    served.set(key, sequence + 1);
    const body =
      typeof recording.body === 'string' ? recording.body : JSON.stringify(recording.body);

    return new Response(body, {
      status: recording.status,
      headers: { 'content-type': recording.contentType },
    });
  };
};

export const readRecordings = async ({
  directory,
}: {
  directory: string;
}): Promise<StoredRecording[]> => {
  const files = (await readdir(directory)).filter((file) => RECORDING_FILE.test(file));
  const recordings = await Promise.all(
    files.map(async (file) => ({
      ...(JSON.parse(await readFile(join(directory, file), 'utf8')) as Recording),
      file,
      sequence: Number(RECORDING_FILE.exec(file)?.groups?.sequence),
    })),
  );

  return recordings.sort((left, right) => left.sequence - right.sequence);
};
