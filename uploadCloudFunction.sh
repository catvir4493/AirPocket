functions=(
  adminCheckAccess
  adminRequestAccess
  adminGetDashboard
  adminUpdateBagStatus
  adminUpdateBindingStatus
  getOpenId
  createBag
  getBags
  getBagDetail
  bindBag
  updateBinding
  cancelBinding
  updateBag
  getMyCarrierBags
  getMySenderBindings
)

for functionName in "${functions[@]}"; do
  ${installPath} cloud functions deploy --e ${envId} --n ${functionName} --r --project ${projectPath}
done
