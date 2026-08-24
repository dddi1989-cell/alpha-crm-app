/**
 * Utility functions for recursive organization hierarchy resolution and filtering
 */

export function getDescendantOrgAndUserIds(selectedFilter, organizations = [], accessibleUsers = []) {
  if (!selectedFilter || selectedFilter === '') {
    return { isAll: true, orgIds: new Set(), orgNames: new Set(), userIds: new Set() };
  }

  const strFilter = String(selectedFilter).trim();

  // 1. User specific filter
  if (strFilter.startsWith('user:')) {
    const targetUid = Number(strFilter.replace('user:', ''));
    return {
      isAll: false,
      isUser: true,
      targetUserId: targetUid,
      orgIds: new Set(),
      orgNames: new Set(),
      userIds: new Set([targetUid])
    };
  }

  // 2. Organization filter (Match by ID or Name)
  const orgIds = new Set();
  const orgNames = new Set();

  const rootOrg = (organizations || []).find(
    (o) => String(o.id) === strFilter || String(o.name) === strFilter
  );

  if (rootOrg) {
    orgIds.add(Number(rootOrg.id));
    orgNames.add(rootOrg.name);
  } else {
    if (!isNaN(Number(strFilter))) {
      orgIds.add(Number(strFilter));
    }
    orgNames.add(strFilter);
  }

  // Recursively collect all descendant orgs from the tree
  let addedNew = true;
  let guard = 0;
  while (addedNew && guard < 50) {
    addedNew = false;
    guard++;
    for (const org of organizations || []) {
      if (org.parent_id && orgIds.has(Number(org.parent_id)) && !orgIds.has(Number(org.id))) {
        orgIds.add(Number(org.id));
        orgNames.add(org.name);
        addedNew = true;
      }
    }
  }

  // Collect all user IDs who belong to any of these descendant organizations
  const userIds = new Set();
  (accessibleUsers || []).forEach((u) => {
    if (u.id) {
      if (u.org_id && orgIds.has(Number(u.org_id))) {
        userIds.add(Number(u.id));
      } else if (u.org_name && orgNames.has(u.org_name)) {
        userIds.add(Number(u.id));
      }
    }
  });

  return {
    isAll: false,
    isUser: false,
    orgIds,
    orgNames,
    userIds
  };
}

/**
 * Check if a customer or schedule record matches the resolved hierarchy
 */
export function matchesOrgFilter(item, hierarchyInfo) {
  if (!item || !hierarchyInfo || hierarchyInfo.isAll) {
    return true;
  }

  const { isUser, targetUserId, orgIds, orgNames, userIds } = hierarchyInfo;

  if (isUser) {
    const ownerId = item.user_id !== null && item.user_id !== undefined ? Number(item.user_id) : null;
    return ownerId === targetUserId;
  }

  // 1. Check if owner user belongs to the target sub-organizations
  if (item.user_id !== null && item.user_id !== undefined) {
    if (userIds.has(Number(item.user_id))) {
      return true;
    }
  }

  // 2. Check if item's org_id belongs to the target sub-organizations
  if (item.org_id !== null && item.org_id !== undefined) {
    if (orgIds.has(Number(item.org_id))) {
      return true;
    }
  }

  // 3. Check if item's user_org_name belongs to the target sub-organizations
  if (item.user_org_name && orgNames.has(item.user_org_name)) {
    return true;
  }

  // 4. Check if item's org_name belongs to the target sub-organizations
  if (item.org_name && orgNames.has(item.org_name)) {
    return true;
  }

  return false;
}
