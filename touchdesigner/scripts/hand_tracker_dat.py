# DAT Execute / Frame callback helper.
# This script expects hand input channels from your tracker or bridge:
# op('in_hand_raw') with channels: thumb_x, thumb_y, index_x, index_y, hand_found
# and writes normalized pinch channels into op('scriptCHOP_landmarks').


def _safe_chan(chop, name, default=0.0):
    try:
        return float(chop[name][0])
    except Exception:
        return float(default)


def onFrameStart(frame):
    raw = op('in_hand_raw')
    out_chop = op('scriptCHOP_landmarks')
    if raw is None or out_chop is None:
        return

    thumb_x = _safe_chan(raw, 'thumb_x')
    thumb_y = _safe_chan(raw, 'thumb_y')
    index_x = _safe_chan(raw, 'index_x')
    index_y = _safe_chan(raw, 'index_y')
    hand_found = _safe_chan(raw, 'hand_found')

    pinch_x = (thumb_x + index_x) * 0.5
    pinch_y = (thumb_y + index_y) * 0.5
    dx = thumb_x - index_x
    dy = thumb_y - index_y
    pinch_dist = (dx * dx + dy * dy) ** 0.5

    out_chop.clear()
    out_chop.appendChan('hand_found')[0] = hand_found
    out_chop.appendChan('thumb_x')[0] = thumb_x
    out_chop.appendChan('thumb_y')[0] = thumb_y
    out_chop.appendChan('index_x')[0] = index_x
    out_chop.appendChan('index_y')[0] = index_y
    out_chop.appendChan('pinch_x')[0] = pinch_x
    out_chop.appendChan('pinch_y')[0] = pinch_y
    out_chop.appendChan('pinch_dist')[0] = pinch_dist
