import type { FastifySchemaCompiler, FastifySchemaValidationError } from 'fastify';
import type { z } from 'zod';

const toValidationError = (issue: z.core.$ZodIssue): FastifySchemaValidationError => ({
  keyword: issue.code,
  instancePath: `/${issue.path.join('/')}`,
  schemaPath: '',
  params: {},
  message: issue.message,
});

// Stands in for fastify-type-provider-zod, which hard-requires @fastify/swagger.
// Issues, not the ZodError itself: only an issue list makes Fastify set `error.validation`.
export const zodValidatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);

    if (result.success) {
      return { value: result.data };
    }

    return { error: result.error.issues.map(toValidationError) };
  };
