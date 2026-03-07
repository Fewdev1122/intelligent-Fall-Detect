Intelligent Fall Detection System

AI-powered fall detection system that monitors CCTV cameras to detect fall incidents and notify caregivers and emergency services.

Features

Real-time fall detection using AI

Pose detection with YOLOv11n-pose

Fall classification using XGBoost

Caregiver notification system

EMS coordination dashboard

Works with CCTV cameras

System Overview

The system analyzes video from CCTV cameras to detect possible fall incidents.

When a fall is detected:

AI detects human pose and movement

Fall classification is performed

Notification is sent to caregiver

Caregiver reviews fall video

If needed, the case is forwarded to EMS

EMS dispatches emergency response

Tech Stack

Python

YOLOv11n-pose

XGBoost

OpenCV

Next.js

Firebase

Edge AI

Computer Vision

Installation

Clone the repository

git clone https://github.com/Fewdev1122/Fall-Detect-with-YOLO11n-pose.git
cd Fall-Detect-with-YOLO11n-pose

Install dependencies

pip install -r requirements.txt

Run the system

python main.py
Project Structure
Fall_Detect/
│
├── ai/                # AI model and training
├── backend/           # backend services
├── edge/              # edge AI processing
├── web/               # Next.js web application
├── models/            # trained models
├── README.md
