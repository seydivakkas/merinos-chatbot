import { createHttpRepositories } from "@/lib/data/http-repositories";
import { localRepositories } from "@/lib/data/local-repositories";
import type { Repositories } from "@/lib/data/contracts";
import type { DataSourceMode } from "@/lib/types";

export function getDataSourceMode(): DataSourceMode {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "local";
}

export function createRepositories(mode = getDataSourceMode()): Repositories {
  return mode === "api" ? createHttpRepositories() : localRepositories;
}
