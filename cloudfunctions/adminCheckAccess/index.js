const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const toMessage = (error) => `${error.message || error.errMsg || error}`;

const isCollectionMissing = (error) =>
  toMessage(error).toLowerCase().includes("not exist");

const getAdminRecord = async (openid) => {
  try {
    const result = await db
      .collection("admins")
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

const getAdminAccess = async (openid) => {
  if (!openid) {
    return null;
  }

  const adminRecord = await getAdminRecord(openid);
  return adminRecord && adminRecord.status === "active" ? adminRecord : null;
};

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    const admin = await getAdminAccess(OPENID);

    return {
      success: true,
      data: {
        isAdmin: Boolean(admin),
        openid: OPENID || "",
        admin: admin
          ? {
              name: admin.name || "",
              role: admin.role || "admin",
              status: admin.status || "active",
            }
          : null,
      },
    };
  } catch (error) {
    return {
      success: true,
      data: {
        isAdmin: false,
        openid: "",
        admin: null,
      },
    };
  }
};
