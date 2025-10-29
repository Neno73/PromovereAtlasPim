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
      icon: "refresh",
      intlLabel: {
        id: "supplier-sync.plugin.name",
        defaultMessage: "Supplier Sync",
      },
      Component: async () => {
        const mod = await import("./pages/supplier-sync");
        return mod.default;
      },
    });

    // Add queue management page
    app.addMenuLink({
      to: "/queue-management",
      icon: "layer",
      intlLabel: {
        id: "queue-management.plugin.name",
        defaultMessage: "Queue Management",
      },
      Component: async () => {
        const mod = await import("./pages/QueueManagement");
        return mod.default;
      },
    });
  },
};
