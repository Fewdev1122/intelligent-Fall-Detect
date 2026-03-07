# Intelligent Fall Detection System

AI-powered fall detection system that monitors CCTV cameras to detect fall incidents and notify caregivers and emergency services.

---

## Features

- Real-time fall detection using AI
- Pose detection with **YOLOv11n-pose**
- Fall classification using **XGBoost**
- Caregiver notification system
- EMS coordination dashboard
- Works with CCTV cameras

---

## System Overview

The system analyzes video from CCTV cameras to detect possible fall incidents.

When a fall is detected:

1. AI detects human pose and movement  
2. Fall classification is performed  
3. Notification is sent to caregiver  
4. Caregiver reviews fall video  
5. If needed, the case is forwarded to EMS  
6. EMS dispatches emergency response  

---

## Tech Stack

- Python
- YOLOv11n-pose
- XGBoost
- OpenCV
- Next.js
- Firebase
- Edge AI
- Computer Vision

---

## Installation

Clone the repository

```bash
git clone https://github.com/Fewdev1122//intelligent-Fall-Detect.git
cd intelligent-Fall-Detect

Install dependencies

pip install -r requirements.txt

Run the system

python -m edge.camera.py
Project Structure
Fall_Detect/
│
├── ai/                # AI model and training
├── backend/           # backend services
├── edge/              # edge AI processing
├── web/               # Next.js web application
├── models/            # trained models
├── README.md
