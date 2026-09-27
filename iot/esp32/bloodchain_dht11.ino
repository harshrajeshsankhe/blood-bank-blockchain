/*
  BloodChain ESP32 + DHT11 example.

  Libraries:
    - WiFi
    - PubSubClient
    - DHT sensor library

  Hardware:
    DHT11 VCC -> 3.3V
    DHT11 GND -> GND
    DHT11 DATA -> GPIO 4

  IMPORTANT:
    Configure MQTT_HOST to the LAN IP of the machine running Mosquitto.
    Do not use localhost from the ESP32.
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* MQTT_HOST = "192.168.1.100";
const int MQTT_PORT = 1883;

const char* DELIVERY_ID = "DLV-DEMO-001";
const char* DEVICE_ID = "ESP32-001";

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
DHT dht(DHTPIN, DHTTYPE);

void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    mqtt.connect(DEVICE_ID);
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  connectWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (!isnan(temperature) && !isnan(humidity)) {
    String topic = String("bloodchain/delivery/") + DELIVERY_ID + "/temperature";
    String payload = "{\"deviceId\":\"" + String(DEVICE_ID) +
      "\",\"deliveryId\":\"" + String(DELIVERY_ID) +
      "\",\"temperatureC\":" + String(temperature, 2) +
      ",\"humidity\":" + String(humidity, 2) + "}";

    mqtt.publish(topic.c_str(), payload.c_str());
    Serial.println(payload);
  }

  delay(5000);
}
