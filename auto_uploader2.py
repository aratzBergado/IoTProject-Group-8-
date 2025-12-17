import subprocess
import time
import os
import sys
from datetime import datetime

# Configuration
SCRIPT_NAME = "upload_data.py" 
INTERVAL = 60  # 1 minute
LOG_FILE = "auto_upload_log.txt"

def run_script():
    """Ejecutar script con timeout"""
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Ejecutando {SCRIPT_NAME}...")
    
    try:
        # Timeout 30 seconds
        result = subprocess.run(
            [sys.executable, SCRIPT_NAME],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=30  # 30 secs max
        )
        
        # output
        if result.stdout:
            print(result.stdout[:500])  # Mostrar primeros 500 caracteres
        
        if result.stderr:
            print("ERRORES:", result.stderr[:200])
        
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("[ERROR] Timeout - Script tardó demasiado")
        return False
    except Exception as e:
        print(f"[ERROR] Ejecutando script: {e}")
        return False

def main():
    print("="*50)
    print("AUTO-UPLOADER (SOLO DATOS NUEVOS)")
    print(f"Script: {SCRIPT_NAME}")
    print(f"Intervalo: {INTERVAL} segundos")
    print("Ctrl+C para detener")
    print("="*50)
    
    count = 0
    success = 0
    
    try:
        while True:
            count += 1
            print(f"\n--- Ejecucion #{count} ---")
            
            if run_script():
                success += 1
                print(f"[OK] Ejecucion #{count} completada")
            else:
                print(f"[FALLO] Ejecucion #{count}")
            
            print(f"\nEsperando {INTERVAL} segundos...")
            time.sleep(INTERVAL)
            
    except KeyboardInterrupt:
        print(f"\n\nDetenido.")
        if count > 0:
            rate = (success / count * 100)
            print(f"Total ejecuciones: {count}")
            print(f"Exitos: {success}")
            print(f"Tasa de exito: {rate:.1f}%")

if __name__ == "__main__":
    if not os.path.exists(SCRIPT_NAME):
        print(f"Error: No se encuentra {SCRIPT_NAME}")
        sys.exit(1)
    
    main()