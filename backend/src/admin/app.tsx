import React from 'react';

// Custom icon components with dark colors
const DarkIcon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#32324D' }}>{children}</span>
);

export default {
  config: {
    locales: ["en"],
    menu: {
      logo: {
        en: { url: "/favicon.png", alt: "PromoAtlas PIM" },
      },
    },
  },
  bootstrap(app: any) {
    console.log("PromoAtlas Admin App initialized - Simple Version");

    // Add supplier sync management page
    app.addMenuLink({
      to: "/supplier-sync",
      icon: () => <DarkIcon><span className="icon-sync">⟳</span></DarkIcon>,
      intlLabel: {
        id: "supplier-sync.plugin.name",
        defaultMessage: "Supplier Sync",
      },
      Component: async () => {
        const mod = await import("./pages/supplier-sync");
        return mod.default;
      },
    });

    // Add Queue Dashboard (Bull Board)
    app.addMenuLink({
      to: "/queue-dashboard",
      icon: () => <DarkIcon><span className="icon-dashboard">■</span></DarkIcon>,
      intlLabel: {
        id: "queue-dashboard.plugin.name",
        defaultMessage: "Queue Dashboard",
      },
      Component: async () => {
        const mod = await import("./pages/QueueDashboard");
        return mod.default;
      },
    });

    // Add Gemini Dashboard
    app.addMenuLink({
      to: "/gemini-dashboard",
      icon: () => <DarkIcon><span className="icon-gemini">◈</span></DarkIcon>,
      intlLabel: {
        id: "gemini-dashboard.plugin.name",
        defaultMessage: "Gemini Dashboard",
      },
      Component: async () => {
        const mod = await import("./pages/gemini-dashboard");
        return mod.default;
      },
    });

    // Add Sync Sessions Dashboard
    app.addMenuLink({
      to: "/sync-sessions",
      icon: () => <DarkIcon><span className="icon-sessions">⏱</span></DarkIcon>,
      intlLabel: {
        id: "sync-sessions.plugin.name",
        defaultMessage: "Sync Sessions",
      },
      Component: async () => {
        const mod = await import("./pages/sync-sessions");
        return mod.default;
      },
    });

  },
};
