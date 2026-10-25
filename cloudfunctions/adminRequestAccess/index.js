const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

const toMessage = (error) => `${error.message || error.errMsg || error}`;

const isCollectionMissing = (error) =>
  toMessage(error).toLowerCase().includes("not exist");

const ensureAdminRequestsCollection = async () => {
  try {
    await db.createCollection("adminRequests");
  } catch (error) {
    // Collection already exists in normal operation.
  }
};

const getExistingRequest = async (openid) => {
  try {
    const result = await db
      .collection("adminRequests")
      .where({
        openid,
      })
      .limit(1)
      .get();
    return result.data[0] || null;
  } catch (error) {
    if (isCollectionMissing(error)) {
      return null;
    }
    throw error;
  }
};

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return fail("openid is required");
    }

    await ensureAdminRequestsCollection();
    const now = new Date();
    const existing = await getExistingRequest(OPENID);

    if (existing) {
      await db.collection("adminRequests").doc(existing._id).update({
        data: {
          status: existing.status === "approved" ? "approved" : "pending",
          updatedAt: now,
        },
      });
    } else {
      await db.collection("adminRequests").add({
        data: {
          openid: OPENID,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return {
      success: true,
      data: {
        openid: OPENID,
        status: existing && existing.status === "approved" ? "approved" : "pending",
      },
    };
  } catch (error) {
    return fail(error.message || "adminRequestAccess failed");
  }
};
