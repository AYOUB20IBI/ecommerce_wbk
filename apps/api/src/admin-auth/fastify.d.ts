
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
}
