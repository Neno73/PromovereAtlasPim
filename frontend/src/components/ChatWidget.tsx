"use client";

import { useChatContext } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const { isChatOpen, toggleChat } = useChatContext();

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-label={isChatOpen ? "Close chat" : "Open chat"}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center",
        "rounded-full bg-sols-accent text-white shadow-lg shadow-sols-accent/30",
        "transition-all duration-200 hover:bg-sols-accent-hover hover:shadow-xl hover:shadow-sols-accent/40",
        "active:scale-95",
        isChatOpen && "rotate-90",
      )}
    >
      {isChatOpen ? (
        /* Close icon */
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        /* Chat icon */
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
    </button>
  );
}
