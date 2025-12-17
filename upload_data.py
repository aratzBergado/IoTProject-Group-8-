# Code to uplad data received from WSL to FireBase

import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

## ---------- CONFIGURATION ----------
CSV_PATH = "../../data/sensor_data.csv"  # Path to the sensor CSV file
USERS_CSV_PATH = "../../data/users_registry.csv"  # Path to users CSV
POINTS_CSV_PATH = "../../data/points_history.csv"  # Path to points history CSV

## Firebase collection names
COLLECTION_DISTANCE = "distance"
COLLECTION_GAS = "gas"
COLLECTION_BUTTON = "button"
COLLECTION_MOISTURE = "moisture"
COLLECTION_POINTS = "points"  

COLUMN_NAMES = {
    'timestamp_received': 'timestamp',
    'distance_cm': 'distance',
    'gas_value': 'gas',
    'button_state': 'button',
    'moisture_value': 'moisture',
    'moisture_status': 'moisture_status'
}


## Initialize Firebase: need the private account key
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

def upload_combined_points_data():
    print(f"\n{'='*60}")
    print(" PROCESSING COMBINED USER AND POINTS DATA")
    print(f"{'='*60}")
    
    try:
        ## 1. Read user data
        print(" Reading user data...")
        users_df = pd.read_csv(USERS_CSV_PATH)
        print(f"    {len(users_df)} users found")
        
        ## 2. Read points data
        print(" Reading points data...")
        points_df = pd.read_csv(POINTS_CSV_PATH)
        print(f"    {len(points_df)} points records found")
        
        print("\n Finding latest points entry per user...")
        
        points_df['timestamp_received'] = pd.to_datetime(points_df['timestamp_received'])
        
        points_df = points_df.sort_values(['card_id', 'timestamp_received'], ascending=[True, False])
        
        ## Get the latest entry for each card_id
        latest_points = points_df.drop_duplicates(subset=['card_id'], keep='first')
        print(f"    {len(latest_points)} unique users with points found")
        
        ## Combine data
        print("\n Combining user and points data...")
        users_df['card_id'] = users_df['card_id'].astype(str)
        latest_points['card_id'] = latest_points['card_id'].astype(str)
        
        combined_df = pd.merge(
            users_df[['card_id', 'user_name', 'email', 'department', 'nationality', 'faculty']],
            latest_points[['card_id', 'total_points']],
            on='card_id',
            how='left'  
        )
        
        combined_df['total_points'] = combined_df['total_points'].fillna(0).astype(int)
        
        print(f"    {len(combined_df)} combined users ready to upload")
        
        ## Prepare and upload data to Firebase
        print(f"\n Uploading {len(combined_df)} documents to '{COLLECTION_POINTS}' collection...")
        
        points_counter = 0
        
        for index, row in combined_df.iterrows():
            try:
                ## Create document with required fields
                points_data = {
                    "Nombre": str(row["user_name"]) if pd.notna(row["user_name"]) else "Unknown",
                    "ID de Card": str(row["card_id"]),
                    "Department": str(row["department"]) if pd.notna(row["department"]) else "Not specified",
                    "Email": str(row["email"]) if pd.notna(row["email"]) else "Not specified",
                    "Nationality": str(row["nationality"]) if pd.notna(row["nationality"]) else "Not specified",
                    "Total Points": int(row["total_points"]),
                    "Faculty": str(row["faculty"]) if pd.notna(row["faculty"]) else "Not specified",
                    "upload_timestamp": datetime.now().isoformat(),
                    "last_updated": datetime.now().isoformat()
                }
                
                ## Create a unique document ID (using card_id)
                doc_id = f"user_{row['card_id']}"
                
                doc_ref = db.collection(COLLECTION_POINTS).document(doc_id)
                doc_ref.set(points_data, merge=True)
                
                points_counter += 1
                
                if (index + 1) % 5 == 0:  ## Show progress every 5 users
                    print(f"   Processed {index + 1}/{len(combined_df)} users...")
                    
            except Exception as e:
                print(f" Error processing user {index+1} (card_id: {row['card_id']}): {e}")
        
        ## Summary
        print(f"\n{'='*50}")
        print(" COMBINED DATA UPLOAD SUMMARY")
        print(f"{'='*50}")
        print(f" Documents uploaded/updated: {points_counter}")
        
        ## Show some examples
        if points_counter > 0:
            print(f"\n Example of uploaded data:")
            sample_data = combined_df.head(3)
            for i, (_, row) in enumerate(sample_data.iterrows(), 1):
                print(f"   User {i}: {row['user_name']} - Card: {row['card_id']} - Points: {row['total_points']}")
        
        return points_counter
        
    except Exception as e:
        print(f" Error in combined processing: {e}")
        return 0

def upload_sensor_data():
    print(f"\n{'='*50}")
    print(" PROCESSING SENSOR DATA")
    print(f"{'='*50}")
    
    ## Read the CSV
    try:
        df = pd.read_csv(CSV_PATH)
        print(f"CSV file read: {len(df)} rows found")
        print(f"Columns detected: {list(df.columns)}")
    except Exception as e:
        print(f" Error reading CSV: {e}")
        return 0

    ## Verify the CSV has the expected columns -- important
    expected_columns = list(COLUMN_NAMES.keys())
    missing_columns = [col for col in expected_columns if col not in df.columns]

    if missing_columns:
        print(f" Missing columns in CSV: {missing_columns}")
        print(f"   Available columns: {list(df.columns)}")
        return 0
    else:
        print(" All required columns are present")

    df = df.rename(columns=COLUMN_NAMES)

    last_rows = df
    print(f"\n Uploading the last {len(last_rows)} rows to Firebase...")

    ## Counters for tracking in the console
    counters = {
        'distance': 0,
        'gas': 0,
        'button': 0,
        'moisture': 0
    }

    ## Process each row and upload data to corresponding collections
    for index, row in last_rows.iterrows():
        try:
            ## 1. Distance sensor data
            distance_data = {
                "timestamp": str(row["timestamp"]),
                "distance_cm": float(row["distance"]),
                "sensor_type": "ultrasonic"
            }
            
            ## 2. Gas sensor data
            gas_data = {
                "timestamp": str(row["timestamp"]),
                "gas_value": float(row["gas"]),
                "sensor_type": "MQ2"
            }
            
            ## 3. Button data
            button_data = {
                "timestamp": str(row["timestamp"]),
                "button_state": int(row["button"]),
                "button_pressed": bool(int(row["button"])),
                "sensor_type": "push_button"
            }
            
            ## 4. Moisture sensor data
            moisture_data = {
                "timestamp": str(row["timestamp"]),
                "moisture_value": float(row["moisture"]),
                "moisture_status": str(row["moisture_status"]),
                "sensor_type": "soil_moisture"
            }
            
            ## Upload data to Firebase
            db.collection(COLLECTION_DISTANCE).add(distance_data)
            counters['distance'] += 1
            
            db.collection(COLLECTION_GAS).add(gas_data)
            counters['gas'] += 1
            
            db.collection(COLLECTION_BUTTON).add(button_data)
            counters['button'] += 1
            
            db.collection(COLLECTION_MOISTURE).add(moisture_data)
            counters['moisture'] += 1
            
            if (index + 1) % 10 == 0:  ## Show progress every 10 rows
                print(f"  Processed {index + 1}/{len(last_rows)} rows...")
                
        except Exception as e:
            print(f" Error uploading row {index+1}: {e}")

    ## Summary
    print(f"\n{'='*50}")
    print(" SENSOR DATA UPLOAD SUMMARY")
    print(f"{'='*50}")
    print(f" Distance: {counters['distance']} documents uploaded to '{COLLECTION_DISTANCE}'")
    print(f" Gas: {counters['gas']} documents uploaded to '{COLLECTION_GAS}'")
    print(f" Button: {counters['button']} documents uploaded to '{COLLECTION_BUTTON}'")
    print(f" Moisture: {counters['moisture']} documents uploaded to '{COLLECTION_MOISTURE}'")
    
    total_sensors = sum(counters.values())
    print(f"\n Total sensors: {total_sensors} documents uploaded to Firebase!")
    
    return total_sensors

def main():
    print(f"\n{'='*60}")
    print(" STARTING DATA UPLOAD TO FIREBASE")
    print(f"{'='*60}")
    
    ## Upload sensor data
    total_sensors = upload_sensor_data()
    
    ## Upload combined user and points data
    total_points = upload_combined_points_data()
    
    ## Final summary
    print(f"\n{'='*60}")
    print(" FINAL SUMMARY")
    print(f"{'='*60}")
    print(f" Sensors: {total_sensors} documents")
    print(f" Points (combined users): {total_points} documents")
    print(f" Total: {total_sensors + total_points} documents")


if __name__ == "__main__":
    main()