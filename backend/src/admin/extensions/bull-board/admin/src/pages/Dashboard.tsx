import React from 'react';
import { Main } from '@strapi/design-system';
import { Layouts } from '@strapi/strapi/admin';

export const Dashboard = () => {
  return (
    <Layouts.Root>
      <Layouts.Header
        title="Queue Dashboard"
        subtitle="Real-time queue monitoring with Bull Board (supplier-sync, product-family, image-upload)"
      />
      <Layouts.Content>
        <Main>
          <iframe
            src="/admin/queues"
            style={{
              width: '100%',
              height: 'calc(100vh - 120px)',
              border: 'none',
              borderRadius: '4px',
            }}
            title="Bull Board Queue Monitor"
          />
        </Main>
      </Layouts.Content>
    </Layouts.Root>
  );
};
