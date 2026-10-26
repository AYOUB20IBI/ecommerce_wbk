
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const parsed = schema.safeParse(input);

  if (parsed.success) return parsed.data;

  const errors: Record<string, string[]> = {};

  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || 'body';
    (errors[key] ??= []).push(issue.message);
  }

  throw new BadRequestException({
    success: false,
    message: 'Les données fournies sont invalides.',
    errors,
  });
}
