export type HealthResponse = {
  status: "ok";
  checks: { database: "ok"; storage: "ok" };
};
