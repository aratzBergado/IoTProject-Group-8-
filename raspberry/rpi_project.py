#!/usr/bin/env python3
# Full system
import cv2
import time
import threading
import csv
import os
import json
from datetime import datetime
import RPi.GPIO as GPIO
import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point, WritePrecision
from mfrc522 import SimpleMFRC522

# Import Grove libraries
try:
    from grove.grove_ultrasonic_ranger import GroveUltrasonicRanger
    from grove.adc import ADC
    ADC_AVAILABLE = True
except ImportError as e:
    ADC_AVAILABLE = False
    print(f"Grove ADC library not available: {e}")
    print("Ultrasonic and gas sensors disabled")

#GPIO Conf
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

#PIN Conf
BUTTON_POINTS_PIN = 5        # GPIO5 for button
MOISTURE_POINTS_PIN = 0      # A0 for moisture
ULTRASONIC_PIN = 16          # D16 sensor ultrasonic
GAS_SENSOR_CHANNEL = 2       # A2 gas sensor

#MQTT conf
MQTT_BROKER = "192.168.1.2"  # IP broker MQTT
MQTT_PORT = 1883

# Topics MQTT
MQTT_TOPIC_SENSORS = "sensors"           
MQTT_TOPIC_USERS = "campus/users"        
MQTT_TOPIC_POINTS = "campus/points"      
MQTT_TOPIC_EVENTS = "campus/events"      

#Conf INFLUXDB
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "psdUQVrszXA78MYktgnOIqzyMt4wN4y9cADA7SgOkUjgBCOBJiUcTYIgowwYaE4KaQIU4Rd79aA_MCIS_EaUAg=="
INFLUX_ORG = "Deusto"
INFLUX_BUCKET = "first_bucket"

# Conf for points system ==========
PUNTOS_BASURA = 1
PUNTOS_BOTON = 2
PUNTOS_RIEGO = 3
HUMEDAD_MINIMA = 150
sensibilidad = 5000
duracion_evento = 8

facultades = ["Law", "Engineering", "Business", "Arts", "Other"]
CSV_REGISTROS = "registros_usuarios6.csv"
CSV_PUNTOS = "registro_puntos6.csv"

rfid_queue = []
evento_basura = False
timestamp_basura = 0

sensor_readings = {
    'distance': {'value': None, 'timestamp': None},
    'gas': {'value': None, 'timestamp': None},
    'button': {'value': None, 'timestamp': None},
    'moisture': {'value': None, 'timestamp': None}
}
readings_lock = threading.Lock()

# MQTT and InfluxDB clients
mqtt_client = mqtt.Client()
influx_client = None
write_api = None

#Initialize camera
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Error: Cannot open camera")
    exit()
fgbg = cv2.createBackgroundSubtractorMOG2()

#Initialize RFID reader
reader = SimpleMFRC522()

#GPIO conf
GPIO.setup(BUTTON_POINTS_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
print(f"✅ Button configured on GPIO {BUTTON_POINTS_PIN} (BCM)")

#MQTT Functions

def publish_mqtt(topic, data):
    """Publica datos a MQTT en formato JSON"""
    try:
        payload = json.dumps(data, ensure_ascii=False)
        mqtt_client.publish(topic, payload)
        #print(f"[MQTT] Published to {topic}: {payload[:100]}...") # I commect thios because it will be logging very oftenly 
    except Exception as e:
        print(f"❌ [MQTT Error] Could not publish to {topic}: {e}")

def publish_user_registration(user_data):
    """Publica registro de nuevo usuario"""
    data = {
        "event": "user_registered",
        "timestamp": datetime.now().isoformat(),
        "user": user_data
    }
    publish_mqtt(MQTT_TOPIC_USERS, data)

def publish_points_awarded(card_id, user_name, faculty, event_type, points, total_points):
    """Publica puntos otorgados"""
    data = {
        "event": "points_awarded",
        "timestamp": datetime.now().isoformat(),
        "card_id": str(card_id),
        "user_name": user_name,
        "faculty": faculty,
        "event_type": event_type,
        "points": points,
        "total_points": total_points
    }
    publish_mqtt(MQTT_TOPIC_POINTS, data)

def publish_trash_event(event_type, time_remaining=None):
    """Publica eventos de basura"""
    data = {
        "event": f"trash_{event_type}",
        "timestamp": datetime.now().isoformat()
    }
    if time_remaining is not None:
        data["time_remaining"] = time_remaining
    publish_mqtt(MQTT_TOPIC_EVENTS, data)

# Point system functions

def inicializar_csv():
    """Crea los archivos CSV si no existen"""
    if not os.path.exists(CSV_REGISTROS):
        with open(CSV_REGISTROS, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["ID_Tarjeta", "Nombre", "Email", "Department", "Nationality", "Faculty"])
        print(f"✅ CSV de usuarios creado: {CSV_REGISTROS}")

    if not os.path.exists(CSV_PUNTOS):
        with open(CSV_PUNTOS, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["Timestamp", "ID_Tarjeta", "Nombre", "Faculty", "Tipo_Evento", "Puntos", "Total_Puntos"])
        print(f"✅ CSV de puntos creado: {CSV_PUNTOS}")

def buscar_usuario(id_tarjeta):
    """Busca un usuario en el CSV por ID de tarjeta"""
    if not os.path.exists(CSV_REGISTROS):
        return None

    with open(CSV_REGISTROS, mode='r') as f:
        reader_csv = csv.reader(f)
        next(reader_csv)
        for row in reader_csv:
            if row and row[0] == str(id_tarjeta):
                return {
                    "id_tarjeta": row[0],
                    "nombre": row[1],
                    "email": row[2],
                    "department": row[3],
                    "nationality": row[4],
                    "faculty": row[5]
                }
    return None

def registrar_puntos(id_tarjeta, nombre, facultad, tipo_evento, puntos):
    """Registra puntos en el CSV y publica a MQTT"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Compute cummulative points
    total_puntos = puntos
    if os.path.exists(CSV_PUNTOS):
        with open(CSV_PUNTOS, mode='r') as f:
            reader_csv = csv.reader(f)
            next(reader_csv)
            for row in reader_csv:
                if row and row[1] == str(id_tarjeta):
                    total_puntos += int(row[5])

    with open(CSV_PUNTOS, mode='a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([timestamp, id_tarjeta, nombre, facultad, tipo_evento, puntos, total_puntos])

    # Publish in MQTT
    publish_points_awarded(id_tarjeta, nombre, facultad, tipo_evento, puntos, total_puntos)

    return total_puntos

def registrar_nuevo_usuario(id_tarjeta, text):
    """Registra un nuevo usuario y publica a MQTT"""
    print(f"\n{'='*60}")
    print(f"🎫 NEW CARD DETECTED!")
    print(f"   ID: {id_tarjeta}")
    print(f"   Text on card: {text}")
    print(f"{'='*60}")

    print("\nPlease enter the user's information:")

    nombre_usuario = input("   Name: ").strip()
    while not nombre_usuario:
        print("   ❌ Name cannot be empty.")
        nombre_usuario = input("   Name: ").strip()

    email_usuario = input("   Email: ").strip()
    while not email_usuario:
        print("   ❌ Email cannot be empty.")
        email_usuario = input("   Email: ").strip()

    department_usuario = input("   Department: ").strip()
    while not department_usuario:
        print("   ❌ Department cannot be empty.")
        department_usuario = input("   Department: ").strip()

    nationality_usuario = input("   Nationality: ").strip()
    while not nationality_usuario:
        print("   ❌ Nationality cannot be empty.")
        nationality_usuario = input("   Nationality: ").strip()

    print("\n   Available faculties:")
    for idx, facultad in enumerate(facultades, start=1):
        print(f"   {idx}. {facultad}")

    facultad_elegida = None
    while facultad_elegida is None:
        try:
            eleccion = int(input("\n   Enter the faculty number: "))
            if 1 <= eleccion <= len(facultades):
                facultad_elegida = facultades[eleccion - 1]
            else:
                print("   ❌ Invalid number. Try again.")
        except ValueError:
            print("   ❌ Please enter a valid number.")

    with open(CSV_REGISTROS, mode='a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([id_tarjeta, nombre_usuario, email_usuario,
                        department_usuario, nationality_usuario, facultad_elegida])

    print(f"\n   ✅ {nombre_usuario} has been registered in {facultad_elegida}")

    # Publish in MQTT
    user_data = {
        "id_tarjeta": str(id_tarjeta),
        "nombre": nombre_usuario,
        "email": email_usuario,
        "department": department_usuario,
        "nationality": nationality_usuario,
        "faculty": facultad_elegida,
        "registration_time": datetime.now().isoformat()
    }
    publish_user_registration(user_data)

    return {"nombre": nombre_usuario, "facultad": facultad_elegida}

def procesar_tarjeta(id_tarjeta, text):
    """Procesa una tarjeta RFID leída para el sistema de puntos"""
    global evento_basura

    # Look for user
    usuario = buscar_usuario(id_tarjeta)

    if usuario:
        nombre = usuario["nombre"]
        facultad = usuario["faculty"]
        print(f"\n{'='*60}")
        print(f"✅ CARD DETECTED: {nombre} ({facultad})")
    else:
        datos = registrar_nuevo_usuario(id_tarjeta, text)
        nombre = datos["nombre"]
        facultad = datos["facultad"]
        print(f"\n{'='*60}")
        print(f"👤 NEW USER: {nombre} ({facultad})")

    print(f"\n💧 Have you watered the plant? (y/n)")
    respuesta = input("   Answer: ").lower().strip()

    puntos_acumulados = 0
    tipo_eventos = []

    # 1. Trash points
    if evento_basura:
        total = registrar_puntos(id_tarjeta, nombre, facultad, "Trash", PUNTOS_BASURA)
        puntos_acumulados += PUNTOS_BASURA
        tipo_eventos.append("trash disposal")
        print(f"   🗑️  +{PUNTOS_BASURA} point(s) for trash disposal")
        evento_basura = False

    # 2. Button pressed points
    estado_boton = GPIO.input(BUTTON_POINTS_PIN)
    if estado_boton == 1: 
        total = registrar_puntos(id_tarjeta, nombre, facultad, "Button", PUNTOS_BOTON)
        puntos_acumulados += PUNTOS_BOTON
        tipo_eventos.append("button press")
        print(f"   🔘 +{PUNTOS_BOTON} point(s) for button press")
    else:
        print(f"   ⚪ Button not pressed - no points for button")

    # 3. Watering Plant points
    if respuesta == 'y':
        if ADC_AVAILABLE:
            adc = ADC()
            moisture_value = adc.read(MOISTURE_POINTS_PIN)
            print(f"   📊 Moisture sensor value: {moisture_value}")

            if moisture_value > HUMEDAD_MINIMA:
                total = registrar_puntos(id_tarjeta, nombre, facultad, "Watering", PUNTOS_RIEGO)
                puntos_acumulados += PUNTOS_RIEGO
                tipo_eventos.append("watering plant")
                print(f"   💧 +{PUNTOS_RIEGO} point(s) for watering the plant")
            else:
                print(f"   ⚠️  Moisture level ({moisture_value}) is too low. No points for watering.")
        else:
            total = registrar_puntos(id_tarjeta, nombre, facultad, "Watering", PUNTOS_RIEGO)
            puntos_acumulados += PUNTOS_RIEGO
            tipo_eventos.append("watering plant")
            print(f"   💧 +{PUNTOS_RIEGO} point(s) for watering the plant (sensor not available)")
    elif respuesta == 'n':
        print(f"No points for watering (plant not watered).")
    else:
        print(f"Invalid answer. No points for watering.")

    # Mostrar resumen
    if puntos_acumulados > 0:
        print(f"\n   🎯 TOTAL: +{puntos_acumulados} point(s) for {', '.join(tipo_eventos)}")
        print(f"   📈 Total accumulated points: {total}")
    else:
        print(f"\n No points awarded this time.")

    print(f"{'='*60}\n")
    time.sleep(1)

# ========== FUncionts sensors MQTT/INFLUXDB ==========

def read_distance():
    """Lee continuamente el sensor ultrasónico"""
    if not ADC_AVAILABLE:
        return

    sensor = GroveUltrasonicRanger(ULTRASONIC_PIN)
    while True:
        try:
            distance = sensor.get_distance()
            with readings_lock:
                sensor_readings['distance']['value'] = distance
                sensor_readings['distance']['timestamp'] = datetime.utcnow()
        except Exception as e:
            print(f"Distance sensor error: {e}")
        time.sleep(0.5)

def read_gas():
    """Lee continuamente el sensor de gas"""
    if not ADC_AVAILABLE:
        return

    adc = ADC()
    while True:
        try:
            value = adc.read(GAS_SENSOR_CHANNEL)
            with readings_lock:
                sensor_readings['gas']['value'] = value
                sensor_readings['gas']['timestamp'] = datetime.utcnow()
        except Exception as e:
            print(f"Gas sensor error: {e}")
        time.sleep(1)

def read_button_sensor():
    """Monitorea el estado del botón para MQTT/InfluxDB"""
    while True:
        try:
            button_state = GPIO.input(BUTTON_POINTS_PIN)
            with readings_lock:
                sensor_readings['button']['value'] = button_state
                sensor_readings['button']['timestamp'] = datetime.utcnow()
        except Exception as e:
            print(f"Button sensor error: {e}")
        time.sleep(0.1)

def read_moisture_sensor():
    """Lee continuamente el sensor de humedad para MQTT/InfluxDB"""
    if not ADC_AVAILABLE:
        return

    adc = ADC()
    while True:
        try:
            moisture_value = adc.read(MOISTURE_POINTS_PIN)
            with readings_lock:
                sensor_readings['moisture']['value'] = moisture_value
                sensor_readings['moisture']['timestamp'] = datetime.utcnow()
        except Exception as e:
            print(f"Moisture sensor error: {e}")
        time.sleep(1)

def get_moisture_status(value):
    """Obtiene el estado de humedad"""
    if value is None:
        return "Unknown"
    if value < 300:
        return "Dry"
    elif value < 600:
        return "Wet"
    else:
        return "Very Wet"

def publish_sensor_data():
    """Publica datos de sensores a MQTT e InfluxDB"""
    try:
        print("[MQTT/Influx] Starting data publishing...")

        while True:
            # Get readings
            with readings_lock:
                dist = sensor_readings['distance']['value']
                gas = sensor_readings['gas']['value']
                btn = sensor_readings['button']['value']
                moist = sensor_readings['moisture']['value']
                moist_status = get_moisture_status(moist)

            # Publish sensor data in MQTT (in CSVs)
            if all(v is not None for v in [dist, gas, btn, moist]):
                csv_message = f"{dist:.1f},{gas},{btn},{moist},{moist_status}"

                try:
                    mqtt_client.publish(MQTT_TOPIC_SENSORS, csv_message)
                    #print(f"[MQTT Sensors] Sent to '{MQTT_TOPIC_SENSORS}': {csv_message}")
                except Exception as e:
                    print(f"[MQTT Sensors Error] {e}")

                json_data = {
                    "timestamp": datetime.now().isoformat(),
                    "distance_cm": dist,
                    "gas_value": gas,
                    "button_state": btn,
                    "moisture_value": moist,
                    "moisture_status": moist_status
                }
                publish_mqtt("sensors/json", json_data)

                # Write in InfluxDB
                try:
                    if influx_client:
                        current_time = datetime.utcnow()
                        distance_point = Point("distance") \
                            .tag("host", "raspberrypi") \
                            .field("value", float(dist)) \
                            .time(current_time, WritePrecision.NS)

                        gas_point = Point("gas") \
                            .tag("host", "raspberrypi") \
                            .field("value", float(gas)) \
                            .time(current_time, WritePrecision.NS)

                        button_point = Point("button") \
                            .tag("host", "raspberrypi") \
                            .field("state", int(btn)) \
                            .time(current_time, WritePrecision.NS)

                        moisture_point = Point("moisture") \
                            .tag("host", "raspberrypi") \
                            .field("value", float(moist)) \
                            .time(current_time, WritePrecision.NS)

                        write_api.write(
                            bucket=INFLUX_BUCKET,
                            org=INFLUX_ORG,
                            record=[distance_point, gas_point, button_point, moisture_point]
                        )
                        #print(f"[InfluxDB] Written 4 points to '{INFLUX_BUCKET}' bucket")

                except Exception as e:
                    print(f"[InfluxDB Error] {e}")

            else:
                print("[Warning] Some sensor readings are None, skipping publish...")

            time.sleep(7)  # Publish every 7s

    except KeyboardInterrupt:
        print("\n[MQTT/Influx] Stopping data publishing...")

#Threads for points
def rfid_listener():
    """Hilo para leer tarjetas RFID"""
    print("🔓 RFID listener started. Ready to scan cards...")
    while True:
        try:
            id, text = reader.read()
            if id:
                rfid_queue.append((id, text.strip() if text else ""))
                time.sleep(0.5)
        except Exception as e:
            print(f"RFID error: {e}")
            time.sleep(0.5)

def button_monitor_points():
    """Hilo para monitorear el botón del sistema de puntos"""
    estado_anterior = 0
    while True:
        estado_actual = GPIO.input(BUTTON_POINTS_PIN)
        if estado_actual != estado_anterior:
            if estado_actual == 1:
                print(f"\n🔘 BUTTON PRESSED! Hold it while scanning for {PUNTOS_BOTON} points")
            else:
                print(f"🔘 Button released")
            estado_anterior = estado_actual
        time.sleep(0.1)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] Connected successfully to {MQTT_BROKER}")
        print(f"[MQTT] Topics available:")
        print(f"  - {MQTT_TOPIC_SENSORS} (sensor data in CSV format)")
        print(f"  - {MQTT_TOPIC_USERS} (user registrations)")
        print(f"  - {MQTT_TOPIC_POINTS} (points awarded)")
        print(f"  - {MQTT_TOPIC_EVENTS} (system events)")
        print(f"  - sensors/json (sensor data in JSON format)")
    else:
        print(f"[MQTT] Connection failed with code {rc}")

def on_disconnect(client, userdata, rc):
    print(f"[MQTT] Disconnected (code: {rc})")

# Initialization
def inicializar_mqtt_influx():
    """Inicializa MQTT e InfluxDB"""
    global influx_client, write_api

    try:
        mqtt_client.on_connect = on_connect
        mqtt_client.on_disconnect = on_disconnect

        # Conect to MQTT broker
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        print(f"[MQTT] Connecting to {MQTT_BROKER}...")
        time.sleep(1)

        # Initialize InfluxDB
        try:
            influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
            write_api = influx_client.write_api()
            print(f"[InfluxDB] Connected to {INFLUX_URL}")
        except Exception as e:
            print(f"[InfluxDB Warning] Could not connect: {e}")
            influx_client = None

        return True

    except Exception as e:
        print(f"[Error] Failed to initialize MQTT: {e}")
        return False

def iniciar_sensores_mqtt():
    """Inicia los hilos de los sensores para MQTT/InfluxDB"""
    if not ADC_AVAILABLE:
        print("⚠️  Grove libraries not available, MQTT/InfluxDB sensors disabled")
        return []

    threads = []
    sensor_functions = [read_distance, read_gas, read_button_sensor, read_moisture_sensor]

    for func in sensor_functions:
        thread = threading.Thread(target=func, daemon=True)
        thread.start()
        threads.append(thread)
        print(f"[Thread] Started {func.__name__}")
        time.sleep(0.3)

    print("\n[Info] Waiting for sensors to initialize...")
    time.sleep(1.5)

    return threads

def main():
    inicializar_csv()

    # Initialize points system
    rfid_thread = threading.Thread(target=rfid_listener, daemon=True)
    button_thread = threading.Thread(target=button_monitor_points, daemon=True)
    rfid_thread.start()
    button_thread.start()

    # Init MQTT/InfluxDB
    mqtt_influx_ok = inicializar_mqtt_influx()

    sensor_threads = []
    if mqtt_influx_ok and ADC_AVAILABLE:
        sensor_threads = iniciar_sensores_mqtt()

    # Publish data
    publish_thread = None
    if mqtt_influx_ok:
        publish_thread = threading.Thread(target=publish_sensor_data, daemon=True)
        publish_thread.start()

    print("\n" + "="*60)
    print("🏁 SMART CAMPUS SYSTEM - FULL VERSION WITH MQTT")
    print("="*60)
    print("📋 SYSTEM 1: Points System with MQTT")
    print(f"   📷 Camera: Monitoring trash area")
    print(f"   🔘 Button: GPIO {BUTTON_POINTS_PIN}")
    print(f"   💧 Moisture sensor: A{MOISTURE_POINTS_PIN}")
    print(f"   🎫 RFID: Ready to scan cards")

    print(f"\n📡 SYSTEM 2: MQTT Publishing")
    print(f"   📡 Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"   📊 Topics:")
    print(f"     - {MQTT_TOPIC_SENSORS} (sensor data)")
    print(f"     - {MQTT_TOPIC_USERS} (user registrations)")
    print(f"     - {MQTT_TOPIC_POINTS} (points awarded)")
    print(f"     - {MQTT_TOPIC_EVENTS} (system events)")

    print(f"\n🎮 Controls: Press 'q' to quit")
    print("="*60 + "\n")

    try:
        while True:
            # --- Camera use ---
            ret, frame = cap.read()
            if not ret:
                print("❌ Camera error")
                break

            # ROI to detect trash
            roi = frame[200:400, 300:500]
            mask = fgbg.apply(roi)
            _, thresh = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)
            mov = cv2.countNonZero(thresh)

            global evento_basura, timestamp_basura
            if mov > sensibilidad and not evento_basura:
                evento_basura = True
                timestamp_basura = time.time()
                print(f"\n⚠️  TRASH DETECTED in bin!")
                print(f"⏰ You have {duracion_evento} seconds to scan your card...")
                publish_trash_event("detected", duracion_evento)

            if evento_basura and time.time() - timestamp_basura > duracion_evento:
                evento_basura = False
                print(f"⏱️  Time expired. No points for trash.")
                publish_trash_event("expired")

            # Process RFID cards
            while rfid_queue:
                id_tarjeta, text = rfid_queue.pop(0)
                procesar_tarjeta(id_tarjeta, text)

            cv2.rectangle(frame, (300, 200), (500, 400), (0, 255, 0), 2)
            cv2.putText(frame, "TRASH AREA", (300, 190),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            if evento_basura:
                tiempo_restante = duracion_evento - (time.time() - timestamp_basura)
                cv2.putText(frame, f"SCAN CARD! ({int(tiempo_restante)}s)",
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

            estado_boton = GPIO.input(BUTTON_POINTS_PIN)
            if estado_boton == 1:
                cv2.putText(frame, "BUTTON PRESSED", (10, 60),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

            if mqtt_influx_ok:
                cv2.putText(frame, "MQTT: ACTIVE", (10, 90),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

            cv2.imshow("Smart Campus System - Full MQTT Version", frame)

            key = cv2.waitKey(30) & 0xFF
            if key == ord('q'):
                print("\nStopping all systems...")
                break

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    finally:
        cap.release()
        cv2.destroyAllWindows()

        # Stop MQTT
        if mqtt_influx_ok:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
            print("MQTT disconnected")

            # Close InfluxDB
            if influx_client:
                influx_client.close()
                print("InfluxDB closed")

        GPIO.cleanup()
        print("Camera released")
        print("GPIO cleaned up")
        print("All systems stopped")

if __name__ == "__main__":
    main()
