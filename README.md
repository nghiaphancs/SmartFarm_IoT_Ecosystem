# 🌱 IoT Smart Farming System Architecture

## 1. Overview

Hệ thống là một nền tảng IoT hoàn chỉnh cho nông nghiệp thông minh, bao gồm:

* Thiết bị: YOLO:bit + cảm biến
* Cloud MQTT: Adafruit IO
* Backend: FastAPI
* Frontend: React Dashboard

---

## 2. High-level Architecture

```
YOLO:bit (Sensors & Actuators)
        ↓ MQTT
Adafruit IO (Broker + Storage)
        ↓ REST / MQTT
Backend (FastAPI)
        ↓ API
Frontend (React)
```

---

## 3. Device Layer (YOLO:bit)

### Sensors:

* Temperature (DHT20)
* Humidity
* Soil Moisture
* Light (Lux)

### Actuators:

* Pump (Pin10 PWM)
* LED (Pin2 RGB)

### Responsibilities:

* Collect sensor data
* Publish data to MQTT
* Receive control commands
* Execute automation logic (edge)

---

## 4. MQTT Layer (Adafruit IO)

### Protocol:

* MQTT (port 1883)

### Feed Design:

| Feed               | Purpose          |
| ------------------ | ---------------- |
| BBC_Temperature    | Sensor data      |
| BBC_Humidity       | Sensor data      |
| BBC_Soil_Moisture  | Sensor data      |
| BBC_Lux            | Sensor data      |
| BBC_LED            | Manual control   |
| BBC_Pump           | Manual control   |
| BBC_AutoLED        | Toggle auto mode |
| BBC_AutoPump       | Toggle auto mode |
| BBC_Alert_HighTemp | Alert            |

### Topic format:

```
username/feeds/feed_name
```

---

## 5. Backend Design (FastAPI)

### Purpose:

* Hide AIO Key
* Aggregate data
* Provide API for frontend
* AI/ML processing

### Architecture:

```
FastAPI
 ├── MQTT Client (subscribe)
 ├── REST API
 ├── Database (PostgreSQL)
 └── Business Logic
```

---

### 5.1 MQTT Consumer

* Subscribe to all feeds
* Store latest values

Example:

```python
client.subscribe("dadn_nhom11/feeds/#")
```

---

### 5.2 REST API

#### GET sensor data

```
GET /api/sensors
```

Response:

```json
{
  "temperature": 30,
  "humidity": 70,
  "soil": 50,
  "lux": 40
}
```

---

#### POST control device

```
POST /api/control
```

Body:

```json
{
  "device": "pump",
  "value": 1
}
```

---

### 5.3 Database (Optional)

Tables:

* sensor_data
* device_logs
* alerts

---

## 6. Frontend Design (React)

### Pages:

#### 1. Dashboard

* Realtime charts (temperature, humidity...)
* Status indicators

#### 2. Control Panel

* Toggle LED
* Toggle Pump
* Enable/Disable Auto mode

#### 3. Alerts

* High temperature warning

---

### 6.1 Components

* Chart (Chart.js / Recharts)
* Toggle Switch
* Status Card

---

### 6.2 Data Flow

```
Frontend → Backend API → Adafruit
Frontend ← Backend ← MQTT
```

---

### 6.3 Realtime Options

#### Option 1: Polling

* Call API every 5s

#### Option 2: WebSocket (recommended)

* Backend pushes realtime updates

---

## 7. Automation Logic

### Watering

* ON: soil < 20% OR 08:00
* OFF: soil > 70% OR 08:05

### Lighting

* ON: lux < 20 AND time < 22h
* OFF: otherwise

---

## 8. Security Considerations

* Do NOT expose AIO Key on frontend
* Use backend as proxy
* Add authentication (JWT)

---

## 9. Scaling Ideas

* Replace Adafruit with custom MQTT (Mosquitto)
* Add AI prediction model
* Multi-device support

---

## 10. Future Improvements

* Mobile app
* Push notification
* Edge AI (TinyML)

---

# ✅ Conclusion

Hệ thống này là một kiến trúc IoT hoàn chỉnh:

* Edge computing (YOLO:bit)
* Cloud messaging (MQTT)
* Backend API
* Frontend dashboard

Có thể mở rộng thành production system.
