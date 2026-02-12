# TouchDesigner template (Windows + Kinect v2)

Готовая структура для интерактива с трекингом руки и жестом pinch под **TouchDesigner 2023+** на **Windows** с **Kinect 2.0**.

## Что внутри

- `project_structure.md` — схема COMP/CHOP/TOP и связи между ними.
- `scripts/hand_tracker_dat.py` — DAT Execute логика чтения landmark-данных и отправки в CHOP channels.
- `scripts/pinch_logic_dat.py` — DAT Execute логика pinch-захвата и перетаскивания фигур.
- `scripts/spawn_shapes_dat.py` — инициализация фигур (позиции/цвета/типы).

## Требования

1. Windows 10/11
2. Kinect for Windows SDK 2.0
3. Kinect Runtime 2.0
4. TouchDesigner 2023+
5. Для hand-tracking:
   - либо встроенный Python + mediapipe в отдельном процессоре,
   - либо внешний поток landmarks (OSC/JSON/TCP) в TD.

> Для Kinect v2 удобно использовать глубину/силуэт/позицию скелета от Kinect и комбинировать с hand landmarks от внешнего трекера.

---

## Быстрый старт (рекомендуемый пайплайн)

### 1) Создайте контейнеры в `/project1`

- `base_kinect`
- `base_tracking`
- `base_logic`
- `base_render`
- `base_ui`

### 2) Kinect-вход (`base_kinect`)

Ожидаемая сеть:

- `kinectazure/device` *(если Kinect TOP/CHOP отсутствует — используйте совместимый плагин Kinect v2 для вашей сборки)*
- `null_depth`
- `null_color`
- `null_body`

Выведите в `out1`:
- `color_top`
- `depth_top`
- `body_chop`

### 3) Tracking (`base_tracking`)

- `in1` (цвет из `base_kinect`)
- `scriptCHOP_landmarks`
- `null_hand`
- `textDAT_hand_tracker` (код из `scripts/hand_tracker_dat.py`)
- `executeDAT_hand_tracker` (onFrameStart)

`scriptCHOP_landmarks` каналы:
- `thumb_x`, `thumb_y`
- `index_x`, `index_y`
- `pinch_x`, `pinch_y`
- `pinch_dist`
- `hand_found`

### 4) Логика (`base_logic`)

- `tableDAT_shapes`
- `textDAT_spawn_shapes` (код из `scripts/spawn_shapes_dat.py`)
- `textDAT_pinch_logic` (код из `scripts/pinch_logic_dat.py`)
- `executeDAT_pinch_logic` (onFrameStart)
- `null_logic`

### 5) Рендер (`base_render`)

- `in1` (video/color)
- `in2` (hand channels)
- `in3` (shape table)
- `composite1`
- `feedback1` + `level1` (шлейф)
- `out1`

### 6) UI (`base_ui`)

- `button COMP` Start
- `text TOP` status
- переключатели: mirror / trail / glow

---

## Зеркалирование (важно)

Чтобы не было рассинхрона «рука в одну сторону, модель в другую»:

- Зеркальте **в одном месте**:
  - либо видео TOP (`Transform TOP scale X = -1`),
  - либо координаты landmark (`x = 1 - x`),
- **не делайте оба варианта одновременно**.

Для этого шаблона по умолчанию:
- видео зеркалим в `base_render/transform_mirror`
- landmarks оставляем в исходных координатах.

---

## Kinect 2.0 заметки

- Kinect v2 официально старый, поэтому конкретный node может отличаться по сборке TD.
- Если прямого Kinect CHOP/TOP нет — берите цвет/глубину из внешнего bridge-приложения и подавайте в TD по Spout/NDI/OSC.
- Логику pinch в этом шаблоне это не ломает: ей нужны только `thumb/index/pinch` каналы.

