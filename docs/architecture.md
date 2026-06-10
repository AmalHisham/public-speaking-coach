# **architecture.md**

# **Public Speaking Coach**

## **Architecture Specification v2.0**

Version: 2.0  
Status: Approved for MVP

---

# **Purpose**

This document defines the system architecture for the Public Speaking Coach platform.

It serves as the authoritative reference for:

* Frontend architecture  
* Backend architecture  
* Data flow  
* Service boundaries  
* Deployment architecture

All implementation must follow this document.

---

# **Architecture Principles**

## **Principle 1**

Browser-first analytics.

Audio and video processing occur in the user's browser whenever possible.

---

## **Principle 2**

Raw video is not continuously streamed to the backend.

Only metrics, transcripts, and session data are transmitted.

---

## **Principle 3**

Metrics are generated locally.

The backend validates and stores metrics.

The backend does not recalculate metrics.

---

## **Principle 4**

OpenAI interprets metrics.

OpenAI does not generate metrics.

---

## **Principle 5**

Metrics and reports are separate domains.

Metrics are facts.

Reports are interpretations.

---

# **High-Level System Architecture**

User

 │

 ▼

Browser (Next.js)

 │

 ├── Camera

 ├── Microphone

 ├── MediaPipe Face

 ├── MediaPipe Pose

 ├── Speech Recognition

 └── Metrics Engine

 │

 ▼

FastAPI Backend

 │

 ├── Authentication

 ├── Session Service

 ├── Metrics Service

 ├── Report Service

 └── PostgreSQL

 │

 ▼

OpenAI

 │

 ▼

Coaching Report

---

# **Repository Architecture**

Repository Type:

Monorepo

public-speaking-coach/

├── apps/

│   ├── web/

│   └── api/

│

├── docs/

│

├── packages/

│

├── scripts/

│

├── docker/

│

└── .github/

---

# **Application Responsibilities**

## **apps/web**

Technology:

* Next.js  
* TypeScript  
* Tailwind  
* Zustand  
* MediaPipe

Responsibilities:

* Session management  
* Camera access  
* Microphone access  
* Speech recognition  
* MediaPipe processing  
* Metric calculation  
* Dashboard UI  
* Report display

---

## **apps/api**

Technology:

* FastAPI  
* PostgreSQL  
* SQLAlchemy  
* Alembic

Responsibilities:

* Authentication  
* Session persistence  
* Metric validation  
* Metric storage  
* Report generation  
* Historical analytics

---

# **System Context Diagram**

User

 │

 ▼

Web Application

 │

 ├── MediaPipe

 ├── Speech Recognition

 └── Metrics Engine

 │

 ▼

API

 │

 ├── Database

 └── OpenAI

---

# **Session Lifecycle**

## **State Machine**

IDLE

↓

STARTING

↓

ACTIVE

↓

STOPPING

↓

COMPLETED

Failure Path:

STARTING

↓

FAILED

or

ACTIVE

↓

FAILED

---

# **Session Start Flow**

User Clicks Start

↓

Camera Permission

↓

Microphone Permission

↓

MediaPipe Initialization

↓

Speech Recognition Initialization

↓

Session Created

↓

ACTIVE

---

# **Active Session Flow**

During session:

Camera

 ↓

MediaPipe

 ↓

Landmarks

 ↓

Metrics Engine

 ↓

Live Metrics

and

Microphone

 ↓

Speech Recognition

 ↓

Transcript

 ↓

Speech Metrics

Dashboard updates in real time.

---

# **Session End Flow**

User Clicks Stop

↓

Stop Camera

↓

Stop Microphone

↓

Finalize Transcript

↓

Finalize Metrics

↓

Save Session

↓

Generate Report

↓

Display Results

---

# **Data Flow**

## **Speech Pipeline**

Microphone

↓

Speech Recognition

↓

Transcript

↓

Speaking Pace

↓

Filler Usage

↓

Pause Quality

---

## **Vision Pipeline**

Camera

↓

MediaPipe Face

↓

Head Pose

↓

Camera Engagement

---

Camera

↓

MediaPipe Pose

↓

Landmarks

↓

Posture Stability

---

## **Report Pipeline**

Metrics

\+

Transcript

↓

Backend

↓

OpenAI

↓

Report

↓

User

---

# **Metrics Architecture**

The Metrics Engine is the core product system.

Raw Signals

↓

Feature Extractors

↓

Metric Calculators

↓

Metric Validators

↓

Metric Results

---

# **Metric Categories**

Speech Metrics

* Speaking Pace  
* Filler Usage  
* Pause Quality

Vision Metrics

* Camera Engagement  
* Posture Stability

---

# **Metric Rules**

Metrics must be:

* Deterministic  
* Explainable  
* Versioned  
* Testable

AI is prohibited from calculating metrics.

---

# **Frontend Architecture**

apps/web/src

├── app/

├── components/

├── features/

├── hooks/

├── services/

├── stores/

├── types/

├── lib/

├── config/

├── constants/

└── utils/

---

# **Frontend Feature Domains**

## **auth**

Authentication.

---

## **session**

Session lifecycle.

---

## **speech**

Speech analysis.

---

## **vision**

MediaPipe integration.

---

## **metrics**

Metric calculators.

Core product IP.

---

## **reports**

Report rendering.

---

## **history**

Progress tracking.

---

# **Backend Architecture**

apps/api/app

├── api/

├── core/

├── services/

├── repositories/

├── models/

├── schemas/

├── db/

├── integrations/

└── utils/

---

# **Backend Layer Responsibilities**

## **api**

Request handling.

No business logic.

---

## **services**

Business logic.

---

## **repositories**

Database access.

---

## **models**

Database entities.

---

## **schemas**

Request and response contracts.

---

## **integrations**

External systems.

Example:

OpenAI.

---

# **Database Architecture**

Primary Database:

PostgreSQL

---

# **Core Entities**

## **User**

Represents platform user.

---

## **Session**

Represents speaking session.

---

## **Transcript**

Stores transcript data.

---

## **Metric**

Stores metric results.

---

## **Report**

Stores AI-generated feedback.

---

# **OpenAI Architecture**

OpenAI receives:

* Metrics  
* Transcript  
* Session Summary

OpenAI returns:

* Strengths  
* Weaknesses  
* Recommendations

OpenAI does not:

* Generate metrics  
* Modify metrics  
* Recalculate metrics

---

# **Error Handling**

System must gracefully handle:

* Camera unavailable  
* Microphone unavailable  
* Face not detected  
* Pose not detected  
* Speech recognition failure  
* OpenAI failure  
* Database failure

Failures must not crash the application.

---

# **Security Architecture**

Authentication required.

Users can only access:

Their own sessions.

---

Secrets:

* OpenAI keys  
* Database credentials  
* Clerk secrets

must remain server-side.

---

All API inputs must be validated.

---

# **Scalability Targets**

MVP Target:

100 concurrent users

---

Target After Validation:

1000+ concurrent users

---

Scalability is achieved through:

* Browser-side processing  
* Minimal backend computation  
* Lightweight API requests

---

# **Deployment Architecture**

Frontend:

Vercel

Root Directory:

apps/web

---

Backend:

Railway

Root Directory:

apps/api

---

Database:

Neon PostgreSQL

---

# **Observability**

Track:

* Session starts  
* Session completions  
* Metric failures  
* OpenAI failures  
* API latency  
* Database latency

---

# **Explicit Non-Goals**

The MVP will NOT support:

* Live coaching  
* Video uploads  
* Team dashboards  
* Coach accounts  
* Multi-user sessions  
* Enterprise analytics

These belong to future releases.

---

# **Final Principle**

MediaPipe is the sensor.

Metrics Engine is the product.

OpenAI is the narrator.

The value of the platform comes from reliable and explainable metrics.

