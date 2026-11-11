import { checkHealth } from "@/server/health/service";
import { route } from "@/server/http/route";

export const GET = route(async () => Response.json(await checkHealth()));
