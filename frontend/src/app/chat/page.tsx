"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Image from "next/image";
import Link from "next/link";
import { cn, formatPriceRange } from "@/lib/utils";
import { ColorSwatch } from "@/components/ColorSwatch";
import type { RichProduct } from "@/lib/types";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

interface ConversationMeta {
  id: string;
  title: string;
  lastMessageAt: number;
  messageCount: number;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: StoredPart[];
  createdAt: number;
}

type StoredPart =
  | { type: "text"; text: string }
  | {
      type: "tool-result";
      toolName: string;
      products: RichProduct[];
      total: number;
      noResults: boolean;
    };

const MAX_CONVERSATIONS = 30;

function generateId(): string {
  return crypto.randomUUID();
}

function loadConversations(): ConversationMeta[] {
  try {
    const raw = localStorage.getItem("chatbot_conversations");
    return raw ? (JSON.parse(raw) as ConversationMeta[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: ConversationMeta[]) {
  try {
    localStorage.setItem("chatbot_conversations", JSON.stringify(convos));
  } catch {
    // quota exceeded — silent
  }
}

function loadMessages(conversationId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(`chatbot_messages_${conversationId}`);
    return raw ? (JSON.parse(raw) as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(conversationId: string, messages: StoredMessage[]) {
  try {
    localStorage.setItem(
      `chatbot_messages_${conversationId}`,
      JSON.stringify(messages),
    );
  } catch {
    // quota exceeded — silent
  }
}

function deleteConversation(id: string) {
  try {
    localStorage.removeItem(`chatbot_messages_${id}`);
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Lightweight markdown formatter for chat messages
// Handles **bold**, *italic*, and line breaks — no external dependency needed.
// ---------------------------------------------------------------------------

function FormattedText({ text }: { text: string }) {
  // Split into paragraphs on double newlines, single newlines become <br>
  const paragraphs = text.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <p key={pi} className={pi > 0 ? "mt-2" : undefined}>
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {formatInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Parse **bold** and *italic* into <strong> and <em> spans */
function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** or *italic* (non-greedy)
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Show me eco-friendly corporate gifts",
  "Polo shirts under \u20AC15",
  "Trade show giveaways under \u20AC5",
  "Premium branded pens",
];

// ---------------------------------------------------------------------------
// Inline product card for chat messages
// ---------------------------------------------------------------------------

const ChatProductCard = React.memo(function ChatProductCard({
  product,
}: {
  product: RichProduct;
}) {
  const imgSrc = product.main_image_url || product.main_image_thumbnail_url;
  const priceLabel = formatPriceRange(
    product.price_min,
    product.price_max,
    product.currency,
  );
  const maxSwatches = 4;
  const visibleColors = product.colors.slice(0, maxSwatches);
  const overflowCount = product.colors.length - maxSwatches;

  return (
    <a
      href={`/products/${product.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-sols-border/60 bg-white",
        "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-sols-light-gray">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={product.name}
            width={200}
            height={200}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sols-muted/40">
            <svg
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {product.brand && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-sols-dark shadow-sm backdrop-blur-sm">
            {product.brand}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-sols-dark">
          {product.name}
        </h4>
        {priceLabel && (
          <p className="text-xs font-semibold text-sols-accent">{priceLabel}</p>
        )}
        {visibleColors.length > 0 && (
          <div className="flex items-center gap-0.5 pt-0.5">
            {visibleColors.map((color, i) => (
              <ColorSwatch
                key={`${color}-${i}`}
                colorName={color}
                hex={product.hex_colors?.[i]}
                size="sm"
                showTooltip
              />
            ))}
            {overflowCount > 0 && (
              <span className="ml-0.5 text-[10px] text-sols-muted">
                +{overflowCount}
              </span>
            )}
          </div>
        )}
        <p className="mt-auto text-[10px] text-sols-muted">
          {product.supplier_name}
        </p>
      </div>
    </a>
  );
});

// ---------------------------------------------------------------------------
// Inline product grid (rendered inside assistant messages)
// ---------------------------------------------------------------------------

interface ToolOutput {
  products?: RichProduct[];
  total?: number;
  no_results?: boolean;
  filters_applied?: Record<string, unknown>;
  error?: string;
}

// Shared assistant avatar — used in messages and loading state
function AssistantAvatar() {
  return (
    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sols-accent/10">
      <svg
        className="h-4 w-4 text-sols-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    </div>
  );
}

const InlineProductGrid = React.memo(function InlineProductGrid({
  output,
}: {
  output: ToolOutput;
}) {
  const products = output.products || [];
  const total = output.total || 0;

  // Must be above early return to satisfy React Rules of Hooks
  const catalogUrl = useMemo(() => {
    const fa = output.filters_applied;
    if (!fa) return "/";
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(fa)) {
      if (val != null && val !== "") params.set(key, String(val));
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }, [output.filters_applied]);

  if (output.no_results || products.length === 0) {
    return (
      <div className="rounded-lg border border-sols-border/50 bg-sols-light-gray/50 p-3 text-center text-xs text-sols-muted">
        No products found for this search.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ChatProductCard key={p.id} product={p} />
        ))}
      </div>
      {total > products.length && (
        <p className="text-center text-[11px] text-sols-muted">
          Showing {products.length} of {total} products.{" "}
          <Link href={catalogUrl} className="text-sols-accent hover:underline">
            View all in catalog
          </Link>
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Stored message renderer (for restored history)
// ---------------------------------------------------------------------------

function StoredMessageBubble({ msg }: { msg: StoredMessage }) {
  return (
    <div
      className={cn(
        "flex gap-3",
        msg.role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {msg.role === "assistant" && <AssistantAvatar />}
      <div
        className={cn(
          "max-w-[min(85%,56ch)] space-y-2",
          msg.role === "user" ? "text-right" : "text-left",
        )}
      >
        {msg.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "inline-block rounded-br-md bg-sols-accent text-white"
                    : "rounded-bl-md bg-sols-light-gray text-sols-dark",
                )}
              >
                {msg.role === "assistant" ? (
                  <FormattedText text={part.text} />
                ) : (
                  part.text
                )}
              </div>
            );
          }
          if (part.type === "tool-result") {
            return (
              <InlineProductGrid
                key={i}
                output={{
                  products: part.products,
                  total: part.total,
                  no_results: part.noResults,
                }}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main chat page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat-bot" }),
    [],
  );
  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState(generateId);
  const [restoredMessages, setRestoredMessages] = useState<StoredMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, restoredMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // Persist messages to localStorage when stream completes
  useEffect(() => {
    if (status !== "ready" || messages.length === 0 || !activeConversationId)
      return;

    const stored: StoredMessage[] = messages.map((msg) => {
      const parts: StoredPart[] = [];
      for (const part of msg.parts) {
        if (part.type === "text" && "text" in part) {
          const text = (part as { type: "text"; text: string }).text;
          if (text.trim()) {
            parts.push({ type: "text", text });
          }
        } else if (
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part
        ) {
          const output = part.output as ToolOutput;
          parts.push({
            type: "tool-result",
            toolName: "searchProducts",
            products: output.products || [],
            total: output.total || 0,
            noResults: output.no_results || false,
          });
        }
      }
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts,
        createdAt: Date.now(),
      };
    });

    saveMessages(activeConversationId, stored);

    // Update conversation meta via functional updater (avoids stale closure
    // and the "setState in effect" lint rule, since the update is derived
    // from previous state rather than called unconditionally).
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? (
          firstUserMsg.parts.find(
            (p): p is { type: "text"; text: string } => p.type === "text",
          ) as { text: string } | undefined
        )?.text?.slice(0, 60) || "New conversation"
      : "New conversation";

    const meta: ConversationMeta = {
      id: activeConversationId,
      title,
      lastMessageAt: Date.now(),
      messageCount: messages.length,
    };

    // Sync conversation list to localStorage when AI stream completes.
    // This is a response to an external system (AI SDK), not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations((prev) => {
      const allConvos = [...prev];
      const existingIdx = allConvos.findIndex(
        (c) => c.id === activeConversationId,
      );

      if (existingIdx >= 0) {
        allConvos[existingIdx] = meta;
      } else {
        allConvos.unshift(meta);
      }

      while (allConvos.length > MAX_CONVERSATIONS) {
        const removed = allConvos.pop();
        if (removed) deleteConversation(removed.id);
      }

      saveConversations(allConvos);
      return allConvos;
    });
  }, [status, messages, activeConversationId]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      setInput("");
      sendMessage({ text: trimmed });
    },
    [isLoading, sendMessage],
  );

  const handleNewChat = useCallback(() => {
    const newId = generateId();
    setActiveConversationId(newId);
    setMessages([]);
    setRestoredMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }, [setMessages]);

  const handleSwitchConversation = useCallback(
    (convoId: string) => {
      if (convoId === activeConversationId) return;
      setActiveConversationId(convoId);
      setMessages([]);
      const stored = loadMessages(convoId);
      setRestoredMessages(stored);
      setInput("");
    },
    [activeConversationId, setMessages],
  );

  const handleDeleteConversation = useCallback(
    (convoId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteConversation(convoId);
      const updated = conversations.filter((c) => c.id !== convoId);
      saveConversations(updated);
      setConversations(updated);
      if (convoId === activeConversationId) {
        handleNewChat();
      }
    },
    [conversations, activeConversationId, handleNewChat],
  );

  const showRestoredHistory =
    restoredMessages.length > 0 && messages.length === 0;
  const hasAnyMessages = restoredMessages.length > 0 || messages.length > 0;

  const isToolSearching = useMemo(
    () =>
      messages.some(
        (m) =>
          m.role === "assistant" &&
          m.parts.some(
            (p) =>
              p.type.startsWith("tool-") &&
              "state" in p &&
              (p.state === "input-streaming" || p.state === "streaming"),
          ),
      ),
    [messages],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ----------------------------------------------------------------- */}
      {/* Sidebar */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={cn(
          "flex flex-col border-r border-sols-border bg-white transition-all duration-200",
          sidebarOpen ? "w-64 shrink-0" : "w-0 overflow-hidden",
          "max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:z-50 max-lg:shadow-xl",
          !sidebarOpen && "max-lg:hidden",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2 border-b border-sols-border p-3">
          <button
            type="button"
            onClick={handleNewChat}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2",
              "bg-sols-accent text-white text-sm font-semibold",
              "transition-colors hover:bg-sols-accent-hover",
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-sols-muted">
              No conversations yet
            </p>
          )}
          {conversations.map((convo) => (
            <div
              key={convo.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSwitchConversation(convo.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  handleSwitchConversation(convo.id);
              }}
              className={cn(
                "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                convo.id === activeConversationId
                  ? "bg-sols-light-gray font-semibold text-sols-dark"
                  : "text-sols-muted hover:bg-sols-light-gray/50 hover:text-sols-dark",
              )}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="flex-1 truncate">{convo.title}</span>
              <button
                type="button"
                onClick={(e) => handleDeleteConversation(convo.id, e)}
                className="hidden shrink-0 rounded p-0.5 text-sols-muted hover:text-red-500 group-hover:block"
                title="Delete conversation"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Main chat area */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chat header bar */}
        <div className="flex items-center gap-3 border-b border-sols-border bg-white px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="rounded-lg p-1.5 text-sols-muted transition-colors hover:bg-sols-light-gray hover:text-sols-dark"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-sm font-semibold text-sols-dark">
              PromoAtlas Assistant
            </span>
          </div>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {/* Welcome state */}
            {!hasAnyMessages && (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
                <div className="text-center">
                  <span className="text-4xl font-extrabold tracking-tight text-sols-dark">
                    Promo<span className="text-sols-accent">Atlas</span>
                  </span>
                  <p className="mt-2 text-sols-muted">
                    Find the perfect promotional products for your brand
                  </p>
                </div>
                <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSend(suggestion)}
                      className={cn(
                        "rounded-xl border border-sols-border px-4 py-3 text-left text-sm text-sols-dark",
                        "transition-all hover:border-sols-accent/30 hover:bg-sols-light-gray/50 hover:shadow-sm",
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Restored history messages */}
            {showRestoredHistory && (
              <div className="space-y-4">
                {restoredMessages.map((msg) => (
                  <StoredMessageBubble key={msg.id} msg={msg} />
                ))}
              </div>
            )}

            {/* Live messages */}
            {messages.length > 0 && (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && <AssistantAvatar />}

                    <div
                      className={cn(
                        "max-w-[min(85%,56ch)] space-y-2",
                        msg.role === "user" ? "text-right" : "text-left",
                      )}
                    >
                      {/* Render parts in order so text after tools appears below cards */}
                      {msg.parts.map((part, i) => {
                        // Text part
                        if (part.type === "text") {
                          const text = (part as { type: "text"; text: string })
                            .text;
                          if (!text?.trim()) return null;
                          return (
                            <div
                              key={i}
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                msg.role === "user"
                                  ? "inline-block rounded-br-md bg-sols-accent text-white"
                                  : "rounded-bl-md bg-sols-light-gray text-sols-dark",
                              )}
                            >
                              {msg.role === "assistant" ? (
                                <FormattedText text={text} />
                              ) : (
                                text
                              )}
                            </div>
                          );
                        }

                        // Tool part — check states
                        if (part.type.startsWith("tool-") && "state" in part) {
                          // Streaming / loading state
                          if (
                            part.state === "input-streaming" ||
                            part.state === "streaming"
                          ) {
                            return (
                              <div
                                key={`search-${i}`}
                                className="flex items-center gap-2 rounded-lg bg-sols-light-gray/50 px-3 py-2 text-xs text-sols-muted"
                              >
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                                Searching products...
                              </div>
                            );
                          }

                          // Output available — render product cards
                          if (part.state === "output-available") {
                            const output = (
                              "output" in part ? part.output : null
                            ) as ToolOutput | null;
                            if (!output) return null;
                            return (
                              <InlineProductGrid
                                key={`tool-${i}`}
                                output={output}
                              />
                            );
                          }
                        }

                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading dots — only when streaming text, not during tool search */}
            {isLoading && !isToolSearching && (
              <div className="mt-4 flex items-center gap-3">
                <AssistantAvatar />
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-sols-muted [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-sols-muted [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-sols-muted" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Input bar */}
        {/* ----------------------------------------------------------------- */}
        <div className="border-t border-sols-border bg-white px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div
              className={cn(
                "flex items-end gap-3 rounded-2xl border border-sols-border/60",
                "bg-white px-4 py-3 shadow-sm",
                "focus-within:border-sols-mid-gray focus-within:shadow-md",
                "transition-all",
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Ask about products, quotes, delivery times..."
                rows={1}
                className={cn(
                  "max-h-40 flex-1 resize-none bg-transparent text-sm text-sols-dark",
                  "placeholder:text-sols-muted/60 focus:outline-none",
                )}
              />
              <button
                type="button"
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  "bg-sols-accent text-white transition-colors",
                  "hover:bg-sols-accent-hover disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-sols-muted">
              PromoAtlas AI &middot; Powered by Claude
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
