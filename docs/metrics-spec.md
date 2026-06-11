# **metrics-spec.md**

# **Public Speaking Coach**

## **Metrics Specification v2.0**

Version: 2.0  
Status: Approved for MVP

---

# **Purpose**

This document defines every metric used by the Public Speaking Coach platform.

The Metrics Engine is the core intellectual property of the product.

Every metric must be:

* Objective  
* Explainable  
* Deterministic  
* Reproducible  
* Versioned

If a metric cannot satisfy these requirements, it must not be implemented.

---

# **Global Metric Rules**

## **Rule 1**

Metrics must be deterministic.

Same input:

Same output.

Always.

---

## **Rule 2**

Metrics must be formula-based.

AI is not allowed to calculate metrics.

AI may only interpret metrics.

---

## **Rule 3**

Every metric must have:

* Metric ID  
* Version  
* Inputs  
* Formula  
* Output  
* Confidence  
* Limitations

---

## **Rule 4**

Every metric must define failure conditions.

If required inputs are unavailable:

Metric must return:

{

  "status": "unavailable"

}

instead of an incorrect score.

---

## **Rule 5**

Metric formulas must never be silently modified.

Changes require:

* New version  
* Migration strategy  
* Documentation update

---

# **Confidence Definitions**

## **Very High**

Expected reliability:

95%+

Examples:

* Speaking Pace  
* Filler Usage

---

## **High**

Expected reliability:

85–95%

Examples:

* Pause Quality  
* Posture Stability

---

## **Medium**

Expected reliability:

70–85%

Examples:

* Camera Engagement

---

## **Low**

Expected reliability:

Below 70%

Not allowed in MVP.

---

# **Metric Status Definitions**

## **Stable**

Approved for production.

---

## **Experimental**

Available for testing.

Not used for critical feedback.

---

# **Metric Categories**

## **Speech Metrics**

SPK-001 Speaking Pace

SPK-002 Filler Usage

SPK-003 Pause Quality

---

## **Vision Metrics**

VIS-001 Camera Engagement

VIS-002 Posture Stability

---

# **SPK-001 Speaking Pace**

## **Status**

Stable

## **Version**

v1

## **Purpose**

Measure speaking speed.

---

## **Dependencies**

* Transcript  
* Session Duration

---

## **Inputs**

Transcript

Speech Duration (seconds)

---

## **Formula**

Words Spoken

÷

Speaking Minutes

---

## **Example**

Words:

750

Duration:

5 minutes

Result:

150 WPM

---

## **Output**

Type:

Number

Unit:

Words Per Minute

Range:

0–300

---

## **Target Range**

Excellent:

140–160 WPM

Good:

120–139 WPM

161–180 WPM

Needs Improvement:

Below 120 WPM

Above 180 WPM

---

## **Confidence**

Very High

---

## **Failure Conditions**

No transcript

Session duration below 10 seconds

Speech recognition failure

---

## **Limitations**

Speaking style varies by context.

Fast speakers can still be effective.

---

# **SPK-002 Filler Usage**

## **Status**

Stable

## **Version**

v1

## **Purpose**

Measure unnecessary filler word usage.

---

## **Dependencies**

Transcript

---

## **Inputs**

Transcript

Filler Dictionary

---

## **Filler Dictionary v1**

* um  
* uh  
* like  
* actually  
* basically  
* you know  
* so

---

## **Formula**

Filler Count

÷

Total Words Spoken

× 100

---

## **Example**

Words:

500

Fillers:

10

Result:

2%

---

## **Output**

Type:

Percentage

Range:

0–100

---

## **Target Range**

Excellent:

0–1%

Good:

1–2%

Fair:

2–3%

Poor:

Above 3%

---

## **Confidence**

Very High

---

## **Failure Conditions**

Transcript unavailable

Speech recognition failure

---

## **Limitations**

Regional language patterns vary.

Some fillers may be contextually valid.

---

# **SPK-003 Pause Quality**

## **Status**

Stable

## **Version**

v1

## **Purpose**

Measure usage of speaking pauses.

---

## **Dependencies**

Speech timestamps

Audio stream

---

## **Inputs**

Audio timestamps

Speech activity timeline

---

## **Detection Rule**

Silence duration

500 milliseconds

creates a pause event.

---

## **Measurements**

Pause Count

Average Pause Duration

Longest Pause

---

## **Output**

Type:

Composite Metric

---

## **Target Range**

Average Pause Duration:

0.5–2.0 seconds

---

## **Confidence**

High

---

## **Failure Conditions**

Audio unavailable

Timestamp generation failure

---

## **Limitations**

Cannot determine rhetorical intent.

Cannot distinguish intentional pauses from thinking pauses.

---

# **VIS-001 Camera Engagement**

## **Status**

Stable

## **Version**

v1

## **Purpose**

Measure how often the speaker faces the camera.

This metric does NOT represent actual eye contact.

---

## **Dependencies**

MediaPipe Face Landmarker

Head Pose Estimation

---

## **Inputs**

Yaw

Pitch

Roll

---

## **Camera Facing Rule**

Facing Camera:

Yaw \< 15°

Pitch \< 15°

---

## **Formula**

Camera Facing Frames

÷

Total Frames

× 100

---

## **Example**

Total Frames:

9000

Facing Frames:

7200

Result:

80%

---

## **Output**

Type:

Percentage

Range:

0–100

---

## **Target Range**

Excellent:

80–100%

Good:

60–79%

Fair:

40–59%

Poor:

Below 40%

---

## **Confidence**

Medium

---

## **Failure Conditions**

No face detected

MediaPipe failure

Face visible less than 30% of session

---

## **Limitations**

Does not represent true audience eye contact.

Assumes camera acts as audience proxy.

---

# **VIS-002 Posture Stability**

## **Status**

Stable

## **Version**

v1

## **Purpose**

Measure posture consistency during speaking.

---

## **Dependencies**

MediaPipe Pose Landmarker

---

## **Inputs**

Nose

Left Shoulder

Right Shoulder

Left Hip

Right Hip

Left Ear

Right Ear

---

## **Components**

### **Shoulder Alignment**

Weight:

30%

---

### **Head Alignment**

Weight:

20%

---

### **Body Lean**

Weight:

30%

---

### **Body Sway**

Weight:

20%

---

## **Formula**

Weighted Composite Score

Shoulder Alignment × 0.30

* 

Head Alignment × 0.20

* 

Body Lean × 0.30

* 

Body Sway × 0.20

---

## **Output**

Type:

Score

Range:

0–100

---

## **Target Range**

Excellent:

85–100

Good:

70–84

Fair:

50–69

Poor:

Below 50

---

## **Confidence**

High

---

## **Failure Conditions**

Pose landmarks unavailable

Speaker visible less than 30% of session

MediaPipe failure

---

## **Limitations**

Cannot determine intent behind movement.

Cannot distinguish stage movement from instability.

---

# **Forbidden Metrics**

The following metrics are prohibited:

* Confidence Score  
* Charisma Score  
* Leadership Score  
* Executive Presence Score  
* Persuasiveness Score  
* Trustworthiness Score  
* Audience Engagement Score  
* Passion Score  
* Authenticity Score

Reason:

These metrics cannot be objectively measured.

---

# **OpenAI Rules**

OpenAI receives:

* Metrics  
* Transcript  
* Session Summary

OpenAI generates:

* Strengths  
* Weaknesses  
* Recommendations

OpenAI never generates metric values.

---

# **Versioning Policy**

Every metric must be versioned.

Examples:

* Speaking Pace v1  
* Speaking Pace v2

Historical sessions must preserve the version used at the time of calculation.

Metric versions must never be overwritten.

---

# **Future Metrics (Post-MVP)**

Potential future metrics:

* Gesture Activity  
* Vocal Variety  
* Energy Variation  
* Presentation Structure Analysis

These metrics require separate validation before approval.

---

# **Final Principle**

MediaPipe provides signals.

Metrics Engine converts signals into facts.

OpenAI converts facts into coaching.

The quality of the product depends on the quality of the Metrics Engine.

