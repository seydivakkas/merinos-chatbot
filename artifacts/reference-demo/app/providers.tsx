"use client";
import type { ReactNode } from "react";
import { ExperienceProvider } from "@/lib/state/ExperienceContext";
export function Providers({ children }: { children: ReactNode }) { return <ExperienceProvider>{children}</ExperienceProvider>; }
