// Full-screen "stamped" confirmation shown after publishing, binding or saving,
// just before the page redirects.
Component({
  properties: {
    show: { type: Boolean, value: false },
    text: { type: String, value: "" },
    sub: { type: String, value: "" },
  },
});
