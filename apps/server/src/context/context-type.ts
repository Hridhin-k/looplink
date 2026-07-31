/**
 * Discriminator for execution contexts.
 *
 * Only {@link ContextType.Anonymous} and {@link ContextType.Workspace} are
 * implemented. Remaining values are reserved so future identity types can be
 * added without changing business-service signatures.
 */
export enum ContextType {
  Anonymous = "ANONYMOUS",
  Workspace = "WORKSPACE",
  /** Reserved — not implemented. */
  ApiKey = "API_KEY",
  /** Reserved — not implemented. */
  ServiceAccount = "SERVICE_ACCOUNT",
  /** Reserved — not implemented. */
  CiPipeline = "CI_PIPELINE",
  /** Reserved — not implemented. */
  Guest = "GUEST",
}

/**
 * Opaque metadata attached to an execution context for tracing and transport hints.
 *
 * Values are immutable after construction. Never store secrets here.
 */
export type ContextMetadata = Readonly<Record<string, string | number | boolean | null>>;
