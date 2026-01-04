# IoTProject (Group 8)

# IoT Smart Recycling System

This project is a complete IoT system for smart recycling. It uses sensors, RFID cards, and real-time data to track recycling activities. Users earn points when they recycle items. The system shows live data on a website and keeps track of user scores on a leaderboard.

## Project Structure

The project has three main parts working together:

1. **Web Interface** - Shows data to users on a website
2. **WSL Directory** - Moves data between systems  
3. **Raspberry Pi** - Collects data from physical sensors

# Github Directories

## Web Interface Files

The web folder contains all files for the website. These files show data from sensors and let users see their recycling points.

HTML files create the web pages. CSS files make the pages look nice. JavaScript files get data from Firebase and make the pages interactive. JavaScript also creates charts and updates information in real time.

Python scripts handle data uploads. One script reads CSV files and sends the data to Firebase. Another script runs automatically and uploads data when CSV files change.

## WSL Directory Files

The WSL directory connects the Raspberry Pi to the Windows system. A shell script watches for CSV file changes. When CSV files update, the script sends them to Windows. This allows data to move from Linux to Windows systems.

A Python script subscribes to MQTT messages. This script receives sensor data from the Raspberry Pi. It saves the received data into local CSV files for processing. 

## Raspberry Pi Files

The Raspberry Pi runs the main IoT program. It sets up all CSV files for data storage. CSV files keep records of sensor readings and user activities.

The system connects to an MQTT broker for data transmission. It also connects to InfluxDB for time-based data storage. All sensors send their readings through this setup.

Several sensors work together on the Raspberry Pi. An ultrasonic sensor measures distance to measure the filling of the trash. A gas sensor checks gas level within the trash. A moisture sensor monitors soil conditions in a plant. A button lets users interact with the system (more points). An RFID reader scans user cards for identification. A webcam detetcs when users are recycling, etc..

The program manages a point reward system. Users earn points when they recycle items. The system decides how many points to give based on sensor readings. All sensor data gets saved to CSV files for later use.

## Data Flow Process

Sensor data starts at the Raspberry Pi. The Pi sends data through MQTT to the WSL system (at the same time data is stored in InfluxDB for backup and general visualizations in Grafana). The WSL system saves data to CSV files. A script moves CSV files to Windows. Another script uploads CSV data to Firebase. The website reads data from Firebase to show users.

## Data Storage

Firebase stores data in several collections. Each sensor type has its own collection. User information and points have separate collections. This organization makes data easy to access and display.

Local CSV files keep backup copies of all data. Sensor readings go to one CSV file. User information goes to another. Point history goes to a third file. This ensures no data gets lost if systems disconnect. Moreover, all these data are stored in InfluxDB too.

## Usage

### Clone the repository:
```bash
git clone https://github.com/aratzBergado/IoTProject-Group-8-.git
```

### Dependencies

This project requires Python3 and the following libraries:

- OpenCV
- Paho MQTT
- InfluxDB Client
- Pandas
- Firebase Admin SDK
- MFRC522 RFID library
- Grove sensor libraries

Note: Some libraries (RPi.GPIO, Grove, MFRC522) are designed for the Raspberry Pi hardware (sensors). In order to run the code Firebase credentails are necessary. Contact us for more information.

### Install Dependencies
#### System Dependencies
```bash
sudo apt update
sudo apt install -y python3-pip python3-opencv python3-rpi.gpio
```

#### Python Dependencies
```bash
pip install opencv-python paho-mqtt influxdb-client pandas firebase-admin mfrc522 grove.py
```
Note: firebase libraries are for the local host (running the WebPage), the rest of them are Python dependencies for the system (Raspberry).

#### WSL Dependencies
```bash
sudo apt update
sudo apt install inotify-tools
```





