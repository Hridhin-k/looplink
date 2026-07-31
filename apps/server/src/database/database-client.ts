/**
 * Database-agnostic connectivity port.
 *
 * Domain and application services depend on this interface (or on specific
 * repository ports) rather than on the Supabase SDK. The SDK remains an
 * infrastructure detail behind repository implementations.
 */
export interface DatabaseClient {
  /**
   * Verifies the underlying data store is reachable.
   *
   * @throws when the store cannot be contacted or rejects the credentials.
   */
  ping(): Promise<void>;
}
