#!/bin/bash
# Configuration to send data from WSL to Windows without touching anything. 
# This files checks updates in the CSV files and if it detects any change in sends the data to Windows
WATCH_DIR="/home/ander_pala/IOT/"  # Directory for CSV in wsl
WINDOWS_DIR="/mnt/c/Users/Ander Pala/WorkFolder/Deusto/IOT/data/" # Directory to send data

echo "Monitoreando archivos CSV del sistema Campus..."
echo "📂 Origen: $WATCH_DIR"
echo "💾 Destino: $WINDOWS_DIR"
echo ""

# Monitorear los 4 archivos principales del subscriber
inotifywait -m -e close_write "$WATCH_DIR" |
while read path action file; do
    case "$file" in
        "sensor_data.csv"|"users_registry.csv"|"points_history.csv"|"system_events.csv")
            echo "Cambio detectado en: $file"
            cp "$WATCH_DIR/$file" "$WINDOWS_DIR/$file"
            echo "Copiado a Windows"
            ;;
    esac
done
