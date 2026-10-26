// Capacity bar for a bag: coloured segments (already booked, your request, each binding)
// over the free space, with a legend that adds up equal labels.
const pct = (value, total) => (total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0);
const round1 = (value) => Math.round(value * 10) / 10;

Component({
  properties: {
    total: { type: Number, value: 0 },
    // [{ value, tone: "taken" | "mine" | "bound", label }]
    segments: { type: Array, value: [] },
    unit: { type: String, value: "kg" },
    freeLabel: { type: String, value: "剩余" },
  },

  data: {
    bars: [],
    legend: [],
  },

  observers: {
    "total, segments"(total, segments) {
      let used = 0;
      const legend = [];
      const bars = (segments || []).map((segment, index) => {
        const value = Math.max(0, Number(segment.value) || 0);
        const left = pct(used, total);
        const bar = { key: index, tone: segment.tone, left, width: Math.min(pct(value, total), 100 - left) };
        used += value;
        const entry = legend.find((item) => item.label === segment.label);
        if (entry) {
          entry.value = round1(entry.value + value);
        } else {
          legend.push({ label: segment.label, tone: segment.tone, value: round1(value) });
        }
        return bar;
      });
      legend.push({ label: this.data.freeLabel, tone: "free", value: round1(Math.max(0, total - used)) });
      this.setData({ bars, legend });
    },
  },
});
