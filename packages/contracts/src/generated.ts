export type HealthPath = "/health/live" | "/health/ready" | "/health/dependencies";
export type HealthStatus = "ok" | "degraded" | "failed";
export type HealthDependencyName = "config" | "postgres" | "redis" | "migration" | "worker";
export type HealthDependencyStatus = "ok" | "failed" | "skipped";
