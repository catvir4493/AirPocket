const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const isCollectionMissing = (error) =>
  `${error.message || error.errMsg || error}`.toLowerCase().includes("not exist");

const sanitizeBagForSender = (bag) => {
  const { carrierWechat, carrierReceiveAddress, ...safeBag } = bag;
  return safeBag;
};

exports.main = async () => {
  try {
    const result = await db
      .collection("bags")
      .where({
        status: "active",
        remainingWeight: _.gt(0),
      })
      .orderBy("departureDate", "asc")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return {
      success: true,
      data: (result.data || []).map(sanitizeBagForSender),
    };
  } catch (error) {
    if (isCollectionMissing(error)) {
      return {
        success: true,
        data: [],
      };
    }
    return {
      success: false,
      errMsg: error.message || "getBags failed",
    };
  }
};
