"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useChatContext } from "@/lib/chat-context";
import { cn, formatPrice } from "@/lib/utils";
import type {
  FacetDistribution,
  MeilisearchProduct,
  SearchParams,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Inline product card for chat results (slim preview)
// ---------------------------------------------------------------------------

interface SlimProduct {
  id: string;
  name: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  currency?: string;
  colors?: string[];
  sizes?: string[];
  category?: string;
}

function ChatProductCard({ product }: { product: SlimProduct }) {
  return (
    <a
      href={`/products/${product.id}`}
      className="flex gap-3 rounded-lg border border-sols-border/50 bg-white p-2 transition-colors hover:bg-sols-light-gray/50"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-sols-light-gray p-1">
        <svg
          className="h-6 w-6 text-sols-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-sols-dark">
          {product.name}
        </p>
        {product.brand && (
          <p className="text-[10px] text-sols-muted">{product.brand}</p>
        )}
        {product.price_min != null && (
          <p className="text-xs font-semibold text-sols-accent">
            {formatPrice(product.price_min, product.currency)}
          </p>
        )}
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Tool output types
// ---------------------------------------------------------------------------

interface ToolOutput {
  filters_applied?: Record<string, unknown>;
  total?: number;
  sample_products?: SlimProduct[];
  available_facets?: Record<string, Record<string, number>>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Chat panel props
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  currentFilters: SearchParams;
  currentFacets: FacetDistribution | undefined;
  currentTotal: number;
  onApplyFilters: (filters: Partial<SearchParams>) => void;
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

export function ChatPanel({
  currentFilters,
  currentFacets,
  currentTotal,
  onApplyFilters,
}: ChatPanelProps) {
  const { isChatOpen, toggleChat, registerClearChat } = useChatContext();
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Track which tool output we've already applied to avoid re-applying on re-render
  const appliedToolRef = useRef<string | null>(null);

  // useChat — body is sent per-message via sendMessage options
  const { messages, sendMessage, setMessages, status } = useChat();

  // Register clear function so page.tsx can reset chat on "clear all filters"
  useEffect(() => {
    registerClearChat(() => {
      setMessages([]);
      appliedToolRef.current = null;
    });
  }, [registerClearChat, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract filters from tool outputs and apply to catalog
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part
        ) {
          const output = part.output as ToolOutput;
          if (output?.filters_applied) {
            // Build a unique key for this tool invocation
            const toolKey = `${msg.id}-${i}-${JSON.stringify(output.filters_applied)}`;
            if (appliedToolRef.current === toolKey) return;
            appliedToolRef.current = toolKey;

            const fa = output.filters_applied;

            // REPLACE all filter fields with what the tool returned.
            // The tool already merged AI args with existing filters on the
            // server, so filters_applied is the complete intended state.
            // Fields not present in fa get cleared to avoid stale leftovers.
            const filterUpdate: Partial<SearchParams> = {
              q: (fa.q as string) || undefined,
              brand: (fa.brand as string) || undefined,
              category: (fa.category as string) || undefined,
              colors: (fa.colors as string) || undefined,
              sizes: (fa.sizes as string) || undefined,
              price_min:
                fa.price_min != null ? (fa.price_min as number) : undefined,
              price_max:
                fa.price_max != null ? (fa.price_max as number) : undefined,
              sort: (fa.sort as string) || undefined,
              ids: (fa.ids as string) || undefined,
              supplier_code: undefined,
            };

            if (Object.values(filterUpdate).some((v) => v !== undefined)) {
              onApplyFilters(filterUpdate);
            }
            return;
          }
        }
      }
    }
  }, [messages, onApplyFilters]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(
      { text },
      {
        body: {
          currentFilters,
          currentFacets,
          currentTotal,
        },
      },
    );
  };

  // Always mounted but hidden via CSS for state persistence
  return (
    <div
      className={cn(
        // Desktop: inline push panel (not fixed, lives in page flow)
        "lg:w-[420px] lg:shrink-0 lg:flex-col",
        "overflow-hidden rounded-2xl border border-sols-border bg-white shadow-lg",
        "sticky top-24 h-[calc(100vh-8rem)]",
        // Mobile: fixed overlay (full screen minus header)
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-16 max-lg:z-50 max-lg:flex-col max-lg:rounded-none max-lg:shadow-2xl",
        // Visibility: hidden via CSS, not unmounted
        isChatOpen ? "flex max-lg:flex" : "hidden",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sols-border bg-sols-dark px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <h3 className="text-sm font-semibold text-white">
            PromoAtlas Assistant
          </h3>
        </div>
        <button
          type="button"
          onClick={toggleChat}
          className="rounded-md p-1 text-white/60 transition-colors hover:text-white"
          aria-label="Close chat"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <svg
              className="h-10 w-10 text-sols-mid-gray"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium text-sols-dark">
              Ask me about products
            </p>
            <p className="text-xs text-sols-muted">
              Try: &quot;Show me red promotional pens&quot;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1",
              msg.role === "user" ? "items-end" : "items-start",
            )}
          >
            {/* Text parts */}
            {msg.parts
              .filter(
                (p): p is typeof p & { type: "text"; text: string } =>
                  p.type === "text",
              )
              .filter((p) => p.text?.trim())
              .map((part, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-sols-accent text-white"
                      : "bg-sols-light-gray text-sols-dark",
                  )}
                >
                  {part.text}
                </div>
              ))}

            {/* Tool output parts: show sample product cards */}
            {msg.parts
              .filter(
                (p) =>
                  p.type.startsWith("tool-") &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .map((part, i) => {
                const output = (
                  "output" in part ? part.output : null
                ) as ToolOutput | null;
                const products = output?.sample_products;
                const total = output?.total;
                if (!products || products.length === 0) return null;

                return (
                  <div key={i} className="w-full max-w-[85%]">
                    <p className="text-[10px] font-medium text-sols-muted">
                      {total != null
                        ? `${total} product${total !== 1 ? "s" : ""} updated in grid`
                        : ""}
                    </p>
                  </div>
                );
              })}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-1.5 text-sols-muted">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sols-muted [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sols-muted [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sols-muted" />
          </div>
        )}

        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="border-t border-sols-border p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about products..."
            className={cn(
              "h-10 flex-1 rounded-lg border border-sols-border bg-white px-3",
              "text-sm text-sols-dark placeholder:text-sols-muted/60",
              "focus:border-sols-accent focus:outline-none",
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
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
      </div>
    </div>
  );
}
