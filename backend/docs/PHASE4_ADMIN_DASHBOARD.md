# Phase 4: Admin Dashboard & Monitoring

**Status:** 🚧 In Progress
**Started:** 2025-10-30
**Estimated Duration:** 2-3 days

---

## Overview

Build a comprehensive admin dashboard for monitoring and managing the BullMQ queue system. Provides visibility into job processing, queue statistics, and manual controls for queue operations.

**Goal**: Give administrators complete visibility and control over the sync queue system through the Strapi admin panel.

---

## Objectives

### Primary Objectives
1. **Queue Monitoring** - View real-time queue statistics and job states
2. **Job Management** - List, view, retry, and cancel jobs
3. **Manual Controls** - Start syncs, pause/resume queues, clear jobs
4. **Job History** - Track completed and failed jobs with filtering
5. **Error Handling** - View detailed error information and retry failed jobs

### Secondary Objectives
1. Real-time updates (polling-based initially)
2. Job search and filtering
3. Performance metrics and trends
4. Queue health monitoring

---

## Architecture

### Backend (API Layer)

```
┌─────────────────────────────────────────────┐
│          Strapi Admin Panel                 │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│    Queue Management API Endpoints           │
│  (src/api/queue-manager/routes)             │
│                                              │
│  GET    /queue-stats                        │
│  GET    /queues/:queue/jobs                 │
│  GET    /queues/:queue/jobs/:jobId          │
│  POST   /queues/:queue/jobs/:jobId/retry    │
│  DELETE /queues/:queue/jobs/:jobId          │
│  POST   /queues/:queue/pause                │
│  POST   /queues/:queue/resume               │
│  POST   /queues/:queue/clean                │
│  POST   /sync/start                         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│    Queue Manager Service                    │
│  (src/api/queue-manager/services)           │
│                                              │
│  - getQueueStats()                          │
│  - listJobs(queue, state, pagination)       │
│  - getJobDetails(queue, jobId)              │
│  - retryJob(queue, jobId)                   │
│  - deleteJob(queue, jobId)                  │
│  - pauseQueue(queue)                        │
│  - resumeQueue(queue)                       │
│  - cleanQueue(queue, grace, status)         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         BullMQ Queue Service                │
│    (src/services/queue/queue-service.ts)    │
└─────────────────────────────────────────────┘
```

### Frontend (Admin Panel Extension)

```
┌─────────────────────────────────────────────┐
│        Strapi Admin Panel Page              │
│         (Queue Management)                   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Queue Overview Cards               │   │
│  │  [Supplier] [Product] [Image]        │   │
│  │   Stats, Health, Actions             │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Active Jobs Table                  │   │
│  │  Job ID | Queue | Status | Progress  │   │
│  │  Actions: View, Retry, Cancel        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Job History / Failed Jobs          │   │
│  │  Filters: Queue, Status, Date        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Manual Controls                    │   │
│  │  [Start Sync] [Pause] [Resume]       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 4A: API Layer (Backend) - Day 1

#### Step 1: Create Queue Manager Content Type (Optional)
- Create `queue-manager` API stub (or extend promidata-sync)
- Configure routes with admin-only permissions

#### Step 2: Implement Queue Manager Service
Location: `src/api/queue-manager/services/queue-manager.ts`

**Methods to implement:**
```typescript
// Queue Statistics
getQueueStats(queueName?: string): Promise<QueueStats>
getQueueHealth(queueName: string): Promise<QueueHealth>

// Job Management
listJobs(queueName: string, state: JobState, options: PaginationOptions): Promise<JobList>
getJobDetails(queueName: string, jobId: string): Promise<JobDetails>
retryJob(queueName: string, jobId: string): Promise<Job>
retryFailedJobs(queueName: string, limit?: number): Promise<RetryResult>
deleteJob(queueName: string, jobId: string): Promise<boolean>

// Queue Controls
pauseQueue(queueName: string): Promise<void>
resumeQueue(queueName: string): Promise<void>
cleanQueue(queueName: string, grace: number, status: string): Promise<number>
drainQueue(queueName: string): Promise<void>

// Sync Controls
startSync(supplierId?: string): Promise<SyncResult>
```

#### Step 3: Create API Routes
Location: `src/api/queue-manager/routes/queue-manager.ts`

**Endpoints:**
```javascript
GET    /api/queue-manager/stats              // All queue stats
GET    /api/queue-manager/stats/:queue       // Specific queue stats
GET    /api/queue-manager/:queue/jobs        // List jobs (with filters)
GET    /api/queue-manager/:queue/jobs/:id    // Job details
POST   /api/queue-manager/:queue/jobs/:id/retry
DELETE /api/queue-manager/:queue/jobs/:id
POST   /api/queue-manager/:queue/pause
POST   /api/queue-manager/:queue/resume
POST   /api/queue-manager/:queue/clean
POST   /api/queue-manager/sync/start         // Start sync
```

#### Step 4: Controller Implementation
Location: `src/api/queue-manager/controllers/queue-manager.ts`

- Request validation
- Permission checks (admin only)
- Error handling
- Response formatting

### Phase 4B: Admin UI (Frontend) - Day 2

#### Step 1: Create Admin Extension
Location: `src/admin/` (Strapi admin extensions)

**Components:**
1. **QueueDashboard** - Main dashboard page
2. **QueueCard** - Individual queue overview card
3. **JobsTable** - Active/completed/failed jobs table
4. **JobDetailsModal** - Job detail view with progress
5. **ManualControls** - Start sync, pause/resume buttons

#### Step 2: Admin Panel Integration
- Register custom page in Strapi admin
- Add navigation menu item
- Configure admin-only access

#### Step 3: Real-time Updates (Polling)
- Poll queue stats every 5 seconds
- Poll active jobs every 2 seconds
- Update UI reactively

### Phase 4C: Testing & Documentation - Day 3

#### Step 1: Testing
- API endpoint testing
- Queue operations testing
- Error handling validation
- Permission checks

#### Step 2: Documentation
- API documentation
- User guide for admin panel
- Troubleshooting guide

---

## Data Models

### Queue Statistics Response
```typescript
interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  total: number;
}

interface QueueHealth {
  status: 'healthy' | 'degraded' | 'critical';
  activeWorkers: number;
  processingRate: number; // jobs per minute
  errorRate: number;      // percentage
  avgProcessingTime: number; // milliseconds
}
```

### Job List Response
```typescript
interface JobListItem {
  id: string;
  queueName: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: {
    step: string;
    percentage: number;
  };
  data: {
    supplierId?: string;
    supplierCode?: string;
    aNumber?: string;
    imageUrl?: string;
  };
  createdAt: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
}

interface JobList {
  jobs: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

### Job Details Response
```typescript
interface JobDetails extends JobListItem {
  stacktrace?: string[];
  returnvalue?: any;
  failedReason?: string;
  opts: {
    attempts: number;
    delay: number;
    timeout: number;
  };
}
```

---

## API Specifications

### GET `/api/queue-manager/stats`
Get statistics for all queues

**Response:**
```json
{
  "supplierSync": {
    "queueName": "supplier-sync",
    "waiting": 0,
    "active": 1,
    "completed": 25,
    "failed": 2,
    "delayed": 0,
    "paused": false,
    "total": 28
  },
  "productFamily": { ... },
  "imageUpload": { ... }
}
```

### GET `/api/queue-manager/:queue/jobs?state=failed&page=1&pageSize=25`
List jobs in a queue with filtering

**Query Parameters:**
- `state`: waiting | active | completed | failed | delayed
- `page`: Page number (1-based)
- `pageSize`: Items per page (default: 25)

**Response:**
```json
{
  "jobs": [
    {
      "id": "supplier-sync-1730...-A360",
      "queueName": "supplier-sync",
      "state": "failed",
      "data": {
        "supplierId": "abc123",
        "supplierCode": "A360"
      },
      "failedReason": "Connection timeout",
      "attemptsMade": 3,
      "createdAt": 1730...,
      "finishedOn": 1730...
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 25
}
```

### POST `/api/queue-manager/:queue/jobs/:id/retry`
Retry a failed job

**Response:**
```json
{
  "success": true,
  "jobId": "supplier-sync-1730...-A360",
  "state": "waiting",
  "message": "Job re-queued for retry"
}
```

### POST `/api/queue-manager/:queue/clean`
Clean old jobs from queue

**Body:**
```json
{
  "grace": 3600000,  // Keep jobs from last hour (ms)
  "status": "completed"  // or "failed"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 150,
  "message": "Cleaned 150 completed jobs older than 1 hour"
}
```

---

## UI Mockup (Text)

```
╔════════════════════════════════════════════════════════════════╗
║  Queue Management Dashboard                          [Refresh] ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        ║
║  │ Supplier Sync│  │Product Family│  │ Image Upload │        ║
║  │              │  │              │  │              │        ║
║  │ ●  Active: 1 │  │ ●  Active: 3 │  │ ●  Active: 10│        ║
║  │    Wait:   0 │  │    Wait:   5 │  │    Wait:   20│        ║
║  │    Failed: 2 │  │    Failed: 1 │  │    Failed: 0 │        ║
║  │              │  │              │  │              │        ║
║  │ [Pause] [▶]  │  │ [Pause] [▶]  │  │ [Pause] [▶]  │        ║
║  └──────────────┘  └──────────────┘  └──────────────┘        ║
║                                                                ║
║  ┌────────────────────────────────────────────────────────┐   ║
║  │ Manual Sync                                            │   ║
║  │ [Select Supplier ▼] [Start Sync]                      │   ║
║  └────────────────────────────────────────────────────────┘   ║
║                                                                ║
║  Active Jobs                                                   ║
║  ┌────────────────────────────────────────────────────────┐   ║
║  │ Job ID               Queue    Status   Progress        │   ║
║  │ supplier-...A360     supplier active   70% (variants)  │   ║
║  │ family-...001        product  active   30% (images)    │   ║
║  │ image-...123         image    active   50% (upload)    │   ║
║  └────────────────────────────────────────────────────────┘   ║
║                                                                ║
║  Failed Jobs                      [Retry All] [Clear Failed]  ║
║  ┌────────────────────────────────────────────────────────┐   ║
║  │ Job ID               Error              Attempts       │   ║
║  │ supplier-...A500     Timeout            3/3  [Retry]   │   ║
║  │ supplier-...A501     API Error          2/3  [Retry]   │   ║
║  └────────────────────────────────────────────────────────┘   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Success Criteria

### Functional Requirements
- ✅ View real-time queue statistics
- ✅ List jobs by queue and state
- ✅ View detailed job information
- ✅ Retry individual failed jobs
- ✅ Retry all failed jobs in a queue
- ✅ Delete individual jobs
- ✅ Pause/resume queues
- ✅ Clean old completed/failed jobs
- ✅ Start manual sync from admin panel

### Non-Functional Requirements
- ✅ Admin-only access (permissions)
- ✅ Real-time updates (< 5 second lag)
- ✅ Responsive UI
- ✅ Error handling and user feedback
- ✅ Performance (handle 1000+ jobs)

---

## Security Considerations

1. **Authentication**: All endpoints require admin authentication
2. **Authorization**: Role-based access control (admin only)
3. **Rate Limiting**: Prevent spam on retry/start sync endpoints
4. **Input Validation**: Validate queue names, job IDs, pagination params
5. **Audit Logging**: Log all queue management actions

---

## Performance Considerations

1. **Pagination**: Default page size of 25, max 100
2. **Caching**: Cache queue stats for 2 seconds
3. **Database Indexes**: Ensure job queries are indexed
4. **Polling Interval**: 5 seconds for stats, 2 seconds for active jobs
5. **Cleanup**: Auto-clean jobs older than 7 days

---

## Future Enhancements (Phase 5+)

1. **WebSocket Updates**: Replace polling with real-time websockets
2. **Job Search**: Full-text search for job data
3. **Metrics Dashboard**: Charts for processing rate, success rate, etc.
4. **Scheduled Syncs**: Cron-based automatic syncs
5. **Alerts**: Email/Slack notifications for failures
6. **Bulk Operations**: Retry/delete multiple jobs at once
7. **Queue Insights**: Processing time trends, bottleneck analysis
8. **Export**: Export job history to CSV

---

## Dependencies

### Backend
- `bullmq` - Already installed (queue operations)
- No new dependencies required

### Frontend (Strapi Admin)
- Strapi admin extensions API
- React (built-in)
- Potentially: `recharts` for future metrics visualization

---

## Implementation Checklist

### Backend API
- [ ] Create queue-manager API structure
- [ ] Implement queue-manager service
- [ ] Create API routes and controllers
- [ ] Add permission checks (admin only)
- [ ] Implement job listing with pagination
- [ ] Implement job retry functionality
- [ ] Implement queue pause/resume
- [ ] Implement queue cleaning
- [ ] Add error handling
- [ ] Test all API endpoints

### Frontend UI
- [ ] Set up admin extension structure
- [ ] Create QueueDashboard component
- [ ] Create QueueCard components
- [ ] Create JobsTable component
- [ ] Create JobDetailsModal
- [ ] Implement polling for real-time updates
- [ ] Add manual sync controls
- [ ] Implement error handling and feedback
- [ ] Style components
- [ ] Test UI functionality

### Documentation
- [ ] API endpoint documentation
- [ ] Admin panel user guide
- [ ] Troubleshooting guide
- [ ] Update PHASE4_COMPLETE.md

---

**Next**: Start with Phase 4A - API Layer implementation

*Last Updated: 2025-10-30*
*Implementation by: Claude Code*
