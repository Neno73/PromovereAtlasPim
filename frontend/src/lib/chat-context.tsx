"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ChatContextValue {
  /** Is the chat panel open? */
  isChatOpen: boolean;
  /** Toggle chat panel visibility */
  toggleChat: () => void;
  /** Is the filter sidebar collapsed on desktop? */
  sidebarCollapsed: boolean;
  /** Toggle filter sidebar */
  toggleSidebar: () => void;
  /** Register a function to clear chat messages (called by ChatPanel) */
  registerClearChat: (fn: () => void) => void;
  /** Clear all chat messages (called by page.tsx on "clear all filters") */
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const clearChatRef = useRef<(() => void) | null>(null);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const registerClearChat = useCallback((fn: () => void) => {
    clearChatRef.current = fn;
  }, []);

  const clearChat = useCallback(() => {
    clearChatRef.current?.();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        toggleChat,
        sidebarCollapsed,
        toggleSidebar,
        registerClearChat,
        clearChat,
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
