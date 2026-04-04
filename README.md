# 🌱 IoT Smart Farming Ecosystem

A comprehensive AIoT platform for smart agriculture. The system integrates IoT devices (YOLO:bit, sensors, actuators), an MQTT message broker (Adafruit IO), a FastAPI backend with Machine Learning capabilities, and a modern React dashboard.

## 1. Overview

The ecosystem provides real-time monitoring of environmental conditions, remote manual and automated control of farm equipment, and advanced AI predictions to optimize farming operations.

* **Devices (Edge):** YOLO:bit + DHT20, Soil Moisture, Light sensors, Water Pump, LED
* **Cloud & Messaging:** Adafruit IO (MQTT Broker)
* **Backend:** FastAPI (Python) + Websockets + XGBoost/CNN models
* **Frontend:** React + Vite

## 2. Features

* 📊 **Real-time Dashboard:** Monitor temperature, humidity, soil moisture, and light intensity with live charts.
* 🎛️ **Control Panel:** Turn on/off water pumps and LEDs manually, or toggle automation modes.
* 🧠 **Smart Watering Prediction:** Uses an XGBoost Machine Learning model to calculate the optimal amount of water required based on current environmental sensors and plant stage.
* 🍃 **Plant Disease Detection:** Uses a Convolutional Neural Network (CNN) model (trained on the New Plant Diseases Dataset) to analyze uploaded images and classify 38 different plant conditions.
* ⚡ **Live Synchronization:** Seamless updates across all web clients via WebSockets connected to the MQTT broker.

## 3. High-level Architecture

```text
[ YOLO:bit (Sensors & Actuators) ]
            ↓ ↑ MQTT
[ Adafruit IO (Broker + Storage) ]
            ↓ ↑ REST / MQTT
[ Backend (FastAPI & ML Models) ]
            ↓ ↑ REST API / WebSocket
[ Frontend (React Dashboard) ]
```

## 4. How to run the project

### Prerequisites
* Python 3.8+
* Node.js 16+ & npm
* Adafruit IO account (with API Key & Username)

### Environment Setup

1. **Backend (FastAPI)**
   ```bash
   cd src/backend
   
   # Create and activate virtual environment
   python -m venv venv
   source venv/Scripts/activate  # on Windows
   # or `source venv/bin/activate` on macOS/Linux
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Configure environment variables
   # Create a .env file and add your credentials:
   # ADAFRUIT_IO_USERNAME=your_username
   # ADAFRUIT_IO_KEY=your_aio_key
   
   # Start the backend server
   uvicorn main:app --reload --port 8000
   ```

2. **Frontend (React)**
   ```bash
   cd src/frontend
   
   # Install dependencies
   npm install
   
   # Start the development server
   npm run dev
   ```

3. **Access the application**
   * Frontend Dashboard: `http://localhost:5173`
   * Backend API / Swagger Docs: `http://localhost:8000/docs`

## 5. AI Capabilities Details

### Smart Watering Prediction (XGBoost)
The model analyzes temperature, humidity, soil moisture, light intensity, rainfall, soil type, and crop growth stage to output a precise automated watering recommendation (in ml).
* Location: `src/backend/AI_modules/Watering_prediction`

### Plant Disease Detection (CNN - Keras)
Trained utilizing the [Kaggle New Plant Diseases Dataset](https://www.kaggle.com/datasets/vipoooool/new-plant-diseases-dataset). Upload leaf pictures to get realtime classifications and confidence scores for 38 classes indicating health or various types of diseases.
* Location: `src/backend/AI_modules/Plant_disease_detection`

## 6. Future Improvements

* 📱 Mobile Application (React Native / Flutter)
* 🚀 Edge AI Inference (Running TinyML directly on YOLO:bit)
* 🔔 Push Notifications for critical alerts
* 🌐 Custom independent MQTT Broker (Mosquitto) for enterprise scaling

---
*Built with ❤️ for Modern Agriculture.*
