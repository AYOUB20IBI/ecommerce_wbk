import { vi } from 'vitest';

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';
import { RbacService } from '../rbac.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  const reflector = {
    getAllAndOverride: vi.fn(),
  };

  const rbac = {
    hasAllPermissions: vi.fn(),
  };

  function createContext(
    adminId?: string,
  ): ExecutionContext {
    const request = {
      admin: adminId
        ? { id: adminId }
        : undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      rbac as unknown as RbacService,
    );
  });

  it('rejects unauthenticated requests', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      'roles.manage',
    ]);

    await expect(
      guard.canActivate(createContext()),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(
      rbac.hasAllPermissions,
    ).not.toHaveBeenCalled();
  });

  it('rejects a route without permission metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(
      undefined,
    );

    await expect(
      guard.canActivate(createContext('admin-1')),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      rbac.hasAllPermissions,
    ).not.toHaveBeenCalled();
  });

  it('rejects an empty permission policy', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(
      guard.canActivate(createContext('admin-1')),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an admin without the required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      'roles.manage',
    ]);

    rbac.hasAllPermissions.mockResolvedValue(false);

    await expect(
      guard.canActivate(createContext('admin-1')),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      rbac.hasAllPermissions,
    ).toHaveBeenCalledWith(
      'admin-1',
      ['roles.manage'],
    );
  });

  it('allows an admin with the required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      'roles.manage',
    ]);

    rbac.hasAllPermissions.mockResolvedValue(true);

    await expect(
      guard.canActivate(createContext('admin-1')),
    ).resolves.toBe(true);

    expect(
      rbac.hasAllPermissions,
    ).toHaveBeenCalledTimes(1);
  });

  it('requires all permissions when several are specified', async () => {
    const required = [
      'products.read',
      'products.update',
    ];

    reflector.getAllAndOverride.mockReturnValue(
      required,
    );

    rbac.hasAllPermissions.mockResolvedValue(false);

    await expect(
      guard.canActivate(createContext('admin-2')),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      rbac.hasAllPermissions,
    ).toHaveBeenCalledWith(
      'admin-2',
      required,
    );
  });

  it('does not allow access when the RBAC service fails', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      'roles.manage',
    ]);

    rbac.hasAllPermissions.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      guard.canActivate(createContext('admin-1')),
    ).rejects.toThrow(
      'Database unavailable',
    );
  });
});

