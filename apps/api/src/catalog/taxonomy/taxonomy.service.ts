
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';

import type {
  Pool,
  PoolClient,
} from 'pg';

import type {
  TaxonomyKind,
  TaxonomyListInput,
} from './taxonomy.dto';

type Data = Record<string, unknown>;

const TABLES: Record<TaxonomyKind, string> = {
  brands: 'brands',
  categories: 'categories',
  tags: 'tags',
};

// Never accept table names directly from requests.
function tableName(kind: TaxonomyKind): string {
  return TABLES[kind];
}

function dbError(error: unknown): never {
  const e = error as {
    code?: string;
    constraint?: string;
  };

  if (e.code === '23505') {
    throw new ConflictException({
      success: false,
      message: 'Ce slug est déjà utilisé.',
    });
  }

  if (e.code === '23503') {
    throw new ConflictException({
      success: false,
      message:
        'Cette ressource est utilisée et ne peut pas être supprimée.',
    });
  }

  if (e.code === '23514') {
    throw new BadRequestException({
      success: false,
      message: 'Données invalides.',
    });
  }

  throw error;
}

@Injectable()
export class TaxonomyService {
  constructor(
    @Inject('TAXONOMY_PG_POOL')
    private readonly pool: Pool,
  ) {}

  private async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const value = await callback(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      dbError(error);
    } finally {
      client.release();
    }
  }

  private async audit(
    client: PoolClient,
    kind: TaxonomyKind,
    entityId: string,
    adminId: string,
    action: string,
    changes: Data,
  ) {
    await client.query(
      `INSERT INTO taxonomy_activity
       (entity_type, entity_id, admin_id, action, changes)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        kind,
        entityId,
        adminId,
        action,
        JSON.stringify(changes),
      ],
    );
  }

  private async getExisting(
    client: PoolClient,
    kind: TaxonomyKind,
    id: string,
    lock = false,
  ) {
    const table = tableName(kind);

    const result = await client.query(
      `SELECT * FROM ${table}
       WHERE id = $1
       ${lock ? 'FOR UPDATE' : ''}
       LIMIT 1`,
      [id],
    );

    if (!result.rows.length) {
      throw new NotFoundException({
        success: false,
        message: 'Ressource introuvable.',
      });
    }

    return result.rows[0] as Data;
  }

  // ========================================
  // CATEGORY HIERARCHY VALIDATION
  // ========================================

  private async validateParent(
    client: PoolClient,
    parentId: string | null,
    currentId: string | null = null,
  ) {
    if (parentId === null) return;

    if (parentId === currentId) {
      throw new BadRequestException({
        success: false,
        message:
          'Une catégorie ne peut pas être son propre parent.',
      });
    }

    const parent = await client.query(
      'SELECT id FROM categories WHERE id = $1',
      [parentId],
    );

    if (!parent.rows.length) {
      throw new BadRequestException({
        success: false,
        message: 'Catégorie parente introuvable.',
      });
    }

    if (!currentId) return;

    // Prevent moving a category under one
    // of its descendants.
    const cycle = await client.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM categories WHERE id = $1
         UNION
         SELECT c.id
         FROM categories c
         JOIN descendants d ON c.parent_id = d.id
       )
       SELECT id FROM descendants WHERE id = $2
       LIMIT 1`,
      [currentId, parentId],
    );

    if (cycle.rows.length) {
      throw new BadRequestException({
        success: false,
        message:
          'Hiérarchie circulaire interdite.',
      });
    }
  }

  // ========================================
  // CREATE
  // ========================================

  async create(
    kind: TaxonomyKind,
    input: Data,
    adminId: string,
  ) {
    return this.transaction(async client => {
      const table = tableName(kind);

      if (kind === 'categories') {
        // Serialize hierarchy mutations to prevent
        // concurrent parent-cycle writes.
        await client.query(
          'LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE',
        );

        await this.validateParent(
          client,
          input.parentId as string | null,
        );
      }

      const columns = kind === 'categories'
        ? ['name', 'slug', 'description', 'parent_id']
        : ['name', 'slug', 'description'];

      const values = kind === 'categories'
        ? [
            input.name,
            input.slug,
            input.description ?? null,
            input.parentId ?? null,
          ]
        : [
            input.name,
            input.slug,
            input.description ?? null,
          ];

      const placeholders = columns
        .map((_, i) => `$${i + 1}`)
        .join(', ');

      const result = await client.query(
        `INSERT INTO ${table}
         (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values,
      );

      const created = result.rows[0];

      await this.audit(
        client,
        kind,
        created.id,
        adminId,
        `${kind}.created`,
        {
          name: created.name,
          slug: created.slug,
          ...(kind === 'categories'
            ? { parentId: created.parent_id }
            : {}),
        },
      );

      return created;
    });
  }

  // ========================================
  // LIST + SEARCH + PAGINATION
  // ========================================

  async findAll(
    kind: TaxonomyKind,
    input: TaxonomyListInput,
  ) {
    const table = tableName(kind);

    const search = input.search
      ? input.search.replace(/[%_\\]/g, '\\$&')
      : null;

    const params = search
      ? [`%${search}%`]
      : [];

    const where = search
      ? `WHERE (
           name ILIKE $1 ESCAPE '\\'
           OR slug ILIKE $1 ESCAPE '\\'
         )`
      : '';

    const offset = (input.page - 1) * input.limit;

    const list = await this.pool.query(
      `SELECT * FROM ${table}
       ${where}
       ORDER BY name ASC, id ASC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, input.limit, offset],
    );

    const totals = await this.pool.query(
      `SELECT COUNT(*)::int AS total
       FROM ${table}
       ${where}`,
      params,
    );

    const total = totals.rows[0]?.total ?? 0;

    return {
      items: list.rows,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  // ========================================
  // DETAILS
  // ========================================

  async findOne(kind: TaxonomyKind, id: string) {
    const client = await this.pool.connect();

    try {
      return await this.getExisting(
        client,
        kind,
        id,
      );
    } finally {
      client.release();
    }
  }

  // ========================================
  // UPDATE
  // ========================================

  async update(
    kind: TaxonomyKind,
    id: string,
    input: Data,
    adminId: string,
  ) {
    return this.transaction(async client => {
      const table = tableName(kind);

      if (kind === 'categories') {
        await client.query(
          'LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE',
        );
      }

      const old = await this.getExisting(
        client,
        kind,
        id,
        true,
      );

      if (
        kind === 'categories' &&
        input.parentId !== undefined
      ) {
        await this.validateParent(
          client,
          input.parentId as string | null,
          id,
        );
      }

      const columnMap: Record<string, string> = {
        name: 'name',
        slug: 'slug',
        description: 'description',
        ...(kind === 'categories'
          ? { parentId: 'parent_id' }
          : {}),
      };

      const entries = Object.entries(input)
        .filter(([key]) => key in columnMap);

      if (!entries.length) {
        throw new BadRequestException(
          'Aucune modification fournie.',
        );
      }

      const assignments = entries.map(
        ([key], i) => `${columnMap[key]} = $${i + 2}`,
      );

      const values = entries.map(
        ([, value]) => value,
      );

      const updatedResult = await client.query(
        `UPDATE ${table}
         SET ${assignments.join(', ')}
         WHERE id = $1
         RETURNING *`,
        [id, ...values],
      );

      const updated = updatedResult.rows[0];

      const changes: Data = {};

      for (const [key, value] of entries) {
        const oldValue = old[columnMap[key]];

        if (oldValue !== value) {
          changes[key] = {
            old: oldValue ?? null,
            new: value,
          };
        }
      }

      if (Object.keys(changes).length) {
        await this.audit(
          client,
          kind,
          id,
          adminId,
          `${kind}.updated`,
          changes,
        );
      }

      return updated;
    });
  }

  // ========================================
  // DELETE SAFELY
  // ========================================

  async remove(
    kind: TaxonomyKind,
    id: string,
    adminId: string,
  ) {
    return this.transaction(async client => {
      const table = tableName(kind);

      if (kind === 'categories') {
        await client.query(
          'LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE',
        );
      }

      const old = await this.getExisting(
        client,
        kind,
        id,
        true,
      );

      if (kind === 'categories') {
        const children = await client.query(
          `SELECT 1 FROM categories
           WHERE parent_id = $1 LIMIT 1`,
          [id],
        );

        if (children.rows.length) {
          throw new ConflictException({
            success: false,
            message:
              'Impossible de supprimer une catégorie contenant des sous-catégories.',
          });
        }
      }

      // Foreign keys must RESTRICT deletion of
      // taxonomies referenced by products.
      // PostgreSQL 23503 is mapped to HTTP 409.
      await client.query(
        `DELETE FROM ${table} WHERE id = $1`,
        [id],
      );

      await this.audit(
        client,
        kind,
        id,
        adminId,
        `${kind}.deleted`,
        {
          name: old.name,
          slug: old.slug,
        },
      );

      return {
        id,
        deleted: true,
      };
    });
  }

  // ========================================
  // AUDIT
  // ========================================

  async activity(
    kind: TaxonomyKind,
    id: string,
  ) {
    const result = await this.pool.query(
      `SELECT *
       FROM taxonomy_activity
       WHERE entity_type = $1
         AND entity_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [kind, id],
    );

    return result.rows;
  }
}
