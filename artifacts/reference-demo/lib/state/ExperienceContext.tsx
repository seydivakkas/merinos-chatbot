"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { ProductSearchCriteria } from "@/lib/types";

type ExperienceState = {
  productCriteria: ProductSearchCriteria;
  dealerCity: string;
  selectedDealerId?: string;
  chatOpen: boolean;
  pendingChatCommand?: { id: string; text: string };
};

type Action =
  | { type: "SET_PRODUCT_CRITERIA"; criteria: ProductSearchCriteria }
  | { type: "SET_DEALER_CITY"; city: string; selectedDealerId?: string }
  | { type: "SELECT_DEALER"; dealerId: string }
  | { type: "OPEN_CHAT"; command?: string }
  | { type: "CLOSE_CHAT" }
  | { type: "CONSUME_CHAT_COMMAND"; id: string };

const initialState: ExperienceState = { productCriteria: {}, dealerCity: "Gaziantep", chatOpen: false };

function reducer(state: ExperienceState, action: Action): ExperienceState {
  switch (action.type) {
    case "SET_PRODUCT_CRITERIA": return { ...state, productCriteria: action.criteria };
    case "SET_DEALER_CITY": return { ...state, dealerCity: action.city, selectedDealerId: action.selectedDealerId };
    case "SELECT_DEALER": return { ...state, selectedDealerId: action.dealerId };
    case "OPEN_CHAT": return { ...state, chatOpen: true, pendingChatCommand: action.command ? { id: crypto.randomUUID(), text: action.command } : state.pendingChatCommand };
    case "CLOSE_CHAT": return { ...state, chatOpen: false };
    case "CONSUME_CHAT_COMMAND": return state.pendingChatCommand?.id === action.id ? { ...state, pendingChatCommand: undefined } : state;
    default: return state;
  }
}

type ExperienceContextValue = { state: ExperienceState; dispatch: React.Dispatch<Action> };
const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience() {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error("useExperience, ExperienceProvider içinde kullanılmalıdır.");
  return value;
}
