
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BadRequestException,
} from '@nestjs/common';

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { MediaSearchController } from './media-search.controller';
import { MediaSearchService } from './media-search.service';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';

import {
  PERMISSIONS_KEY,
} from '../admin-auth/decorators/require-permissions.decorator';

describe('MediaSearchController', () => {
  const service = {
    search: vi.fn(),
  };

  const controller = new MediaSearchController(
    service as unknown as MediaSearchService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses authentication and permission guards', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MediaSearchController,
    ) as unknown[];

    expect(guards).toContain(AdminAuthGuard);
    expect(guards).toContain(PermissionsGuard);
  });

  it('requires media.read', () => {
    const reflector = new Reflector();

    const permissions =
      reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [
          controller.search,
          MediaSearchController,
        ],
      );

    expect(permissions).toContain('media.read');
  });

  it('rejects invalid search parameters', async () => {
    await expect(
      controller.search({
        page: '0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(service.search).not.toHaveBeenCalled();
  });

  it('passes validated parameters to the service', async () => {
    service.search.mockResolvedValueOnce({
      items: [],
      pagination: {
        page: 1,
        limit: 24,
        total: 0,
        totalPages: 0,
      },
    });

    const result = await controller.search({
      page: '1',
      limit: '24',
      type: 'document',
      search: 'invoice',
    });

    expect(service.search).toHaveBeenCalledWith({
      page: 1,
      limit: 24,
      type: 'document',
      search: 'invoice',
    });

    expect(result.success).toBe(true);
  });
});
