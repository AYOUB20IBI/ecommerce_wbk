
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { GUARDS_METADATA } from '@nestjs/common/constants';

import { MediaSettingsController } from './media-settings.controller';
import { MediaSettingsService } from './media-settings.service';

import { AdminAuthGuard } from '../../admin-auth/guards/admin-auth.guard';
import { CsrfGuard } from '../../security/csrf.guard';

import type { FastifyRequest } from 'fastify';

const settings = {
  images: { enabled: true, maxSizeMb: 5 },
  modernImages: { enabled: true, maxSizeMb: 5 },
  documents: { enabled: true, maxSizeMb: 20 },
  spreadsheets: { enabled: true, maxSizeMb: 20 },
  videos: { enabled: false, maxSizeMb: 100 },
  archives: { enabled: false, maxSizeMb: 20 },
  allowExternalHttp: true,
  allowExternalHttps: true,
};

describe('MediaSettingsController', () => {
  const service = {
    getForAdmin: vi.fn(),
    updateForAdmin: vi.fn(),
  };

  const controller = new MediaSettingsController(
    service as unknown as MediaSettingsService,
  );

  const adminId = '11111111-1111-4111-8111-111111111111';

  const adminRequest = {
    admin: {
      id: adminId,
      email: 'admin@example.test',
    },
  } as unknown as FastifyRequest;

  const anonymousRequest = {
    admin: undefined,
  } as unknown as FastifyRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires AdminAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MediaSettingsController,
    ) as unknown[];

    expect(guards).toContain(AdminAuthGuard);
  });

  it('requires CsrfGuard for PATCH', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.update,
    ) as unknown[];

    expect(guards).toContain(CsrfGuard);
  });

  it('rejects missing admin session on GET', async () => {
    await expect(
      controller.read(anonymousRequest),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.getForAdmin).not.toHaveBeenCalled();
  });

  it('rejects missing admin session on PATCH', async () => {
    await expect(
      controller.update(anonymousRequest, settings),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.updateForAdmin).not.toHaveBeenCalled();
  });

  it('passes admin identity to settings service', async () => {
    service.getForAdmin.mockResolvedValueOnce({
      configuration: settings,
      updatedAt: null,
    });

    const result = await controller.read(adminRequest);

    expect(service.getForAdmin).toHaveBeenCalledWith(
      adminId,
    );

    expect(result.success).toBe(true);
  });

  it('rejects invalid settings', async () => {
    await expect(
      controller.update(adminRequest, {
        ...settings,
        images: {
          enabled: true,
          maxSizeMb: 9999,
        },
      }),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(service.updateForAdmin).not.toHaveBeenCalled();
  });

  it('rejects unknown fields', async () => {
    await expect(
      controller.update(adminRequest, {
        ...settings,
        storageRoot: '/tmp/unsafe',
      }),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('passes validated updates with admin ID', async () => {
    service.updateForAdmin.mockResolvedValueOnce({
      configuration: settings,
      updatedAt: new Date(),
    });

    const result = await controller.update(
      adminRequest,
      settings,
    );

    expect(service.updateForAdmin).toHaveBeenCalledWith(
      adminId,
      settings,
    );

    expect(result.success).toBe(true);
  });
});
