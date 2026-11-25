import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

// The built web app loads only its own hashed script and stylesheet, so nothing inline is allowed.
// Two directives depart from helmet's defaults, both because the app is served over plain http
// and TLS ends elsewhere: no HSTS, and no upgrade-insecure-requests.
export const securityHeadersPlugin = fp(async (app) => {
  await app.register(helmet, {
    strictTransportSecurity: false,
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
});
