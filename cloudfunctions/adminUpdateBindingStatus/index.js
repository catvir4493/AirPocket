const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const BINDING_STATUSES = [
  "pending",
  "locked",
  "contacted",
  "picked_up",
  "packed",
  "delivered_to_carrier",
  "completed",
  "cancelled",
];

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

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

const assertAdmin = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error("Admin permission required");
  }

  const adminRecord = await getAdminRecord(OPENID);
  if (!adminRecord || adminRecord.status !== "active") {
    throw new Error("Admin permission required");
  }

  return OPENID;
};

const ensureAuditLogsCollection = async () => {
  try {
    await db.createCollection("auditLogs");
  } catch (error) {
    // Collection already exists in normal operation.
  }
};

const writeAuditLog = async ({ actorOpenid, binding, beforeStatus, afterStatus, note, now }) => {
  await ensureAuditLogsCollection();
  await db.collection("auditLogs").add({
    data: {
      actorOpenid,
      action: "updateBindingStatus",
      targetType: "binding",
      targetId: binding._id,
      targetBagId: binding.bagId || "",
      targetBagNo: binding.bagNo || "",
      before: {
        status: beforeStatus || "",
      },
      after: {
        status: afterStatus || "",
      },
      note: `${note || ""}`.trim(),
      createdAt: now,
    },
  });
};

const buildStatusUpdateData = (status, now) => {
  const data = {
    status,
    updatedAt: now,
  };

  if (status === "pending") {
    data.lockedAt = null;
  } else if (status !== "cancelled") {
    data.lockedAt = now;
  }

  if (status === "locked") {
    data.lockDeadlineAt = now;
  }

  if (status === "cancelled") {
    data.cancelledAt = now;
  }

  return data;
};

exports.main = async (event = {}) => {
  try {
    const actorOpenid = await assertAdmin();

    if (!event.bindingId) {
      return fail("bindingId is required");
    }
    if (!BINDING_STATUSES.includes(event.status)) {
      return fail("Invalid binding status");
    }

    const now = new Date();
    const data = buildStatusUpdateData(event.status, now);

    if (event.status === "cancelled") {
      const result = await db.runTransaction(async (transaction) => {
        const bindingResult = await transaction.collection("bindings").doc(event.bindingId).get();
        const binding = bindingResult.data;
        if (!binding) {
          return fail("Binding not found");
        }

        const beforeStatus = binding.status;

        let remainingWeight = null;
        let bagStatus = null;

        if (binding.status !== "cancelled" && binding.bagId) {
          const bagResult = await transaction.collection("bags").doc(binding.bagId).get();
          const bag = bagResult.data;
          const requestedWeight = Number(binding.requestedWeight || 0);

          if (bag && Number.isFinite(requestedWeight)) {
            const currentRemaining = Number(bag.remainingWeight || 0);
            const totalWeight = Number(bag.totalWeight || 0);
            const isFullCase = binding.spaceType === "fullCase" || bag.spaceType === "fullCase";
            const totalCases = Number(bag.caseCount || 0);
            const currentRemainingCases = Number(bag.remainingCases || 0);
            const requestedCases = Number(binding.requestedCases || (isFullCase ? 1 : 0));
            const nextRemainingCases = isFullCase
              ? Math.min(
                  Number.isInteger(totalCases) && totalCases > 0
                    ? totalCases
                    : currentRemainingCases + requestedCases,
                  currentRemainingCases + requestedCases
                )
              : 0;
            remainingWeight = Math.round((currentRemaining + requestedWeight) * 100) / 100;
            if (Number.isFinite(totalWeight) && totalWeight > 0) {
              remainingWeight = Math.min(totalWeight, remainingWeight);
            }
            if (isFullCase) {
              remainingWeight = nextRemainingCases * 23;
            }

            if (["active", "locked"].includes(bag.status)) {
              bagStatus = isFullCase
                ? nextRemainingCases > 0
                  ? "active"
                  : "locked"
                : remainingWeight > 0
                  ? "active"
                  : "locked";
              await transaction.collection("bags").doc(binding.bagId).update({
                data: {
                  remainingWeight,
                  remainingCases: nextRemainingCases,
                  status: bagStatus,
                  updatedAt: now,
                },
              });
            }
          }
        }

        await transaction.collection("bindings").doc(event.bindingId).update({
          data,
        });

        return {
          success: true,
          data: {
            bindingId: event.bindingId,
            status: event.status,
            updatedAt: now,
            remainingWeight,
            bagStatus,
          },
          audit: {
            binding,
            beforeStatus,
          },
        };
      });

      if (result.success && result.audit) {
        await writeAuditLog({
          actorOpenid,
          binding: result.audit.binding,
          beforeStatus: result.audit.beforeStatus,
          afterStatus: event.status,
          note: event.note,
          now,
        });
        delete result.audit;
      }

      return result;
    }

    const bindingResult = await db.collection("bindings").doc(event.bindingId).get();
    const binding = bindingResult.data;
    if (!binding) {
      return fail("Binding not found");
    }

    await db.collection("bindings").doc(event.bindingId).update({ data });

    await writeAuditLog({
      actorOpenid,
      binding,
      beforeStatus: binding.status,
      afterStatus: event.status,
      note: event.note,
      now,
    });

    return {
      success: true,
      data: {
        bindingId: event.bindingId,
        status: event.status,
        updatedAt: now,
      },
    };
  } catch (error) {
    return fail(error.message || "adminUpdateBindingStatus failed");
  }
};
