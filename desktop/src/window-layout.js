// Native geometry is authoritative; renderer CSS must not stretch the restore button.
const COMPACT_SIZE = 64;
const EDGE_GAP = 8;

function fitBounds(bounds, area) {
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))),
    width, height,
  };
}

function createWindowLayout(win, screen) {
  let compact = false;
  let expandedBounds;

  function dock() {
    const current = win.getBounds();
    const area = screen.getDisplayMatching(current).workArea;
    win.setBounds(fitBounds({
      x: area.x + area.width - COMPACT_SIZE - EDGE_GAP,
      y: current.y + (current.height - COMPACT_SIZE) / 2,
      width: COMPACT_SIZE, height: COMPACT_SIZE,
    }, area));
  }

  function setCompact(next) {
    if (typeof next !== 'boolean' || next === compact) return;
    if (next) {
      expandedBounds = win.getBounds();
      // Release platform constraints before shrinking (especially macOS).
      win.setMinimumSize(COMPACT_SIZE, COMPACT_SIZE);
      win.setMaximumSize(COMPACT_SIZE, COMPACT_SIZE);
      win.setResizable(false);
      dock();
    } else {
      win.setMaximumSize(0, 0);
      win.setMinimumSize(320, 420);
      win.setResizable(true);
      const previous = expandedBounds || { ...win.getBounds(), width: 420, height: 620 };
      win.setBounds(fitBounds(previous, screen.getDisplayMatching(previous).workArea));
    }
    compact = next;
    win.webContents.send('agent:event', { type: 'window', compact });
    if (!next) win.focus();
  }

  function refresh() {
    if (win.isDestroyed()) return;
    if (compact) dock();
    else win.setBounds(fitBounds(win.getBounds(), screen.getDisplayMatching(win.getBounds()).workArea));
  }

  return { setCompact, refresh };
}

module.exports = { createWindowLayout, fitBounds, COMPACT_SIZE };