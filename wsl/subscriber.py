#!/usr/bin/env python3
# Subscriber for all data -> Receive all data from the Raspberry via MQTT

import paho.mqtt.client as mqtt
import json
import csv
import os
from datetime import datetime

# Configuración MQTT
broker = "192.168.1.2" # Raspberry IP
port = 1883

# Topics to subscribe to
topics = [
    "sensors",           # Sensor data in CSV
    "sensors/json",      # Sensor data in JSON
    "campus/users",      # Users CSV
    "campus/points",     # Points CSV
    "campus/events"      
]

# CSV files for all topics
csv_files = {
    "sensors": "sensor_data.csv",
    "campus/users": "users_registry.csv",
    "campus/points": "points_history.csv",
    "campus/events": "system_events.csv"
}

def initialize_csv_file(filename, headers):
    """Inicializa archivo CSV con headers si no existe"""
    if not os.path.exists(filename):
        with open(filename, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
        print(f"✅ Created CSV file: {filename}")

# Initialize all CSV files
initialize_csv_file("sensor_data.csv", [
    "timestamp_received", "distance_cm", "gas_value", 
    "button_state", "moisture_value", "moisture_status"
])

initialize_csv_file("users_registry.csv", [
    "timestamp_received", "event", "card_id", "user_name",
    "email", "department", "nationality", "faculty", "registration_time"
])

initialize_csv_file("points_history.csv", [
    "timestamp_received", "event", "card_id", "user_name",
    "faculty", "event_type", "points", "total_points"
])

initialize_csv_file("system_events.csv", [
    "timestamp_received", "event", "details", "time_remaining"
])

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT broker")
        # Subscribe to all topics
        for topic in topics:
            client.subscribe(topic)
            print(f"  📡 Subscribed to: {topic}")
    else:
        print(f"❌ Connection failed with code {rc}")

def on_message(client, userdata, msg):
    timestamp = datetime.now().isoformat()
    topic = msg.topic
    payload = msg.payload.decode()
    
    print(f"\n{'='*60}")
    print(f"📥 [{timestamp}] Topic: {topic}")
    print(f"{'-'*60}")
    
    try:
        if topic == "sensors":
            process_sensor_csv(timestamp, payload)
        elif topic == "sensors/json":
            process_sensor_json(timestamp, payload)
        elif topic == "campus/users":
            process_users(timestamp, payload)
        elif topic == "campus/points":
            process_points(timestamp, payload)
        elif topic == "campus/events":
            process_events(timestamp, payload)
        else:
            print(f"⚠️  Unknown topic: {topic}")
            print(f"Raw payload: {payload}")
            
    except Exception as e:
        print(f"❌ Error processing message: {e}")
        print(f"Raw payload: {payload}")

def process_sensor_csv(timestamp, payload):
    """Procesa datos de sensores en formato CSV"""
    try:
        parts = payload.split(',')
        
        if len(parts) == 5:
            distance, gas, button, moisture, moisture_status = parts
            
            button_text = "PRESSED" if button == "0" else "NOT pressed"
            
            print(f"📊 Sensor Data (CSV):")
            print(f"  📏 Distance: {distance} cm")
            print(f"  ⚗️  Gas: {gas}")
            print(f"  🔘 Button: {button_text}")
            print(f"  💧 Moisture: {moisture} ({moisture_status})")
            
            # Store en CSV
            with open("sensor_data.csv", "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp, distance, gas, button, 
                    moisture, moisture_status
                ])
        else:
            print(f"⚠️  Invalid CSV format: {payload}")
            
    except Exception as e:
        print(f"❌ Error processing sensor CSV: {e}")

def process_sensor_json(timestamp, payload):
    """Procesa datos de sensores en formato JSON"""
    try:
        data = json.loads(payload)
        
        print(f"📊 Sensor Data (JSON):")
        print(f"  📅 Timestamp: {data.get('timestamp', 'N/A')}")
        print(f"  📏 Distance: {data.get('distance_cm', 'N/A')} cm")
        print(f"  ⚗️  Gas: {data.get('gas_value', 'N/A')}")
        
        button_state = data.get('button_state', 'N/A')
        button_text = "PRESSED" if button_state == 0 else "NOT pressed"
        print(f"  🔘 Button: {button_text}")
        
        print(f"  💧 Moisture: {data.get('moisture_value', 'N/A')} ({data.get('moisture_status', 'N/A')})")
        
    except Exception as e:
        print(f"❌ Error processing sensor JSON: {e}")

def process_users(timestamp, payload):
    """Procesa registros de usuarios"""
    try:
        data = json.loads(payload)
        
        if data.get("event") == "user_registered":
            user = data.get("user", {})
            
            print(f"👤 NEW USER REGISTERED:")
            print(f"  🆔 Card ID: {user.get('id_tarjeta', 'N/A')}")
            print(f"  👤 Name: {user.get('nombre', 'N/A')}")
            print(f"  📧 Email: {user.get('email', 'N/A')}")
            print(f"  🏢 Department: {user.get('department', 'N/A')}")
            print(f"  🌍 Nationality: {user.get('nationality', 'N/A')}")
            print(f"  🎓 Faculty: {user.get('faculty', 'N/A')}")
            print(f"  📅 Registered: {user.get('registration_time', 'N/A')}")
            
            # Store en CSV
            with open("users_registry.csv", "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp,
                    data.get("event", ""),
                    user.get('id_tarjeta', ""),
                    user.get('nombre', ""),
                    user.get('email', ""),
                    user.get('department', ""),
                    user.get('nationality', ""),
                    user.get('faculty', ""),
                    user.get('registration_time', "")
                ])
        else:
            print(f"⚠️  Unknown user event: {data}")
            
    except Exception as e:
        print(f"❌ Error processing user data: {e}")

def process_points(timestamp, payload):
    """Procesa puntos otorgados"""
    try:
        data = json.loads(payload)
        
        if data.get("event") == "points_awarded":
            print(f"🏆 POINTS AWARDED:")
            print(f"  🆔 Card ID: {data.get('card_id', 'N/A')}")
            print(f"  👤 User: {data.get('user_name', 'N/A')}")
            print(f"  🎓 Faculty: {data.get('faculty', 'N/A')}")
            print(f"  🎯 Event: {data.get('event_type', 'N/A')}")
            print(f"  ⭐ Points: +{data.get('points', 0)}")
            print(f"  📈 Total Points: {data.get('total_points', 0)}")
            print(f"  📅 Time: {data.get('timestamp', 'N/A')}")
            
            with open("points_history.csv", "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp,
                    data.get("event", ""),
                    data.get('card_id', ""),
                    data.get('user_name', ""),
                    data.get('faculty', ""),
                    data.get('event_type', ""),
                    data.get('points', 0),
                    data.get('total_points', 0)
                ])
        else:
            print(f"⚠️  Unknown points event: {data}")
            
    except Exception as e:
        print(f"❌ Error processing points data: {e}")

def process_events(timestamp, payload):
    """Procesa eventos del sistema"""
    try:
        data = json.loads(payload)
        event_type = data.get("event", "")
        
        print(f"📢 SYSTEM EVENT:")
        print(f"  🎯 Type: {event_type}")
        print(f"  📅 Time: {data.get('timestamp', 'N/A')}")
        
        if "time_remaining" in data:
            print(f"  ⏰ Time remaining: {data.get('time_remaining')} seconds")
        
        # Interpret event
        if "trash_detected" in event_type:
            print(f"  🗑️  Event: Trash detected in bin!")
        elif "trash_expired" in event_type:
            print(f"  ⏱️  Event: Time for scanning expired")
        
        # Store in CSV
        with open("system_events.csv", "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                timestamp,
                event_type,
                json.dumps(data),
                data.get('time_remaining', '')
            ])
            
    except Exception as e:
        print(f"❌ Error processing system event: {e}")

def main():
    print("="*60)
    print("🏫 CAMPUS SYSTEM - COMPLETE SUBSCRIBER")
    print("="*60)
    print(f"📡 Broker: {broker}:{port}")
    print(f"📊 Topics subscribed:")
    for topic in topics:
        print(f"  - {topic}")
    print(f"\n💾 CSV files:")
    for topic, filename in csv_files.items():
        print(f"  - {filename} ← {topic}")
    print("="*60)
    print("📥 Listening for messages... Press Ctrl+C to stop")
    print("="*60)
    
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(broker, port, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping subscriber...")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    finally:
        client.disconnect()
        print("✅ Disconnected from broker")

if __name__ == "__main__":
    main()
