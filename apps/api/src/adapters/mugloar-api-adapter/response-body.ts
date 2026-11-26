const BYTES_PER_KIB = 1024;
const MAX_RESPONSE_KIB = 256;
// The largest real response is a few KiB; the cap only stops a misbehaving host filling memory.
export const MAX_RESPONSE_BYTES = MAX_RESPONSE_KIB * BYTES_PER_KIB;

// An unread body keeps its connection busy, so a response we stop caring about is cancelled.
export const discardBody = async ({ response }: { response: Response }): Promise<void> => {
  await response.body?.cancel().catch(() => undefined);
};

// content-length is only a claim, so the stream is counted too; a throw while iterating
// cancels the rest of the body.
export const readBoundedText = async ({ response }: { response: Response }): Promise<string> => {
  const declaredBytes = Number(response.headers.get('content-length'));

  if (declaredBytes > MAX_RESPONSE_BYTES) {
    await discardBody({ response });
    throw new Error(
      `Response declares ${declaredBytes} bytes, over the ${MAX_RESPONSE_BYTES} limit`,
    );
  }

  if (response.body === null) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  for await (const chunk of response.body) {
    receivedBytes += chunk.byteLength;

    if (receivedBytes > MAX_RESPONSE_BYTES) {
      throw new Error(`Response body passed the ${MAX_RESPONSE_BYTES} byte limit`);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
};
