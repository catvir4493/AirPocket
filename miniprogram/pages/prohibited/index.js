const { showToast } = require("../../utils/toast");

Page({
  data: {
    statementOpen: false,
    statementText:
      "用户在本平台发布、接单、交付或携带任何物品前，应自行确认该物品符合中国、匈牙利、欧盟及航空公司、机场、海关、检疫、安检等相关规定。平台仅提供信息撮合服务，不作为承运人、货运代理、报关代理、海关申报主体或物品合法性的保证方。寄件方应保证所交付物品真实、合法、可携带、可进出境，并已如实告知物品名称、数量、价值、用途及可能涉及的申报要求；携带方有权要求查看、核验物品，并可拒绝携带任何不明、封闭、可疑或可能违反规定的物品。因用户携带、交付、隐瞒、虚假描述、未申报、申报不实或违反中国、匈牙利、欧盟及相关国家/地区法律法规导致的查验、扣留、没收、退运、销毁、罚款、补税、行政处罚、刑事责任、航班延误、损失赔偿或第三方索赔，均由相关用户自行承担；在法律允许的最大范围内，平台不承担任何直接或间接责任。平台有权基于风险控制需要，删除违规信息、取消订单、冻结或限制账号、配合监管机关调查，并向受影响用户追偿平台因此遭受的损失。",
    riskItems: [
      {
        title: "禁止或高度敏感物品",
        icon: "alert",
        detail:
          "武器、弹药、爆炸物、毒品、精神药物、烈性毒药、危险化学品、易燃易爆品、仿真武器、伪造货币、有价证券、侵权或假冒商品等不得携带或交付。",
      },
      {
        title: "动植物、食品与检疫相关物品",
        icon: "shield",
        detail:
          "活动物、植物、种子、土壤、肉奶蛋及其制品、部分食品、中药材、标本、动植物产品等可能受到海关和检疫严格限制。",
      },
      {
        title: "烟酒、现金、贵金属和高价值商品",
        icon: "scale",
        detail:
          "烟酒、现金、黄金、贵金属、奢侈品、电子产品、商业样品等可能涉及数量、税费、申报或商业用途判断。",
      },
      {
        title: "药品、处方药、保健品和液体粉末类",
        icon: "info",
        detail:
          "药品、保健品、处方药、液体、粉末、喷雾、电池类物品需提前确认用途、包装、数量、航空和入境规则。",
      },
      {
        title: "无法说明来源或内容的物品",
        icon: "search",
        detail:
          "不明、封闭、无标签、描述不清、与实际不符、无法核验或可能需要申报但未说明的物品，携带方可直接拒绝。",
      },
    ],
    sourceItems: [
      {
        title: "中国海关 / 中国国际贸易单一窗口禁限物品目录",
        url: "https://npc.chinaport.gov.cn/npcdeclhome/home/pages/notice/%E7%AE%A1%E9%99%90%E7%9B%AE%E5%BD%95.html",
      },
      {
        title: "中国海关总署第43号《中华人民共和国禁止、限制进出境物品表》",
        url: "https://www.customs.gov.cn/customs/2005-09/29/article_2025121221013835783.html",
      },
      {
        title: "匈牙利 NAV 旅客海关规则 PDF",
        url: "https://nav.gov.hu/pfile/file?path=%2Fkiadvanyok%2Futastaj%2Fidegennyelvu-utastajekoztatok%2FInformation_for_Travellers.pdf-en",
      },
      {
        title: "欧盟 Your Europe：旅行可携带物品说明",
        url: "https://europa.eu/youreurope/citizens/travel/carry/index_en.htm",
      },
      {
        title: "欧盟委员会：行李中可携带消费品说明",
        url: "https://commission.europa.eu/news-and-media/news/consumer-goods-you-can-carry-your-suitcase-2025-07-22_en",
      },
    ],
  },

  toggleStatement() {
    this.setData({ statementOpen: !this.data.statementOpen });
  },

  copySourceLink(event) {
    const { url } = event.currentTarget.dataset;
    if (!url) {
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => {
        showToast({
          title: "链接已复制",
          icon: "success",
        });
      },
    });
  },

  goHome() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: "/pages/index/index",
        });
      },
    });
  },
});
