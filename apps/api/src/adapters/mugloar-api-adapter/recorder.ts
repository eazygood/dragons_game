import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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
const JSON_INDENT = 2;

const requestOf = ({ input, init }: { input: string | URL | Request; init?: RequestInit }) => {
  const url = input instanceof Request ? input.url : String(input);
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

  return { method: method.toUpperCase(), path: new URL(url).pathname };
};

const keyOf = ({ method, path }: { method: string; path: string }) =>
  `${method.toLowerCase()}-${path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-')}`;

const fileOf = ({ key, sequence }: { key: string; sequence: number }) => `${key}-${sequence}.json`;

// Store JSON as JSON so fixtures stay readable; anything else, including a
// JSON content type with an unparseable body, is kept as the raw text.
const bodyOf = ({ text, contentType }: { text: string; contentType: string }): unknown => {
  if (!contentType.includes('json')) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const createRecordingFetch = ({
  fetchImpl,
  directory,
}: {
  fetchImpl: typeof fetch;
  directory: string;
}): typeof fetch => {
  const nextSequence = new Map<string, number>();

  const claimFile = ({ key }: { key: string }) => {
    let sequence = nextSequence.get(key) ?? 0;

    while (existsSync(join(directory, fileOf({ key, sequence })))) {
      sequence += 1;
    }

    nextSequence.set(key, sequence + 1);

    return fileOf({ key, sequence });
  };

  return async (input, init) => {
    const { method, path } = requestOf({ input, init });
    const response = await fetchImpl(input, init);
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    const recording: Recording = {
      method,
      path,
      status: response.status,
      contentType,
      body: bodyOf({ text, contentType }),
    };

    await writeFile(
      join(directory, claimFile({ key: keyOf({ method, path }) })),
      `${JSON.stringify(recording, null, JSON_INDENT)}\n`,
    );

    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: { 'content-type': contentType },
    });
  };
};

export const createReplayFetch = ({ directory }: { directory: string }): typeof fetch => {
  const served = new Map<string, number>();

  return async (input, init) => {
    const { method, path } = requestOf({ input, init });
    const key = keyOf({ method, path });
    const sequence = served.get(key) ?? 0;
    const file = join(directory, fileOf({ key, sequence }));

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
