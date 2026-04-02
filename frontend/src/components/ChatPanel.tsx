"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useChatContext } from "@/lib/chat-context";
import { cn, formatPrice } from "@/lib/utils";
import type { MeilisearchProduct } from "@/lib/types";

// ---------------------------------------------------------------------------
// Inline product card for chat results
// ---------------------------------------------------------------------------

function ChatProductCard({ product }: { product: MeilisearchProduct }) {
  const name =
    product.name_en || product.name_de || product.name_fr || product.sku;

  return (
    <a
      href={`/products/${product.id}`}
      className="flex gap-3 rounded-lg border border-sols-border/50 bg-white p-2 transition-colors hover:bg-sols-light-gray/50"
    >
      {product.main_image_thumbnail_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={product.main_image_thumbnail_url}
          alt={name}
          className="h-14 w-14 shrink-0 rounded-md bg-sols-light-gray object-contain p-1"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-sols-dark">{name}</p>
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
// Chat panel
// ---------------------------------------------------------------------------

interface ToolOutput {
  products?: MeilisearchProduct[];
}

export function ChatPanel() {
  const { isChatOpen, toggleChat, setChatProducts } = useChatContext();
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // useChat with default transport (DefaultChatTransport -> /api/chat)
  const { messages, sendMessage, status } = useChat();

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract products from tool outputs and push to chat context
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
          if (output?.products && output.products.length > 0) {
            setChatProducts(output.products);
            return;
          }
        }
      }
    }
  }, [messages, setChatProducts]);

  if (!isChatOpen) return null;

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <div
      className={cn(
        // Desktop: inline push panel (not fixed, lives in page flow)
        "hidden lg:flex lg:w-[420px] lg:shrink-0 lg:flex-col",
        "overflow-hidden rounded-2xl border border-sols-border bg-white shadow-lg",
        "sticky top-24 h-[calc(100vh-8rem)]",
        // Mobile: fixed overlay (full screen minus header)
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-16 max-lg:z-50 max-lg:flex max-lg:flex-col max-lg:rounded-none max-lg:shadow-2xl",
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
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

            {/* Tool output parts: show product cards */}
            {msg.parts
              .filter(
                (p) =>
                  p.type.startsWith("tool-") &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .map((part, i) => {
                const output = ("output" in part ? part.output : null) as ToolOutput | null;
                const products = output?.products;
                if (!products || products.length === 0) return null;

                return (
                  <div key={i} className="w-full max-w-[85%] space-y-1.5">
                    <p className="text-[10px] font-medium text-sols-muted">
                      Found {products.length} product
                      {products.length !== 1 ? "s" : ""}
                    </p>
                    {products.slice(0, 4).map((p) => (
                      <ChatProductCard key={p.id} product={p} />
                    ))}
                    {products.length > 4 && (
                      <p className="text-[10px] text-sols-muted">
                        +{products.length - 4} more in the grid
                      </p>
                    )}
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
