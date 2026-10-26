
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    customer?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
}
