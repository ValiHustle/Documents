# DAT Execute / Frame callback helper for shape grabbing.
# Inputs:
#  - op('null_hand') with pinch_x/pinch_y/pinch_dist/hand_found
#  - op('tableDAT_shapes')

PINCH_GRAB_THRESHOLD = 0.055
PINCH_RELEASE_THRESHOLD = 0.085


def _f(row, name, default=0.0):
    try:
        return float(row[name].val)
    except Exception:
        return float(default)


def _set(row, name, value):
    row[name] = str(value)


def _distance(ax, ay, bx, by):
    dx = ax - bx
    dy = ay - by
    return (dx * dx + dy * dy) ** 0.5


def onFrameStart(frame):
    hand = op('null_hand')
    table = op('tableDAT_shapes')
    if hand is None or table is None or table.numRows < 2:
        return

    hand_found = float(hand['hand_found'][0]) if 'hand_found' in hand.chans else 0.0
    pinch_x = float(hand['pinch_x'][0]) if 'pinch_x' in hand.chans else 0.0
    pinch_y = float(hand['pinch_y'][0]) if 'pinch_y' in hand.chans else 0.0
    pinch_dist = float(hand['pinch_dist'][0]) if 'pinch_dist' in hand.chans else 1.0

    active_id = int(parent().fetch('active_shape_id', 0))

    if hand_found < 0.5:
        parent().store('active_shape_id', 0)
        for r in range(1, table.numRows):
            row = table.row(r)
            _set(row, 'grabbed', 0)
        return

    if active_id == 0 and pinch_dist < PINCH_GRAB_THRESHOLD:
        best_id = 0
        best_d = 999.0
        for r in range(1, table.numRows):
            row = table.row(r)
            x = _f(row, 'x')
            y = _f(row, 'y')
            size = _f(row, 'size', 0.04)
            d = _distance(pinch_x, pinch_y, x, y)
            if d < size * 2.0 and d < best_d:
                best_d = d
                best_id = int(_f(row, 'id'))

        if best_id > 0:
            active_id = best_id
            parent().store('active_shape_id', active_id)

    if active_id > 0 and pinch_dist > PINCH_RELEASE_THRESHOLD:
        active_id = 0
        parent().store('active_shape_id', 0)

    for r in range(1, table.numRows):
        row = table.row(r)
        rid = int(_f(row, 'id'))
        grabbed = 1 if rid == active_id else 0
        _set(row, 'grabbed', grabbed)

        if grabbed:
            _set(row, 'x', min(0.97, max(0.03, pinch_x)))
            _set(row, 'y', min(0.97, max(0.03, pinch_y)))
        else:
            x = _f(row, 'x') + _f(row, 'vx') * (1.0 / 60.0)
            y = _f(row, 'y') + _f(row, 'vy') * (1.0 / 60.0)

            if x <= 0.03 or x >= 0.97:
                _set(row, 'vx', -_f(row, 'vx'))
            if y <= 0.03 or y >= 0.97:
                _set(row, 'vy', -_f(row, 'vy'))

            _set(row, 'x', min(0.97, max(0.03, x)))
            _set(row, 'y', min(0.97, max(0.03, y)))
