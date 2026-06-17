# **tasks.md**

# **Public Speaking Coach**

## **Execution Plan**

Version: 1.0

---

# **Epic 0 — Repository Setup**

Goal:

Create a production-ready monorepo foundation.

---

## **TASK-0001**

Create monorepo structure.

Acceptance Criteria:

* apps/web created  
* apps/api created  
* docs created  
* packages created

---

## **TASK-0002**

Initialize Next.js application.

Acceptance Criteria:

* Next.js latest  
* TypeScript  
* App Router  
* ESLint configured

---

## **TASK-0003**

Configure Tailwind CSS.

Acceptance Criteria:

* Tailwind installed  
* Base styles working

---

## **TASK-0004**

Install shadcn/ui.

Acceptance Criteria:

* Components available  
* Theme configured

---

## **TASK-0005**

Setup FastAPI application.

Acceptance Criteria:

* Health endpoint available  
* Project structure created

---

## **TASK-0006**

Configure PostgreSQL connection.

Acceptance Criteria:

* Local connection working  
* Environment variables configured

---

## **TASK-0007**

Setup Alembic migrations.

Acceptance Criteria:

* Migration generation working

---

## **TASK-0008**

Configure Clerk authentication.

Acceptance Criteria:

* Login  
* Logout  
* Session validation

---

## **TASK-0009**

Configure CI pipeline.

Acceptance Criteria:

* Lint  
* Type check  
* Build

executed automatically.

---

# **Epic 1 — Session Foundation**

Goal:

Allow users to create and manage speaking sessions.

---

## **TASK-1001**

Create session state machine.

States:

* IDLE  
* STARTING  
* ACTIVE  
* STOPPING  
* COMPLETED  
* FAILED

---

## **TASK-1002**

Implement webcam permissions.

Acceptance Criteria:

* Permission request  
* Error handling

---

## **TASK-1003**

Implement microphone permissions.

Acceptance Criteria:

* Permission request  
* Error handling

---

## **TASK-1004**

Create session controls.

Acceptance Criteria:

* Start button  
* Stop button  
* Status indicator

---

## **TASK-1005**

Create session timer.

Acceptance Criteria:

* Accurate timing  
* Pause safe

---

# **Epic 2 — Speech Analytics**

Goal:

Generate speech metrics.

---

## **TASK-2001**

Implement speech recognition service.

Acceptance Criteria:

* Transcript generated  
* Live updates

---

## **TASK-2002**

Implement Speaking Pace calculator.

Reference:

metrics-spec.md

Metric:

SPK-001

Acceptance Criteria:

* WPM calculation  
* Unit tests

---

## **TASK-2003**

Implement Filler Usage calculator.

Reference:

SPK-002

Acceptance Criteria:

* Dictionary support  
* Percentage calculation  
* Unit tests

---

## **TASK-2004**

Implement Pause Quality calculator.

Reference:

SPK-003

Acceptance Criteria:

* Pause detection  
* Duration tracking  
* Unit tests

---

# **Epic 3 — Vision Analytics**

Goal:

Generate visual metrics.

---

## **TASK-3001**

Integrate MediaPipe Face Landmarker.

Acceptance Criteria:

* Face landmarks available

---

## **TASK-3002**

Integrate MediaPipe Pose Landmarker.

Acceptance Criteria:

* Pose landmarks available

---

## **TASK-3003**

Implement Camera Engagement calculator.

Reference:

VIS-001

Acceptance Criteria:

* Head pose estimation  
* Percentage calculation  
* Unit tests

---

## **TASK-3004**

Implement Posture Stability calculator.

Reference:

VIS-002

Acceptance Criteria:

* Shoulder alignment  
* Head alignment  
* Body lean  
* Body sway  
* Unit tests

---

# **Epic 4 — Metrics Engine**

Goal:

Create centralized metric processing.

---

## **TASK-4001**

Create MetricResult contract.

Acceptance Criteria:

* Shared type created

---

## **TASK-4002**

Create metric registry.

Acceptance Criteria:

* Metric discovery  
* Version tracking

---

## **TASK-4003**

Create metric validator.

Acceptance Criteria:

* Range validation  
* Error handling

---

## **TASK-4004**

Create metric persistence model.

Acceptance Criteria:

* Metrics stored correctly

---

# **Epic 5 — Dashboard**

Goal:

Display analytics.

---

## **TASK-5001**

Build live metrics panel.

Acceptance Criteria:

* Real-time updates

---

## **TASK-5002**

Build session summary page.

Acceptance Criteria:

* All metrics visible

---

## **TASK-5003**

Build metric explanation cards.

Acceptance Criteria:

* Formula explanation  
* User-friendly descriptions

---

# **Epic 6 — Backend APIs**

Goal:

Persist application data.

---

## **TASK-6001**

Create session endpoints.

Endpoints:

POST /sessions

GET /sessions

GET /sessions/:id

---

## **TASK-6002**

Create metric endpoints.

Endpoints:

POST /metrics

GET /metrics

---

## **TASK-6003**

Create report endpoints.

Endpoints:

POST /reports

GET /reports/:id

---

# **Epic 7 — AI Reports**

Goal:

Generate coaching feedback.

---

## **TASK-7001**

Create report prompt builder.

Acceptance Criteria:

* Uses metrics  
* Uses transcript

---

## **TASK-7002**

Integrate OpenAI.

Acceptance Criteria:

* Report generated successfully

---

## **TASK-7003**

Create report renderer.

Acceptance Criteria:

* Strengths  
* Weaknesses  
* Recommendations

---

# **Epic 8 — History & Progress**

Goal:

Track improvement over time.

---

## **TASK-8001**

Create session history page.

Acceptance Criteria:

* Previous sessions visible

---

## **TASK-8002**

Create progress charts.

Acceptance Criteria:

* Metric trends displayed

---

## **TASK-8003**

Create comparison view.

Acceptance Criteria:

* Session-to-session comparison

---

# **Epic 9 — Production Readiness**

Goal:

Launch-ready application.

---

## **TASK-9001**

Add error monitoring.

Acceptance Criteria:

* Frontend errors tracked  
* Backend errors tracked

---

## **TASK-9002**

Add analytics.

Acceptance Criteria:

* Session starts tracked  
* Session completions tracked

---

## **TASK-9003**

Security review.

Acceptance Criteria:

* Authorization verified  
* Secrets protected

---

## **TASK-9004**

Performance review.

Acceptance Criteria:

* Supports 100 concurrent users

---

## **TASK-9005**

Production deployment.

Acceptance Criteria:

Frontend:

* Vercel deployment

Backend:

* Railway deployment

Database:

* Neon deployment

---

# **MVP Release Checklist**

Users can:

✓ Register

✓ Login

✓ Start session

✓ End session

✓ Receive speech analytics

✓ Receive visual analytics

✓ Receive AI coaching

✓ View history

✓ Track progress

Only after all items pass is MVP considered complete.

---

# **Follow-up Tasks**

## **TASK-3005**

Align session startup tests with the MediaPipe-before-ACTIVE contract.

Acceptance Criteria:

* `webcam-permission.test.ts` injects mock vision services for session-start tests  
* Session-start assertions reflect vision initialization before `ACTIVE`  
* Session test doubles cover the current startup contract without relying on default MediaPipe browser setup
