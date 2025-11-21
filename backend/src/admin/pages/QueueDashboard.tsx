import React, { useState } from 'react';
import { Main, Box, Flex, Button } from '@strapi/design-system';
import { Layouts } from '@strapi/strapi/admin';
import QueueManagement from './QueueManagement';

export const QueueDashboard = () => {
    const [activeView, setActiveView] = useState<'manager' | 'bullboard'>('manager');

    return (
        <Layouts.Root>
            <Layouts.Header
                title="Queue Dashboard"
                subtitle="Manage and monitor background jobs"
            />
            <Layouts.Content>
                <Main>
                    <Box padding={4}>
                        {/* View Toggle */}
                        <Flex gap={2} marginBottom={4}>
                            <Button
                                variant={activeView === 'manager' ? 'default' : 'secondary'}
                                onClick={() => setActiveView('manager')}
                            >
                                Job Manager
                            </Button>
                            <Button
                                variant={activeView === 'bullboard' ? 'default' : 'secondary'}
                                onClick={() => setActiveView('bullboard')}
                            >
                                Bull Board (Low Level)
                            </Button>
                        </Flex>

                        {/* Content */}
                        {activeView === 'manager' ? (
                            <QueueManagement />
                        ) : (
                            <Box background="neutral0" padding={4}>
                                <iframe
                                    src="/admin/queues"
                                    style={{
                                        width: '100%',
                                        height: 'calc(100vh - 200px)',
                                        border: '1px solid #dcdce4',
                                        borderRadius: '4px',
                                    }}
                                    title="Bull Board Queue Monitor"
                                />
                            </Box>
                        )}
                    </Box>
                </Main>
            </Layouts.Content>
        </Layouts.Root>
    );
};

export default QueueDashboard;
