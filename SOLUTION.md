# Solution Documentation

## Part 1: Performance Optimization

### 1. Database Query Efficiency (N+1 Problem)

* **Issue**: The `findAll` method in `TasksService` was fetching all tasks and then iterating over them to fetch relations (`assignee`, `project`, `tags`) one by one. This caused `1 + 3N` queries.
* **Solution**: Refactored `findAll` to use Prisma's `include` feature, fetching the task and all its relations in a single database query.
* **Impact**: Drastically reduced database round-trips, changing complexity from O(N) to O(1).

### 2. Database-Level Filtering

* **Issue**: Filtering was performed in JavaScript after fetching the entire dataset from the database. This meant fetching thousands of rows only to discard most of them.
* **Solution**: Moved all filtering logic (status, priority, assignee, dates) into the `where` clause of the Prisma `findMany` query.
* **Impact**: Reduced memory usage and network transfer; database only returns relevant records.

### 3. Database Indexing

* **Issue**: There were no indexes on frequently queried columns (`status`, `priority`, `assigneeId`, `projectId`, `dueDate`).
* **Solution**: Added `@@index` to the `Task` model in `prisma/schema.prisma` for these fields.
* **Impact**: Significantly faster search and filtering operations by allowing the database to use indexes instead of full table scans.

### 4. Asynchronous Operations

* **Issue**: The `EmailService` (simulated as slow) was being `await`ed in `create` and `update` methods, blocking the HTTP response for ~2 seconds.
* **Solution**: Removed `await` from email service calls to make them non-blocking ("fire and forget").
* **Impact**: Immediate API response times for task creation and updates.

### 5. Caching

* **Solution**: Implemented Redis caching for the `GET /tasks` endpoint using NestJS `CacheInterceptor` with a short TTL (10 seconds).
* **Impact**: Reduced database load for frequent identical requests (e.g., multiple users viewing the same task list).

## Part 2: Activity Log Feature

### Implementation Approach

The overall approach involved extending the existing Task management API to track and log changes to tasks. This was achieved by:

1. **Schema Extension**: Creating a new `Activity` model in Prisma to store change details.
2. **User Context**: Introducing a `x-user-id` header to identify the user performing the actions.
3. **Service Interception**: Modifying the `TasksService` methods (`create`, `update`, `remove`) to intercept task changes, calculate deltas, and persist activity records.
4. **Dedicated Module**: Developing an `ActivitiesModule` with its own service and controller to expose new API endpoints for retrieving activity logs.

### Database Schema Design

* **`Activity` Model**: A new model was added to `prisma/schema.prisma` with the following fields:
  * `id`: Unique identifier (UUID).
  * `action`: String (e.g., "created", "updated", "deleted") to denote the type of change.
  * `changes`: JSON type to store detailed old and new values of fields that were modified.
  * `createdAt`: Timestamp of the activity.
  * `taskId`: Foreign key to `Task` (nullable with `onDelete: SetNull` to handle task deletion).
  * `taskTitle`: Stored directly to maintain context even if the task is deleted.
  * `userId`: Foreign key to `User` to identify the actor.
* **Relationships**:
  * `Activity` is related to `Task` (many-to-one).
  * `Activity` is related to `User` (many-to-one).
* **Rationale**: This design ensures that activity records are self-contained and retain necessary context, even if related tasks or users are removed. The `JSON` type for `changes` offers flexibility for varying change payloads.

### API Design Decisions

* **User Identification**: Given the absence of a full authentication system, the `x-user-id` HTTP header was used to pass the user ID for activity logging. This was extracted in `TasksController` and passed to the `TasksService`.
* **Activity Endpoints**:
  * `GET /tasks/:id/activities`: Provides a paginated list of activities for a specific task.
  * `GET /activities`: Offers a global, paginated view of all activities, with support for filtering by `userId`, `action`, and `date range` (`from`, `to`).
* **Pagination**: Both activity endpoints support pagination via `page` and `limit` query parameters, returning a `meta` object with total counts and page information.
* **Response Format**: Activity responses adhere to a standardized format including `id`, `taskId`, `taskTitle`, `userId`, `userName`, `action`, `changes`, and `createdAt`.

### Performance Considerations

* **Database Indexes**: Relevant indexes were added to the `Task` model (as part of Part 1) to ensure efficient retrieval of tasks, which indirectly benefits the activity logging by speeding up task lookups during change tracking.
* **Activity Query Optimization**: The `ActivitiesService` uses Prisma's `findMany` with `where`, `skip`, `take`, and `orderBy` clauses to efficiently query and paginate activities directly in the database. `Promise.all` is used for concurrent fetching of data and total count.
* **Relationship Includes**: The `include: { user: { select: { id: true, name: true, email: true } } }` ensures that user details are fetched with activities in a single query, avoiding N+1.

### Trade-offs and Assumptions

* **Authentication**: Assumed `x-user-id` header is provided by the client/gateway since a robust authentication system was not part of the assignment scope. In a production environment, this would be replaced by authenticated user context.

* **Email Reliability**: The "fire and forget" approach for email notifications (removing `await`) means that if the server crashes immediately after processing a task update but before the email promise resolves, the email might not be sent. For critical notifications, a message queue should be used.

* **Caching Scope**: The current caching strategy for `GET /tasks` is a simple `CacheInterceptor`. More sophisticated cache invalidation might be needed in a complex system (e.g., invalidating cache entries for specific task filters when a task is updated).

## Improvements Implemented

### 1. Transactional Integrity

* **Solution**: Wrapped task creation, update, and deletion operations, along with their corresponding activity logging, within Prisma transactions (`prisma.$transaction`).

* **Impact**: Ensures atomicity. If any part of the task modification or activity logging fails, the entire transaction is rolled back, preventing data inconsistencies (e.g., a task being updated without a corresponding activity log entry). Email notifications were moved outside the transaction as they are fire-and-forget.

### 2. Robust Header Validation (`x-user-id`)

* **Solution**: Implemented a `UserIdGuard` that validates the presence and format (UUID) of the `x-user-id` header for task creation, update, and deletion endpoints.

* **Impact**: Centralizes and enforces user ID validation, providing immediate feedback to the client (BadRequestException) if the header is missing or invalid. This prevents downstream errors in activity logging and enhances API robustness.

### 3. Structured Logging

* **Solution**: Replaced `console.error` calls with NestJS's built-in `Logger` service (`this.logger.error`) for email notification failures in `TasksService`. The `Logger` was provided in `TasksModule`.
* **Impact**: Promotes consistent log formatting, enables different log levels, and allows for easier integration with external logging systems, improving observability and debugging capabilities.

### 4. Refined Diffing Logic

* **Solution**: Extracted diffing logic into a reusable utility (`src/common/utils/diff.util.ts`) with specific functions for simple fields, dates, and arrays. Refactored `TasksService.update` to use these utilities.
* **Impact**: Reduces code duplication and complexity in `TasksService`. Makes the diffing logic testable in isolation and easier to extend for future models or fields.

## Future Improvements

* Integrate a dedicated job queue (e.g., BullMQ) for asynchronous operations like email sending and activity logging to ensure reliability and further decouple these processes from the main request flow.

* Enhance caching strategy with more granular invalidation mechanisms based on task updates (e.g., clearing cache related to a specific task or filter when a task is modified).

* Add more descriptive fields to the `meta` object for pagination (e.g., `currentPage`, `itemsPerPage`, `hasNextPage`, `hasPreviousPage`). This would provide clients with more comprehensive information about the paginated results.
* Add more extensive unit and integration tests for the new Activity module and the modified TasksService methods.

## Time Spent

* **Part 1: Performance Optimization**: ~3 hours
* **Part 2: Activity Log Feature**: ~1 hour
