
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import {
  taxonomyKindSchema,
} from './taxonomy.dto';

export const TAXONOMY_ACTION = 'taxonomy_action';

export type TaxonomyAction =
  'read' | 'create' | 'update' | 'delete';

@Injectable()
export class TaxonomyPermissionsGuard
  implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const kindResult = taxonomyKindSchema.safeParse(
      (request.params as { kind?: string })?.kind,
    );

    if (!kindResult.success) {
      throw new ForbiddenException(
        'Ressource non autorisée.',
      );
    }

    const action = this.reflector.getAllAndOverride<
      TaxonomyAction
    >(
      TAXONOMY_ACTION,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!action) {
      throw new ForbiddenException(
        'Permission non définie.',
      );
    }

    // SECURITY: Do not trust a client-provided
    // permission list. The existing RBAC system
    // must verify the permission server-side.
    const admin = request.admin;

    if (!admin) {
      throw new ForbiddenException(
        'Administrateur requis.',
      );
    }

    // This guard requires connection to your
    // existing Permissions service.
    // No access is granted by default.
    throw new ForbiddenException(
      `Vérification RBAC requise: ${kindResult.data}.${action}`,
    );
  }
}
