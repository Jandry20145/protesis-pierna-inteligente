#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// 1. Definición de pines según la tabla
#define I2C_SDA 33
#define I2C_SCL 32
#define FSR_TALON 34
#define FSR_PUNTA 35

// Instancia del sensor IMU
Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); } // Esperar a que inicie el monitor serie

  // 2. Inicializar el bus I2C con los pines redefinidos
  Wire.begin(I2C_SDA, I2C_SCL);

  Serial.println("Inicializando sensores de la prótesis...");

  // Inicializar MPU6050 pasándole el bus Wire modificado
  if (!mpu.begin(0x68, &Wire)) {
    Serial.println("Error: No se encontró el MPU6050. Revisa las conexiones.");
    while (1) { delay(10); } // Detener el código si hay error
  }
  
  // Configuración del MPU6050 para dinámica de marcha
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G); // Rango intermedio para impactos
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);      // Rango para rotación de pierna
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);   // Filtro pasa bajas para reducir ruido de impacto

  // Configurar pines de los FSR como entrada
  pinMode(FSR_TALON, INPUT);
  pinMode(FSR_PUNTA, INPUT);

  Serial.println("Sistema listo. Iniciando telemetría...");
}

void loop() {
  // 3. Leer valores de presión de los FSR (ADC de 12 bits: 0 a 4095)
  int fuerzaTalon = analogRead(FSR_TALON);
  int fuerzaPunta = analogRead(FSR_PUNTA);

  // 4. Leer cinemática del MPU6050
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // 5. Empaquetar y transmitir en formato JSON
  Serial.print("{");
  
  // Datos FSR
  Serial.print("\"fsr_talon\":"); Serial.print(fuerzaTalon); Serial.print(",");
  Serial.print("\"fsr_punta\":"); Serial.print(fuerzaPunta); Serial.print(",");
  
  // Datos Acelerómetro (m/s^2)
  Serial.print("\"acc_x\":"); Serial.print(a.acceleration.x); Serial.print(",");
  Serial.print("\"acc_y\":"); Serial.print(a.acceleration.y); Serial.print(",");
  Serial.print("\"acc_z\":"); Serial.print(a.acceleration.z); Serial.print(",");
  
  // Datos Giroscopio (rad/s)
  Serial.print("\"gyr_x\":"); Serial.print(g.gyro.x); Serial.print(",");
  Serial.print("\"gyr_y\":"); Serial.print(g.gyro.y); Serial.print(",");
  Serial.print("\"gyr_z\":"); Serial.print(g.gyro.z);
  
  Serial.println("}");

  // Frecuencia de muestreo: ~20 Hz (50 ms)
  delay(50); 
}