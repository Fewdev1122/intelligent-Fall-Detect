Intelligent Fall Detection & Risk Prediction System

AI-powered system that not only detects falls from CCTV cameras,
but also predicts fall risk in advance to enable early intervention
and faster emergency response.

Features
Real-time fall detection using AI
Pose detection with YOLOv11n-pose
Fall classification using XGBoost
Risk prediction using mobility trend analysis
Caregiver notification system
EMS coordination dashboard
Real-time location tracking with map
Designed for CCTV and Edge AI devices
System Overview

The system analyzes video from CCTV cameras to detect and predict fall incidents.

Workflow:

Detect human pose and movement
Analyze mobility trends (walking speed, body sway)
Classify fall events
Send alert to caregiver
Caregiver reviews video
Forward to EMS if needed
EMS dispatches response
Project Structure
Fall_Detect/
├── ai/        # AI models, training, feature extraction
├── edge/      # Real-time detection and alert system
├── backend/   # APIs and Firebase integration
├── web/       # Caregiver & EMS dashboards (Next.js)
├── models/    # Trained models
└── requirements.txt
Tech Stack

AI & Data

Python
YOLOv11n-pose
XGBoost
OpenCV
Computer Vision
Machine Learning

System

Edge AI
REST API

Frontend

Next.js
React

Backend

Firebase

Integration

Google Maps API
Model Performance
Accuracy: ~91%
Precision: ~88%
Recall: ~95%

The model is optimized to prioritize recall, ensuring reliable detection
and minimizing missed fall incidents in real-world scenarios.

Privacy & Safety
Video processing is handled on edge devices
Only essential data is transmitted
Designed for real-time emergency response
Ensures both privacy and reliability
Impact

This system improves safety for elderly people living alone by reducing
response time in emergencies. By predicting risks in advance, it enables
early intervention and can potentially save lives.

Innovation
Goes beyond detection → predicts fall risk
Combines AI, alerts, and EMS in one system
Uses Edge AI for real-time and privacy
Target Users
Elderly people living alone
Caregivers and family
Emergency response teams (EMS)
Healthcare providers
Future Work
Early fall prediction (before fall happens)
Improve model accuracy with more data
Integrate wearable sensors
Expand to other health emergencies
Installation
git clone https://github.com/Fewdev1122/intelligent-Fall-Detect.git
cd intelligent-Fall-Detect
pip install -r requirements.txt
python -m edge.camera
Summary

From fall detection → risk prediction → emergency response,
this system transforms reactive monitoring into proactive safety.
