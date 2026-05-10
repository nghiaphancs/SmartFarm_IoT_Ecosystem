# Pipeline Giải Thích — 2 AI Modules SmartFarm

---

## 🌿 1. Plant Disease Detection (`plant-disease-detection.ipynb`)

### Mục tiêu
Huấn luyện mô hình CNN để **phân loại bệnh cây trồng** từ ảnh chụp lá cây. Output: 1 trong 38 nhãn bệnh/lành.

---

### Pipeline tổng quan

```
[Dataset ảnh lá cây]
        ↓
[1. Load & Rescale ảnh]     → image_dataset_from_directory, resize (256×256), normalize /255
        ↓
[2. Build CNN Model]         → 5 Conv blocks + GlobalAveragePooling + Dense(38, softmax)
        ↓
[3. Training]                → Adam(lr=0.0001), EarlyStopping + ModelCheckpoint
        ↓
[4. Evaluate]                → accuracy, loss trên test set + biểu đồ training history
        ↓
[5. Export Model]            → .keras / .h5 / .tflite
        ↓
[6. Inference nhanh]         → Load lại model → predict ảnh mới
```

---

### Chi tiết từng bước

#### Bước 1 — Load & Preprocess Dataset
- **Dataset**: [New Plant Diseases Dataset (Augmented)](https://www.kaggle.com/) trên Kaggle
  - Train: **70,295 ảnh** / Valid: **17,572 ảnh** / **38 classes** (bệnh + healthy)
- Ảnh được resize về `(256, 256, 3)`
- Normalize pixel về `[0, 1]` bằng `Rescaling(1/255)`

```python
train_gen = image_dataset_from_directory(directory='...train', image_size=(256, 256))
train_gen = train_gen.map(lambda img, lbl: (Rescaling(1/255)(img), lbl))
```

#### Bước 2 — Build CNN Model (Custom, ~11.3M params)

| Block | Layers | Filters | Kernel |
|-------|--------|---------|--------|
| Block 1 | Conv2D × 2 + MaxPool(3,3) | 32 | 3×3 |
| Block 2 | Conv2D × 2 + MaxPool(3,3) | 64 | 3×3 |
| Block 3 | Conv2D × 2 + MaxPool(3,3) | 128 | 3×3 |
| Block 4 | Conv2D × 2 | 256 | 3×3 |
| Block 5 | Conv2D × 2 | 512 | 5×5 |
| Head | GlobalAvgPool → Dense(512) → Dropout(0.5) → Dense(38, softmax) | — | — |

> ✅ **GlobalAveragePooling2D** thay vì Flatten: giảm params từ ~205M xuống ~3M

```python
model.compile(
    optimizer=Adam(lr=0.0001),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)
```

#### Bước 3 — Training với Callbacks
- **EarlyStopping**: dừng sớm nếu val_loss không cải thiện
- **ModelCheckpoint**: lưu checkpoint tốt nhất

> Thời gian train thực tế: ~53 phút (trên Kaggle GPU)

#### Bước 4 — Evaluate
- Tính accuracy, loss trên tập test
- Vẽ biểu đồ `loss/val_loss` và `accuracy/val_accuracy` theo epoch

#### Bước 5 — Export Model (3 định dạng)
| Format | File | Dùng cho |
|--------|------|---------|
| `.keras` | `model_plant_disease.keras` | TF ≥ 2.12, khuyến nghị |
| `.h5` | `model_plant_disease.h5` | Legacy, tương thích rộng |
| `.tflite` | `model_plant_disease.tflite` | **Edge/IoT** (ESP32, Android) |

#### Bước 6 — Inference
```python
loaded_model = keras.models.load_model(keras_path)
preds = tf.argmax(loaded_model.predict(sample_images[:5]), axis=1).numpy()
```

---
---

## 💧 2. Smart Irrigation Model (`smart-irrigation-model.ipynb`)

### Mục tiêu
Huấn luyện mô hình ML để **dự đoán nhu cầu tưới nước** (`Irrigation_Need`: Yes/No) dựa trên dữ liệu cảm biến đất và thời tiết.

---

### Pipeline tổng quan

```
[irrigation_prediction.csv]
        ↓
[1. Load & Select Features]   → 9 features + 1 target
        ↓
[2. Preprocessing]            → Normalize số, Label Encode categorical, StandardScaler
        ↓
[3. EDA]                      → Histogram, Boxplot, KDE, Heatmap, Countplot, Pie
        ↓
[4. Train-Test Split]         → 80/20, stratify=y
        ↓
[5. Train & Evaluate 4 Models] → Logistic Regression, Random Forest, Gradient Boosting, XGBoost
        ↓
[6. Feature Importance]       → Random Forest feature importance ranking
        ↓
[7. Export Best Model]        → random_forest_irrigation_model.joblib
```

---

### Chi tiết từng bước

#### Bước 1 — Load Dataset & Chọn Features
- **Dataset**: `irrigation_prediction.csv` từ Kaggle

| Feature | Loại | Mô tả |
|---------|------|-------|
| `Soil_Type` | Categorical | Loại đất |
| `Soil_Moisture` | Numerical | Độ ẩm đất |
| `Temperature_C` | Numerical | Nhiệt độ (°C) |
| `Humidity` | Numerical | Độ ẩm không khí |
| `Rainfall_mm` | Numerical | Lượng mưa (mm) |
| `Sunlight_Hours` | Numerical | Số giờ nắng |
| `Crop_Type` | Categorical | Loại cây trồng |
| `Crop_Growth_Stage` | Categorical | Giai đoạn sinh trưởng |
| `Season` | Categorical | Mùa |
| `Irrigation_Need` | **Target** | Cần tưới? (Yes/No) |

#### Bước 2 — Preprocessing

```
Soil_Moisture, Humidity, Sunlight_Hours  →  Min-Max Scale → [0, 100]%
Sunlight_Hours  →  đổi tên thành Light_Intensity_Percent, drop cột gốc

Categorical cols (Soil_Type, Crop_Type, Crop_Growth_Stage, Season, Irrigation_Need)
    →  LabelEncoder

Numerical cols  →  StandardScaler
```

#### Bước 3 — EDA (Exploratory Data Analysis)
- **Numerical**: Histogram, Boxplot (phát hiện outlier), KDE plot, Correlation Heatmap
- **Categorical**: Countplot (phân phối nhãn), Pie chart (tỷ lệ %)

#### Bước 4 — Train-Test Split
```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
```

#### Bước 5 — Train & So sánh 4 Models

| Model | Tham số chính |
|-------|--------------|
| **Logistic Regression** | `max_iter=3000`, `class_weight="balanced"` |
| **Random Forest** | `n_estimators=300`, `max_depth=15`, `class_weight="balanced"` |
| **Gradient Boosting** | `n_estimators=300`, `learning_rate=0.05`, `max_depth=5` |
| **XGBoost** | *(cấu hình mặc định + tuning)* |

Metrics đánh giá: `Accuracy`, `F1-score`, `Confusion Matrix`, `Cross-Val Score`, `ROC-AUC`

#### Bước 6 — Feature Importance
- Dùng **Random Forest** để ranking độ quan trọng của từng feature → visualize bằng barplot

#### Bước 7 — Export Model tốt nhất
```python
import joblib
rf_model = models["Random Forest"]
joblib.dump(rf_model, "random_forest_irrigation_model.joblib")
```

> Random Forest được chọn vì: accuracy cao, giải thích được qua feature importance, phù hợp với dữ liệu cảm biến nhiễu.

---

## So sánh nhanh 2 pipeline

| | Plant Disease Detection | Smart Irrigation |
|---|---|---|
| **Input** | Ảnh RGB (256×256) | Dữ liệu bảng (cảm biến) |
| **Output** | 38 lớp bệnh | Binary: tưới/không tưới |
| **Model** | Custom CNN (Deep Learning) | Random Forest (ML) |
| **Framework** | TensorFlow / Keras | scikit-learn + XGBoost |
| **Export** | `.keras`, `.h5`, `.tflite` | `.joblib` |
| **Deployment target** | Backend API / Edge (TFLite) | Backend API |
