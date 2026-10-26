const { illustrationSrc } = require("../../utils/illustrations");
const { getPalette, getTheme, onThemeChange } = require("../../utils/theme");

Component({
  properties: {
    name: {
      type: String,
      value: "suitcase",
    },
    // Size in rpx.
    width: {
      type: Number,
      value: 240,
    },
    height: {
      type: Number,
      value: 180,
    },
  },

  data: {
    src: "",
  },

  observers: {
    name() {
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
      const src = illustrationSrc(this.data.name, getPalette(), getTheme());
      if (src !== this.data.src) {
        this.setData({ src });
      }
    },
  },
});
