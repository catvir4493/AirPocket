// The tapped card lifts for a moment before the next page opens, so the tap reads as
// picking the card up; the detail page's boarding pass then drops in from above.
const LIFT_MS = 110;

const liftAndOpen = (ctx, id, url) => {
  if (ctx._lifting) {
    return;
  }
  ctx._lifting = true;
  ctx.setData({ liftId: id });
  setTimeout(() => {
    wx.navigateTo({
      url,
      complete: () => {
        ctx._lifting = false;
      },
    });
    // Settle the card back once the new page covers it.
    setTimeout(() => ctx.setData({ liftId: "" }), 450);
  }, LIFT_MS);
};

module.exports = { liftAndOpen };
