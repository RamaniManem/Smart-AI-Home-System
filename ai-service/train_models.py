import os
import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error


MODEL_DIR = "models"

os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# OCCUPANCY PREDICTION MODEL
# ============================================================

np.random.seed(42)

samples = 2000

temperature = np.random.uniform(18, 35, samples)
motion = np.random.randint(0, 2, samples)
light = np.random.uniform(0, 100, samples)
sound = np.random.uniform(0, 100, samples)

# Simulated occupancy rule used to create training data
occupancy = (
    (motion == 1)
    | (sound > 45)
).astype(int)

X_occupancy = np.column_stack([
    temperature,
    motion,
    light,
    sound
])

y_occupancy = occupancy

X_train, X_test, y_train, y_test = train_test_split(
    X_occupancy,
    y_occupancy,
    test_size=0.2,
    random_state=42
)

occupancy_model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

occupancy_model.fit(X_train, y_train)

occupancy_predictions = occupancy_model.predict(X_test)

occupancy_accuracy = accuracy_score(
    y_test,
    occupancy_predictions
)

joblib.dump(
    occupancy_model,
    os.path.join(MODEL_DIR, "occupancy_model.pkl")
)


# ============================================================
# ENERGY OPTIMIZATION MODEL
# ============================================================

# Simulated energy consumption based on home conditions
energy_usage = (
    0.08 * temperature
    + 0.02 * light
    + 0.03 * sound
    + 0.5 * occupancy
    + np.random.normal(0, 0.2, samples)
)

X_energy = np.column_stack([
    temperature,
    motion,
    light,
    sound,
    occupancy
])

y_energy = energy_usage

X_train_energy, X_test_energy, y_train_energy, y_test_energy = (
    train_test_split(
        X_energy,
        y_energy,
        test_size=0.2,
        random_state=42
    )
)

energy_model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

energy_model.fit(
    X_train_energy,
    y_train_energy
)

energy_predictions = energy_model.predict(
    X_test_energy
)

energy_error = mean_absolute_error(
    y_test_energy,
    energy_predictions
)

joblib.dump(
    energy_model,
    os.path.join(MODEL_DIR, "energy_model.pkl")
)


# ============================================================
# RESULTS
# ============================================================

print("==============================================")
print("       AI SMART HOME MODEL TRAINING")
print("==============================================")

print(f"Training samples: {samples}")

print()
print("Occupancy Model")
print("----------------------------------------------")
print(f"Accuracy: {occupancy_accuracy * 100:.2f}%")
print("Model: Random Forest Classifier")
print("Saved: models/occupancy_model.pkl")

print()
print("Energy Optimization Model")
print("----------------------------------------------")
print(f"Mean Absolute Error: {energy_error:.4f}")
print("Model: Random Forest Regressor")
print("Saved: models/energy_model.pkl")

print()
print("AI models trained successfully!")
print("==============================================")