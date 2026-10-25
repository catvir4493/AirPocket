const { iconSrc } = require("../../utils/icons");

Component({
  properties: {
    name: {
      type: String,
      value: "",
    },
    color: {
      type: String,
      value: "#1c1c1a",
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
    },
  },

  methods: {
    refresh() {
      const { name, color, stroke } = this.data;
      const src = name ? iconSrc(name, color, stroke) : "";
      if (src !== this.data.src) {
        this.setData({ src });
      }
    },
  },
});
