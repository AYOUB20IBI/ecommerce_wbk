
import { loginSchema } from './login.dto';

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'USER@example.com',
      password: 'MyPassword123!',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'Password123!',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects additional fields', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'Password123!',
      isAdmin: true,
    });

    expect(result.success).toBe(false);
  });
});
