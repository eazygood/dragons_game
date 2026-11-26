import fp from 'fastify-plugin';

// A cross-site <form enctype="text/plain"> reaches a POST route without a preflight,
// so JSON, which does need one, is the only body type left. A bodiless cross-site POST
// skips this check; the cross-site guard plugin refuses it.
export const jsonOnlyBodiesPlugin = fp((app) => {
  app.removeContentTypeParser('text/plain');

  return Promise.resolve();
});
