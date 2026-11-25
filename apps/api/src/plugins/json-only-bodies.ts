import fp from 'fastify-plugin';

// A cross-site <form enctype="text/plain"> reaches a POST route without a preflight,
// so JSON, which does need one, is the only body type left. A bodiless cross-site
// POST still passes; the rate limit and bot cap bound that.
export const jsonOnlyBodiesPlugin = fp((app) => {
  app.removeContentTypeParser('text/plain');

  return Promise.resolve();
});
