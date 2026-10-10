# ESP32-C3 + OLED: установка и эксплуатация

Система состоит из страницы `/esp-32-oled`, same-origin API в Next.js,
server-only таблиц/приватного bucket в Supabase и прошивки PlatformIO в
`firmware/esp32-oled`. Браузер никогда не обращается к локальному IP платы:
ESP32 сама делает исходящие HTTPS-запросы к `annloseva-ttg.xyz`.

## Подключение

| OLED SSD1306 | ESP32-C3 SuperMini |
|---|---|
| VDD | 3V3 |
| GND | GND |
| SDA | GPIO0 |
| SCL | GPIO2 |

Кнопка: `GPIO5 → кнопка → GND`. В прошивке включён `INPUT_PULLUP`.

GPIO2 — strapping pin ESP32-C3. Обычный SSD1306 использует open-drain I²C и
подтягивает SCL к 3,3 В — это совместимо с загрузкой. Перед постоянным монтажом
обязательно сделать 10–20 холодных стартов с подключённым экраном. Линия GPIO2
не должна удерживаться в LOW во время reset. Если конкретный модуль мешает
старту, сначала проверить его питание/подтяжки; практический запасной вариант —
перенести SCL на свободный GPIO и изменить `AppConfig::OledScl`.

## Backend и переменные окружения

SQL-контракт: `src/features/esp32-oled/supabase/esp32_oled.sql`. Он создаёт
`esp32_devices`, challenges, DB-rate-limit, очередь с ACK, события,
`esp32_gift_invites` и приватный
bucket `esp32-oled-assets`. `anon` и `authenticated` не имеют прямого доступа к
этим таблицам: пользователь и устройство проходят через проверяемые API сайта.

В Vercel нужны:

```text
NEXT_PUBLIC_SUPABASE_URL           уже используется сайтом
NEXT_PUBLIC_SUPABASE_ANON_KEY      уже используется сайтом
SUPABASE_SERVICE_ROLE_KEY          только server-side, никогда NEXT_PUBLIC_
ESP32_API_HMAC_SECRET              случайная строка минимум 32 символа
```

Секрет HMAC можно создать на Mac командой `openssl rand -hex 32`. Его нельзя
помещать в прошивку, браузерный код или Git. После добавления env выполнить
новый production deploy. При ротации HMAC существующие токены и активные PIN
перестанут проходить проверку; это нужно планировать как миграцию.

## Прошивка с Mac

### Через Arduino IDE

1. Открыть `firmware/esp32-oled/arduino/esp32_oled/esp32_oled.ino`.
2. В Boards Manager установить `esp32 by Espressif Systems`, затем выбрать
   `ESP32C3 Dev Module`. В Tools выбрать Flash Size `4MB`, Flash Mode `DIO`,
   USB CDC On Boot `Enabled` и Partition Scheme `Custom`.
3. В Library Manager установить `ArduinoJson`, `Adafruit GFX Library` и
   `Adafruit SSD1306`.
4. Подключить плату, выбрать её USB-порт и нажать Upload. Для самой первой
   прошивки можно один раз включить Erase All Flash Before Sketch Upload.
   Локальный `partitions.csv` будет использован автоматически.

Скетч подключает канонические модули из `firmware/esp32-oled/src` и `include`,
поэтому Arduino IDE и PlatformIO собирают одну и ту же прошивку. Кнопка версии
1.2.1 подключается между `GPIO5` и `GND`.

В 1.2.1 OLED и кнопка обслуживаются приоритетным Arduino loop, а HTTPS,
регистрация, PIN pairing, polling, события, ACK и скачивание файлов — отдельной
низкоприоритетной FreeRTOS-задачей. На одноядерном ESP32-C3 это не даёт второго
процессора, но позволяет планировщику немедленно вытеснять сетевую задачу ради
кадра. Задачи обмениваются копируемыми очередями; OLED доступен только loop,
LittleFS защищён mutex, а финальная замена активного слота выполняется после
закрытия файла воспроизведения.

### Через PlatformIO

1. Подключить ESP32-C3 качественным data-кабелем USB-C.
2. Установить PlatformIO 6.1.18 в виртуальное окружение:

   ```bash
   python3 -m venv .venv-pio
   source .venv-pio/bin/activate
   pip install platformio==6.1.18
   cd firmware/esp32-oled
   pio run
   pio device list
   pio run -t upload --upload-port /dev/cu.usbmodemXXXX
   ```

3. Если порт не появился, удерживать BOOT, коротко нажать RESET, отпустить
   BOOT и повторить `pio device list`/upload.
4. Для диагностики: `pio device monitor -b 115200`. Прошивка не печатает в
   Serial пароль Wi‑Fi, device token или pairing PIN.

`platformio.ini` фиксирует версии platform/toolchain/библиотек. Разметка
ориентирована на реальную 4 MB SuperMini и оставляет LittleFS около 960 КБ;
прошивка всё равно сообщает серверу фактические `ESP.getFlashChipSize()`,
`LittleFS.totalBytes()` и `LittleFS.usedBytes()`. Не заменять partitions на
«16 MB» без проверки маркировки/flash ID конкретной платы.

## Первое подключение

1. После первой загрузки OLED показывает `SETUP WIFI`, сеть
   `OLED-Setup-XXXX` и строку `PASS` с уникальным восьмизначным цифровым
   паролем конкретной платы. WPA2 не допускает пароль короче восьми символов.
   Для подготовленного подарка тот же пароль уже зашит в Wi‑Fi QR на карточке.
2. Отсканировать QR с карточки. Если iOS Captive Network Assistant не открыл
   страницу, остаться подключённой к этой сети и открыть
   `http://192.168.4.1`.
3. Выбрать домашний Wi‑Fi 2,4 ГГц и ввести пароль. Portal остаётся открыт:
   неправильный пароль показывает ошибку и разрешает повторить попытку без
   reboot. Успех показывается только после подтверждения backend.
4. Открыть `https://annloseva-ttg.xyz/esp-32-oled` и войти в аккаунт.
5. Удерживать кнопку 5–9 секунд и отпустить. OLED покажет четырёхзначный PIN
   только после подтверждённой сервером публикации, на 120 секунд.
6. Нажать «Добавить ESP32», ввести PIN и имя. Совпавшие PIN двух плат не
   выбираются наугад: сервер попросит создать новый код только на одной плате.

Для физического сброса Wi‑Fi удерживать кнопку 10 секунд и отпустить. Решение
принимается только после отпускания: на пятой секунде PIN не запускается.
Сброс удаляет только `ssid`/`wifi-pass`; токен, Device ID, LittleFS, активный
слот, яркость, скорость и действия кнопки остаются. Из сайта доступна та же
операция командой «Set up Wi-Fi again».

## Подготовка подарка для Tali

1. Обновить плату до firmware 1.2.1 **без Erase All Flash**, включить и дождаться
   online на `/esp-32-oled`.
2. Загрузить GIF/картинки, выбрать активную анимацию и настроить OLED/кнопку.
3. Открыть устройство → **Prepare as a gift**. Мастер проверит связь, память,
   активную анимацию и уникальные setup credentials.
4. Найти `tali`, проверить анимацию и отправить приглашение.
5. Tali входит в существующий аккаунт и нажимает **Accept my gift**. Сервер
   атомарно меняет владельца, отменяет старые команды и ставит Wi‑Fi-only reset.
6. Не отключать питание до **Setup mode confirmed**, затем распечатать
   персональную карточку. PIN для этого сценария не нужен.

После принятия прежний владелец теряет API-доступ. Плата сохраняет Device ID,
token, файлы, manifest, настройки и подарочную анимацию. Получатель видит её в
своих устройствах сразу, даже пока она offline.

### Короткая инструкция для Tali

1. Подключи OLED к обычному USB-питанию.
2. Наведи камеру iPhone на QR с карточки и подключись к сети OLED.
3. Выбери домашний Wi‑Fi. Если окно не открылось, открой `192.168.4.1`.
4. После зелёного подтверждения открой сайт под аккаунтом `tali` — устройство
   уже будет в списке, без PIN и компьютера.

Печатный preview: `output/pdf/esp32-oled-gift-card-preview.pdf`. Его QR открывает
страницу и проверяет макет. Финальную карточку печатать из шага 5: только мастер
подставляет Wi‑Fi QR с SSID и уникальным паролем конкретной ESP32.

## Состояния и диагностика

Portal, Serial и сайт различают Wi-Fi unset, connecting, connected, no
internet, TLS error, server unavailable, registration error, registered,
waiting for gift acceptance и ready. При падении сети записанная анимация
продолжает работать, reconnect автоматический.

Serial не печатает PIN, token или пароли. Он сообщает Wi-Fi/Internet/TLS,
успешную регистрацию и публикацию pairing, HTTP-коды backend и готовность для
получателя. `/api/esp32/user/diagnostics` проверяет server-only env и таблицу;
UI показывает `Administrator action required`, а не ошибочный «wrong PIN».

## Формат и передача файлов

Браузер декодирует PNG/JPG/WebP/GIF, масштабирует в 128×64, применяет
яркость/контраст/порог/инверсию/Floyd–Steinberg и формирует SSD1306 page buffer
по 1024 байта на кадр. Контейнер `OLED1` хранит длительность каждого кадра и
byte-run RLE. GIF ограничен 240 итоговыми кадрами, файл — 2 МБ.

Файл сначала попадает в приватный Storage. ESP32 получает команду, скачивает
его range-частями по 4096 байт в `.tmp`, проверяет размер и SHA‑256, затем
атомарно меняет текущий слот через `.bak`. При обрыве остаётся прежний файл,
а повтор команды продолжает `.tmp` с его фактического размера. Веб-интерфейс
показывает успех только после device ACK; затем временный объект удаляется из
Storage.

## API

Пользовательские endpoint'ы проверяют Supabase Auth cookie:

- `GET /api/esp32/user/devices`
- `POST /api/esp32/user/pair`
- `PATCH|DELETE /api/esp32/user/devices/:id`
- `POST /api/esp32/user/devices/:id/commands`
- `POST /api/esp32/user/devices/:id/assets`
- `GET /api/esp32/user/commands/:id`
- `GET|POST|PATCH /api/esp32/user/gifts`
- `GET /api/esp32/user/recipients?username=...`
- `GET /api/esp32/user/diagnostics`

Device endpoint'ы используют `X-Device-Id` и `Authorization: Bearer <token>`;
в базе хранится только HMAC token:

- `POST /api/esp32/device/register`
- `POST /api/esp32/device/pairing`
- `POST /api/esp32/device/poll`
- `GET /api/esp32/device/assets/:commandId?offset=&length=`
- `POST /api/esp32/device/commands/:commandId/ack`
- `POST /api/esp32/device/events`

## Деплой и проверка

1. Сначала применить обновлённый SQL к тому же Supabase project. Он добавляет
   private `esp32_gift_invites`, setup AP columns и service-role-only RPCs.
2. Добавить два server-only env выше во все нужные Vercel environments.
3. Затем выполнить production deploy сайта и проверить, что авторизованный
   `/api/esp32/user/diagnostics` возвращает `ready: true`.
4. Проверить `npm run test:esp32-oled`, `npm run lint`, `npm run build`.
5. Обновить firmware обычным upload **без** `Erase All Flash`: полное стирание
   уничтожит NVS identity и LittleFS. После deploy проверить физическую плату.

Serial monitor раз в 10 секунд печатает `fps` и `max_frame_gap_ms`; те же
значения видны в диагностике устройства на сайте после очередного polling.
Для проверки плавности сравнивать нужно длинный непрерывный участок обычного
воспроизведения: показ PIN, captive portal и ручная пауза намеренно исключаются
из измерительного окна.

Автоматически проверяются TypeScript, Next build, OLED1/RLE, security-инварианты
SQL/gift RPC, release-duration кнопки, captive endpoints, ACK-before-reset и
компиляция PlatformIO. Без физического железа нельзя подтвердить неправильный
Wi-Fi/обрыв интернета, конкретную iOS CNA, запись NVS/LittleFS, live-передачу
аккаунту `tali` и полный TLS/download/ACK цикл. Не считать эти сценарии
пройденными только по unit/build результатам. OTA пока нет: новую
прошивку загружают по USB. При смене CA домена trust anchor `TlsRoot.hpp` нужно
обновить и выпустить новую прошивку.
