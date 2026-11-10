import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "Wali";
export default defineRailway(() => {
  const Wali = service("Wali", {
    // builder from CaC: "RAILPACK"
    // watchPatterns from CaC: ["/app/**"]
    source: github("NexCode97-Tech/Wali", { branch: "main", checkSuites: false, rootDirectory: "/app" }),
    build: { buildCommand: "pnpm build", buildEnvironment: "V3", builder: "RAILPACK", watchPatterns: ["/app/**"] },
    start: "pnpm start",
    healthcheck: "/health",
    healthcheckTimeout: 120,
    preDeploy: "pnpm db:migrate",
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "crm" },
  });

  return project("Wali", {
    variables: { managed: false },
    resources: [Wali],
  });
});
