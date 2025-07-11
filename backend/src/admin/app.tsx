import React from 'react';

export default {
  config: {
    locales: ['en'],
    menu: {
      logo: {
        en: { url: '/favicon.png', alt: 'PromoAtlas PIM' }
      }
    }
  },
  bootstrap(app: any) {
    console.log('PromoAtlas Admin App initialized');
  },
};