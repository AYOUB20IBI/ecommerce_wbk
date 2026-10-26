
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class CsrfService {
  private getSecret(): string {
    const secret = process.env.CSRF_SECRET;

    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
      throw new InternalServerErrorException(
        'CSRF configuration unavailable',
      );
    }

    return secret;
  }

  generate(
    sessionToken: string,
    scope: 'admin' | 'customer',
  ): string {
    return createHmac('sha256', this.getSecret())
      .update(`csrf:v1:${scope}:${sessionToken}`)
      .digest('hex');
  }

  verify(
    sessionToken: string,
    scope: 'admin' | 'customer',
    suppliedToken: string,
  ): boolean {
    if (!/^[a-f0-9]{64}$/i.test(suppliedToken)) {
      return false;
    }

    const expected = Buffer.from(
      this.generate(sessionToken, scope),
      'hex',
    );

    const received = Buffer.from(suppliedToken, 'hex');

    return timingSafeEqual(expected, received);
  }
}
