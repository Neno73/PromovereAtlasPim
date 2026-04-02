"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prompts {
  regularPrompt: string;
  companyKnowledge: string;
  industryKnowledge: string;
  preSearchQuestions: string;
  productSearchFlow: string;
  brandVoice: string;
}

interface PromptSection {
  key: keyof Prompts;
  label: string;
  description: string;
  placeholder: string;
}

const SECTIONS: PromptSection[] = [
  {
    key: "regularPrompt",
    label: "Regular Prompt",
    description: "The main system prompt defining the assistant's persona and behavior",
    placeholder: "Define the AI assistant's core identity and instructions...",
  },
  {
    key: "companyKnowledge",
    label: "Company Knowledge",
    description: "Information about your company, products, and internal processes",
    placeholder: "Describe your company, product range, service areas...",
  },
  {
    key: "industryKnowledge",
    label: "Industry Knowledge",
    description: "Industry-specific terminology, brands, and best practices",
    placeholder: "Add industry terms, common decoration methods, standards...",
  },
  {
    key: "preSearchQuestions",
    label: "Pre-Search Questions",
    description: "Questions to collect from users before searching for products",
    placeholder: "List the qualifying questions the assistant should ask...",
  },
  {
    key: "productSearchFlow",
    label: "Product Search Flow",
    description: "The step-by-step search behavior instructions for the assistant",
    placeholder: "Define the stages of product discovery and recommendation...",
  },
  {
    key: "brandVoice",
    label: "Brand Voice & Tone",
    description: "Define how the chatbot should communicate with customers",
    placeholder: "Describe the communication style, tone, and language preferences...",
  },
];

// ---------------------------------------------------------------------------
// Auto-resizing textarea
// ---------------------------------------------------------------------------

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      placeholder={placeholder}
      rows={4}
      className="w-full resize-none rounded-lg border border-[#E2E2E2] bg-white px-4 py-3 text-sm leading-relaxed text-[#141413] transition-colors placeholder:text-[#6B7280]/60 focus:border-[#ED2F54] focus:outline-none focus:ring-2 focus:ring-[#ED2F54]/20"
    />
  );
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.authenticated) {
        onLogin();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#141413]">
            Atlas<span className="text-[#ED2F54]">Bot</span> Admin
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Sign in to manage system prompts and knowledge base
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#E2E2E2] bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-[#ED2F54]/10 px-4 py-3 text-sm font-medium text-[#ED2F54]">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-semibold text-[#141413]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-[#E2E2E2] bg-white px-4 py-2.5 text-sm text-[#141413] transition-colors placeholder:text-[#6B7280]/60 focus:border-[#ED2F54] focus:outline-none focus:ring-2 focus:ring-[#ED2F54]/20"
              placeholder="admin@example.com"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-[#141413]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#E2E2E2] bg-white px-4 py-2.5 text-sm text-[#141413] transition-colors placeholder:text-[#6B7280]/60 focus:border-[#ED2F54] focus:outline-none focus:ring-2 focus:ring-[#ED2F54]/20"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#ED2F54] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D41E42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt editor
// ---------------------------------------------------------------------------

function PromptEditor({ onLogout }: { onLogout: () => void }) {
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [defaults, setDefaults] = useState<Prompts | null>(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch prompts on mount
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const res = await fetch("/api/admin/prompts");
        if (res.status === 401) {
          onLogout();
          return;
        }
        const data = await res.json();
        setPrompts(data);
        setDefaults(data);
      } catch {
        setNotification({
          type: "error",
          message: "Failed to load prompts",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchPrompts();
  }, [onLogout]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  const updateField = useCallback((key: keyof Prompts, value: string) => {
    setPrompts((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const handleSave = async () => {
    if (!prompts) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (data.success) {
        setDefaults(prompts);
        setNotification({
          type: "success",
          message: "Prompts saved successfully",
        });
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to save prompts",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Connection error. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (defaults) {
      setPrompts({ ...defaults });
      setNotification({
        type: "success",
        message: "Prompts reset to last saved version",
      });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    onLogout();
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          <svg
            className="h-5 w-5 animate-spin"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading prompts...
        </div>
      </div>
    );
  }

  if (!prompts) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <p className="text-sm text-[#ED2F54]">Failed to load prompts.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#141413]">
            Atlas<span className="text-[#ED2F54]">Bot</span> Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage system prompts and knowledge base
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-[#E2E2E2] bg-white px-4 py-2 text-sm font-medium text-[#141413] transition-colors hover:bg-[#EEEEEE]"
        >
          Logout
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-[#ED2F54]/10 text-[#ED2F54] border border-[#ED2F54]/20"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Prompt sections */}
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded-xl border border-[#E2E2E2] bg-white p-5 shadow-sm"
          >
            <div className="mb-3">
              <label className="block text-sm font-bold text-[#141413]">
                {section.label}
              </label>
              <p className="mt-0.5 text-sm italic text-[#6B7280]">
                {section.description}
              </p>
            </div>
            <AutoTextarea
              value={prompts[section.key]}
              onChange={(val) => updateField(section.key, val)}
              placeholder={section.placeholder}
            />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#ED2F54] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D41E42] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Prompts"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-[#E2E2E2] bg-white px-6 py-2.5 text-sm font-medium text-[#141413] transition-colors hover:bg-[#EEEEEE]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin page (top-level)
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();
        setAuthenticated(data.authenticated === true);
      } catch {
        setAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Loading state while checking auth
  if (authenticated === null) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          <svg
            className="h-5 w-5 animate-spin"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Checking authentication...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />;
  }

  return <PromptEditor onLogout={() => setAuthenticated(false)} />;
}
