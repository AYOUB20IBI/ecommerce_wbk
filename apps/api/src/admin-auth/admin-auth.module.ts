
import { Module } from '@nestjs/common';

import { SecurityModule } from '../security/security.module';

import { AdminAuthController } from './admin-auth.controller';
import { AdminAccessController } from './admin-access.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminManagementController } from './admin-management.controller';
import { AdminPasswordController } from './admin-password.controller';
import { AdminProfileController } from './admin-profile.controller';

import { AdminAuthService } from './admin-auth.service';
import { AdminSessionService } from './admin-session.service';
import { RbacService } from './rbac.service';
import { AdminUsersService } from './admin-users.service';
import { AdminManagementService } from './admin-management.service';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminOriginGuard } from './guards/admin-origin.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    SecurityModule,
  ],
  controllers: [
    AdminAuthController,
    AdminAccessController,
    AdminUsersController,
    AdminManagementController,
    AdminPasswordController,
    AdminProfileController,
  ],
  providers: [
    AdminAuthService,
    AdminSessionService,
    RbacService,
    AdminUsersService,
    AdminManagementService,
    AdminAuthGuard,
    AdminOriginGuard,
    PermissionsGuard,
  ],
  exports: [
    AdminSessionService,
    AdminAuthGuard,
    RbacService,
    PermissionsGuard,
  ],
})
export class AdminAuthModule {}
