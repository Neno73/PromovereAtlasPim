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


  },
};
