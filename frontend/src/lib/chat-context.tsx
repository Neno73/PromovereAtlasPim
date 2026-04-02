"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { MeilisearchProduct } from "./types";

interface ChatContextValue {
  /** Products surfaced by the AI chat */
  chatProducts: MeilisearchProduct[];
  /** Whether the grid should display chat results instead of normal browse */
  isChatMode: boolean;
  /** Push products found by the AI into the grid */
  setChatProducts: (products: MeilisearchProduct[]) => void;
  /** Return to normal filter browsing */
  exitChatMode: () => void;
  /** Is the chat panel open? */
  isChatOpen: boolean;
  /** Toggle chat panel */
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatProducts, setChatProductsRaw] = useState<MeilisearchProduct[]>([]);
  const [isChatMode, setIsChatMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const setChatProducts = useCallback((products: MeilisearchProduct[]) => {
    setChatProductsRaw(products);
    setIsChatMode(true);
  }, []);

  const exitChatMode = useCallback(() => {
    setChatProductsRaw([]);
    setIsChatMode(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chatProducts,
        isChatMode,
        setChatProducts,
        exitChatMode,
        isChatOpen,
        toggleChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used inside <ChatProvider>");
  }
  return ctx;
}
