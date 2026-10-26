// Draws a boarding-pass share image (5:4, as WeChat expects) on a hidden 2D canvas
// and resolves with its temp file path, or "" when drawing is not possible.
const W = 500;
const H = 400;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const fitText = (ctx, text, maxWidth) => {
  let value = `${text || ""}`;
  while (value.length > 1 && ctx.measureText(value).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return value === `${text || ""}` ? value : `${value}…`;
};

const draw = (ctx, info) => {
  const sans = '"PingFang SC", "Helvetica Neue", sans-serif';
  ctx.fillStyle = "#fffefa";
  ctx.fillRect(0, 0, W, H);

  // Card with a yellow date stub on the left.
  ctx.save();
  roundRect(ctx, 28, 40, W - 56, 250, 28);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(28, 28, 26, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, 28, 40, W - 56, 250, 28);
  ctx.clip();
  ctx.fillStyle = "#fff51f";
  ctx.fillRect(28, 40, 116, 250);
  ctx.restore();

  ctx.fillStyle = "#1c1c1a";
  ctx.textAlign = "center";
  ctx.font = `700 64px ${sans}`;
  ctx.fillText(info.day || "--", 86, 162);
  ctx.font = `700 20px ${sans}`;
  ctx.fillText(info.month || "", 86, 196);

  // Perforation between stub and body.
  ctx.strokeStyle = "rgba(28, 28, 26, 0.25)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(144, 56);
  ctx.lineTo(144, 274);
  ctx.stroke();

  // Route: from / to with a dashed line and a dot at each end.
  ctx.textAlign = "left";
  // Long city names step down a size before being cut.
  const longest = Math.max(`${info.from || ""}`.length, `${info.to || ""}`.length);
  ctx.font = `700 ${longest > 3 ? 30 : 36}px ${sans}`;
  ctx.fillText(fitText(ctx, info.from, 135), 170, 116);
  ctx.textAlign = "right";
  ctx.fillText(fitText(ctx, info.to, 135), W - 52, 116);
  ctx.strokeStyle = "rgba(28, 28, 26, 0.3)";
  ctx.beginPath();
  ctx.moveTo(176, 146);
  ctx.lineTo(W - 58, 146);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#1c1c1a";
  [176, W - 58].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 146, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Space type chip and the big weight.
  ctx.textAlign = "left";
  ctx.font = `600 20px ${sans}`;
  const chip = info.chip || "散件";
  const chipWidth = ctx.measureText(chip).width + 28;
  roundRect(ctx, 170, 214, chipWidth, 36, 18);
  ctx.fillStyle = "#f4f3ee";
  ctx.fill();
  ctx.fillStyle = "#55534c";
  ctx.fillText(chip, 184, 239);
  ctx.textAlign = "right";
  ctx.fillStyle = "#1c1c1a";
  ctx.font = `700 56px ${sans}`;
  ctx.fillText(`${info.weight}`, W - 84, 252);
  ctx.font = `600 22px ${sans}`;
  ctx.fillStyle = "#9a978c";
  ctx.fillText("kg", W - 52, 252);

  // Footer line.
  ctx.textAlign = "left";
  ctx.fillStyle = "#1c1c1a";
  ctx.font = `700 26px ${sans}`;
  ctx.fillText(info.headline || "有空余行李额，顺路帮带", 32, 342);
  ctx.fillStyle = "#9a978c";
  ctx.font = `500 20px ${sans}`;
  ctx.fillText("AirPocket · 行李空间共享", 32, 374);
};

const drawShareCard = (page, selector, info) =>
  new Promise((resolve) => {
    try {
      page
        .createSelectorQuery()
        .select(selector)
        .fields({ node: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node;
          if (!canvas) {
            resolve("");
            return;
          }
          canvas.width = W * 2;
          canvas.height = H * 2;
          const ctx = canvas.getContext("2d");
          ctx.scale(2, 2);
          draw(ctx, info);
          wx.canvasToTempFilePath({
            canvas,
            width: W,
            height: H,
            destWidth: W * 2,
            destHeight: H * 2,
            fileType: "png",
            success: (file) => resolve(file.tempFilePath),
            fail: () => resolve(""),
          });
        });
    } catch (error) {
      resolve("");
    }
  });

module.exports = { drawShareCard, draw, W, H };
