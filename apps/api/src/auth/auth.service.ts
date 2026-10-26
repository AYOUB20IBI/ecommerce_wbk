
import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE } from '../database/database.provider';
import { customers } from '../database/schema/customer.schema';
import { RegisterDto } from './dto/register.dto';


import { UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { LoginDto } from './dto/login.dto';


type Database = ReturnType<typeof drizzle>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  
  private dummyHashPromise = argon2.hash(
    'dummy-password-never-used-for-login',
    {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    },
  );


  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    const [customer] = await this.db
      .insert(customers)
      .values({
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .onConflictDoNothing({ target: customers.email })
      .returning({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
      });

    
    if (!customer) {
      throw new ConflictException({
        success: false,
        message: 'Cette adresse e-mail est déjà utilisée.',
        errors: {
          email: [
            'Cette adresse e-mail est déjà utilisée.',
          ],
        },
      });
    }


    return {
      ...customer,
      emailVerified: false,
    };
  }

  
  async validateCustomerCredentials(input: LoginDto) {
    const email = input.email.trim().toLowerCase();

    const [customer] = await this.db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        passwordHash: customers.passwordHash,
        isActive: customers.isActive,
        emailVerifiedAt: customers.emailVerifiedAt,
      })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    const invalidCredentials = new UnauthorizedException(
      'Email ou mot de passe incorrect.',
    );

    // Dummy verification to reduce timing differences
    // when an account does not exist.

    
    const hash = customer?.passwordHash ?? await this.dummyHashPromise;


    const passwordValid = await argon2
      .verify(hash, input.password)
      .catch(() => false);

    if (
      !customer ||
      !passwordValid ||
      !customer.isActive
    ) {
      throw invalidCredentials;
    }

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      emailVerified: customer.emailVerifiedAt !== null,
    };
  }

}



