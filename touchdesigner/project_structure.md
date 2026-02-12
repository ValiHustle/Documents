# Project structure (TouchDesigner)

```
/project1
  /base_kinect
    in_device_or_bridge
    null_color
    null_depth
    null_body
    out1

  /base_tracking
    in1_color
    scriptCHOP_landmarks
    null_hand
    textDAT_hand_tracker
    executeDAT_hand_tracker
    out1

  /base_logic
    tableDAT_shapes
    textDAT_spawn_shapes
    textDAT_pinch_logic
    executeDAT_pinch_logic
    out1

  /base_render
    in1_video
    in2_hand
    in3_shapes
    transform_mirror
    scriptTOP_draw
    feedback_trail
    composite_out
    out1

  /base_ui
    button_start
    toggle_mirror
    toggle_trail
    text_status
```

## Data contracts

### Hand channels (`base_tracking/out1`)
- `hand_found` (0/1)
- `thumb_x`, `thumb_y`
- `index_x`, `index_y`
- `pinch_x`, `pinch_y`
- `pinch_dist`

### Shapes table (`base_logic/tableDAT_shapes`)
Columns:
- `id`
- `type` (`circle|square|triangle|diamond|star`)
- `x`, `y` (0..1)
- `vx`, `vy`
- `size`
- `color`
- `grabbed` (0/1)

