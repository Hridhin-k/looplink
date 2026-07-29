/**
 * Database-agnostic persistence port for a single entity type.
 *
 * Domain modules declare specific repository interfaces (possibly extending
 * this shape) and bind implementations via Symbol injection tokens. Business
 * logic must never import the Supabase SDK — only repository interfaces and
 * {@link import("../database-client.js").DatabaseClient}.
 *
 * @typeParam TEntity - Persisted entity type.
 * @typeParam TId - Primary key type (UUID string by convention).
 */
export interface EntityRepository<TEntity, TId extends string = string> {
  /**
   * Loads an entity by primary key.
   *
   * @param id - Entity identifier.
   * @returns The entity, or `undefined` when absent.
   */
  findById(id: TId): Promise<TEntity | undefined>;
}

/**
 * Creates a Symbol injection token for a repository port.
 *
 * Follows the existing Badger DI convention (`TUNNEL_REPOSITORY`, etc.).
 *
 * @param name - Short repository name (for example `workspace`).
 * @returns Unique Symbol token.
 */
export function createRepositoryToken(name: string): symbol {
  return Symbol(`badger.repository.${name}`);
}
