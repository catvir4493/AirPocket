const { iconSrc } = require("../../utils/icons");
const { resolveColor, onThemeChange } = require("../../utils/theme");

Component({
  properties: {
    name: {
      type: String,
      value: "",
    },
    // A theme token ("ink", "ink-2", "ink-3", "faint") or a fixed hex colour.
    color: {
      type: String,
      value: "ink",
    },
    // Edge length in rpx.
    size: {
      type: Number,
      value: 36,
    },
    stroke: {
      type: Number,
      value: 1.8,
    },
  },

  data: {
    src: "",
  },

  observers: {
    "name, color, stroke"() {
      this.refresh();
    },
  },

  lifetimes: {
    attached() {
      this.refresh();
      this.offTheme = onThemeChange(() => this.refresh());
    },
    detached() {
      if (this.offTheme) {
        this.offTheme();
      }
    },
  },

  methods: {
    refresh() {
      const { name, color, stroke } = this.data;
      const src = name ? iconSrc(name, resolveColor(color), stroke) : "";
      if (src !== this.data.src) {
        this.setData({ src });
      }
    },
  },
});
