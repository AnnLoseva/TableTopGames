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

Кнопка: `GPIO3 → кнопка → GND`. В прошивке включён `INPUT_PULLUP`.

GPIO2 — strapping pin ESP32-C3. Обычный SSD1306 использует open-drain I²C и
подтягивает SCL к 3,3 В — это совместимо с загрузкой. Перед постоянным монтажом
обязательно сделать 10–20 холодных стартов с подключённым экраном. Линия GPIO2
не должна удерживаться в LOW во время reset. Если конкретный модуль мешает
старту, сначала проверить его питание/подтяжки; практический запасной вариант —
перенести SCL на свободный GPIO и изменить `AppConfig::OledScl`.

## Backend и переменные окружения

SQL-контракт: `src/features/esp32-oled/supabase/esp32_oled.sql`. Он создаёт
`esp32_devices`, challenges, DB-rate-limit, очередь с ACK, события и приватный
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

1. После первой загрузки OLED показывает сеть `OLED-Setup-XXXX`.
2. Подключиться к ней с iPhone и открыть `http://192.168.4.1` (обычно captive
   portal откроется сам).
3. Выбрать домашний Wi‑Fi, ввести пароль. Он сохраняется только в NVS платы.
4. Открыть `https://annloseva-ttg.xyz/esp-32-oled` и войти в аккаунт.
5. Удерживать кнопку 5 секунд. OLED покажет четырёхзначный PIN на 120 секунд.
6. Нажать «Добавить ESP32», ввести PIN и имя. Совпавшие PIN двух плат не
   выбираются наугад: сервер попросит создать новый код только на одной плате.

Для физического сброса Wi‑Fi удерживать кнопку при включении питания 8 секунд.
Из сайта доступна та же операция командой «Настроить Wi‑Fi заново». В обычной
работе удержание 5 секунд всегда создаёт PIN, а короткое действие срабатывает
только после отпускания.

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

Device endpoint'ы используют `X-Device-Id` и `Authorization: Bearer <token>`;
в базе хранится только HMAC token:

- `POST /api/esp32/device/register`
- `POST /api/esp32/device/pairing`
- `POST /api/esp32/device/poll`
- `GET /api/esp32/device/assets/:commandId?offset=&length=`
- `POST /api/esp32/device/commands/:commandId/ack`
- `POST /api/esp32/device/events`

## Деплой и проверка

1. Применить SQL к тому же Supabase project, который использует сайт.
2. Добавить два server-only env выше во все нужные Vercel environments.
3. Отправить изменения в подключённую Git-ветку или выполнить обычный для
   проекта production deploy.
4. Проверить `npm run test:esp32-oled`, `npm run lint`, `npm run build`.
5. После deploy проверить регистрацию/привязку/загрузку на физической плате.

Автоматически проверяются TypeScript, Next build, OLED1/RLE, security-инварианты
SQL и компиляция PlatformIO. Без физического железа невозможно подтвердить
конкретные подтяжки OLED, USB boot mode, реальную запись flash, captive portal
на конкретной версии iOS и полный TLS/download/ACK цикл. OTA пока нет: новую
прошивку загружают по USB. При смене CA домена trust anchor `TlsRoot.hpp` нужно
обновить и выпустить новую прошивку.

