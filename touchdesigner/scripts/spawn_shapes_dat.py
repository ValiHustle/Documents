# TouchDesigner Text DAT helper
# Run manually once to initialize tableDAT_shapes.

def onCook(dat):
    table = op('tableDAT_shapes')
    if table is None:
        return

    table.clear()
    table.appendRow(['id', 'type', 'x', 'y', 'vx', 'vy', 'size', 'color', 'grabbed'])
    table.appendRow(['1', 'circle', '0.22', '0.30', '0.06', '0.03', '0.045', '#35e6c4', '0'])
    table.appendRow(['2', 'square', '0.48', '0.62', '-0.05', '0.04', '0.040', '#8e9eff', '0'])
    table.appendRow(['3', 'triangle', '0.70', '0.36', '0.04', '-0.06', '0.050', '#f3a0ff', '0'])
    table.appendRow(['4', 'diamond', '0.84', '0.58', '-0.03', '-0.05', '0.038', '#ffd166', '0'])
    table.appendRow(['5', 'star', '0.58', '0.18', '0.05', '0.02', '0.036', '#7aff9a', '0'])
