const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const LOCK_WINDOW_MS = 2 * 60 * 60 * 1000;

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value.$date) {
    return new Date(value.$date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLockDeadline = (binding) => {
  const explicitDeadline = toDate(binding.lockDeadlineAt);
  if (explicitDeadline) {
    return explicitDeadline;
  }

  const createdAt = toDate(binding.createdAt);
  return createdAt ? new Date(createdAt.getTime() + LOCK_WINDOW_MS) : null;
};

const isEditable = (binding, now) => {
  const lockDeadlineAt = getLockDeadline(binding);
  return (
    binding.status === "pending" &&
    lockDeadlineAt &&
    lockDeadlineAt.getTime() > now.getTime()
  );
};

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const senderId = OPENID;
  const bindingId = `${event.bindingId || ""}`.trim();

  if (!senderId) {
    return fail("Unable to identify current user");
  }
  if (!bindingId) {
    return fail("bindingId is required");
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const bindingResult = await transaction.collection("bindings").doc(bindingId).get();
      const binding = bindingResult.data;
      const now = new Date();

      if (!binding) {
        return fail("Binding not found");
      }
      if (binding.senderId !== senderId) {
        return fail("No permission to cancel this binding");
      }

      const lockDeadlineAt = getLockDeadline(binding);
      if (!isEditable(binding, now)) {
        if (binding.status === "pending" && lockDeadlineAt) {
          await transaction.collection("bindings").doc(bindingId).update({
            data: {
              status: "locked",
              lockDeadlineAt,
              lockedAt: now,
              updatedAt: now,
            },
          });
        }
        return fail("This binding is locked and cannot be cancelled");
      }

      const bagResult = await transaction.collection("bags").doc(binding.bagId).get();
      const bag = bagResult.data;
      const requestedWeight = Number(binding.requestedWeight || 0);
      let remainingWeight = null;
      let bagStatus = null;

      if (bag && Number.isFinite(requestedWeight)) {
        const currentRemaining = Number(bag.remainingWeight || 0);
        const totalWeight = Number(bag.totalWeight || 0);
        const isFullCase = binding.spaceType === "fullCase" || bag.spaceType === "fullCase";
        const totalCases = Number(bag.caseCount || 0);
        const currentRemainingCases = Number(bag.remainingCases || 0);
        const requestedCases = Number(binding.requestedCases || (isFullCase ? 1 : 0));
        const nextRemainingCases = isFullCase
          ? Math.min(
              Number.isInteger(totalCases) && totalCases > 0 ? totalCases : currentRemainingCases + requestedCases,
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

      await transaction.collection("bindings").doc(bindingId).update({
        data: {
          status: "cancelled",
          lockDeadlineAt,
          cancelledAt: now,
          updatedAt: now,
        },
      });

      return {
        success: true,
        data: {
          bindingId,
          status: "cancelled",
          remainingWeight,
          bagStatus,
        },
      };
    });

    return result;
  } catch (error) {
    return fail(error.message || "cancelBinding failed");
  }
};
