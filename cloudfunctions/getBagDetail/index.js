const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const sanitizeBagForSender = (bag) => {
  const { carrierWechat, carrierReceiveAddress, ...safeBag } = bag;
  return safeBag;
};

exports.main = async (event = {}) => {
  if (!event.bagId) {
    return {
      success: false,
      errMsg: "bagId is required",
    };
  }

  try {
    const wxContext = cloud.getWXContext();
    const result = await db.collection("bags").doc(event.bagId).get();
    if (!result.data) {
      return {
        success: false,
        errMsg: "Bag not found",
      };
    }
    const bag = result.data;
    return {
      success: true,
      data: bag.carrierId === wxContext.OPENID ? bag : sanitizeBagForSender(bag),
    };
  } catch (error) {
    return {
      success: false,
      errMsg: error.message || "getBagDetail failed",
    };
  }
};
