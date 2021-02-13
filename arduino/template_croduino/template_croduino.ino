#include <ESP8266WiFi.h>
#include <Servo.h>
#include "DHT.h"

//wifi part
const char* wifi_ssid = "";
const char* wifi_password = "";
const char* host = "192.168.1.2";
const uint16_t host_port = 8081;

WiFiClient client;
//wifi part end

//servo part
#define SERVO_PIN 12
Servo servo;
//servo part end

//DHT part
#define DHT_PIN 13
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);
//DHT part end

//variables
float temperature = 0.0;
float humidity = 0.0;
int servo_position = 90;
String POST_data = "";
//variables end

//constants
const String UUID = "798e8266-6f3c-3bf5-b8c8-56fb14b60a56";
const String userUUID = "5e0a6e2d-90f6-45a5-ae1a-d26e8e42b68e";
//constants end

float float_map(float x, float in_min, float in_max, float out_min, float out_max) {
  //sanity check for out of bounds values
  if (x <= in_min)
    x = in_min;
  if (x >= in_max)
    x = in_max;

  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

void setup() {
  Serial.begin(115200);
  Serial.println("Begin");

  //servo setup
  servo.attach(SERVO_PIN);
  //servo setup end

  //DHT setup
  dht.begin();
  //DHT setup end

  //wifi setup
  Serial.println("WiFi setup...");
  WiFi.begin(wifi_ssid, wifi_password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("_-");
  }
  Serial.print("Connected to WiFi, local IP adress is: ");
  Serial.println(WiFi.localIP());

  Serial.print("Now connecting to: ");
  Serial.print(host);
  Serial.print(":");
  Serial.println(host_port);

  if (!client.connect(host, host_port)) {
    Serial.println("Can't connect to the web page");
    return;
  }

  Serial.println("Connected to web page");
  client.print(String("GET ") + "/test HTTP/1.1\r\n Host: " + host + "\r\nConnection: close\r\n\r\n");
  delay(20);

  while (client.available()) {
    String line = client.readStringUntil('\r');
    Serial.print(line);
  }
  Serial.println("WiFi setup done.");
  //wifi setup end
}

void loop() {
  delay(55000);//delay as to not swamp the database with too fine data

  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor.");
    return;
  }
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println("°C");
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println("%");

  servo_position = round(float_map(temperature, 0, 40, 20, 160));
  Serial.print("Moving servo according to temperature to ");
  Serial.print(servo_position);
  Serial.println("°");
  servo.write(servo_position);

  if (WiFi.status() == WL_CONNECTED) {
    if (client.connect(host, host_port)) {
      POST_data = "{\"user_id\":\"" + userUUID + "\",\"device_id\":\"" + UUID + "\",\"temperature\":" + temperature + ",\"humidity\":" + humidity + "}";
      Serial.println(POST_data);
      client.println("POST /new_entry HTTP/1.1");
      client.print("Host: ");
      client.println(host);
      client.println("Cache-Control: no-cache");
      client.println("Content-Type: application/json");
      client.print("Content-Length: ");
      client.println(POST_data.length());
      client.println();
      client.println(POST_data);

      long interval = 2000;
      unsigned long currentMillis = millis(), previousMillis = millis();

      while (!client.available()) {
        if ((currentMillis - previousMillis) > interval) {
          Serial.println("Timeout...");
          client.stop();
          break;
        }
        currentMillis = millis();
      }

      while (client.connected()) {
        if (client.available()) {
          char str = client.read();
          Serial.print(str);
        }
      }
    }
  }

  Serial.println();
}
