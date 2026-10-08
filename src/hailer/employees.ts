import type { Activity, ActivityCreateOptions, HailerApi } from '@hailer/app-sdk';

/**
 * Workspace users who must NOT be added to discussions.
 * Robert Broman, Nico Larsen, Bot Botinen. Edit this list to change who is skipped.
 */
export const EXCLUDED_USER_IDS = new Set<string>([
  '68a2bea86cc0abe93f8a3506', // Robert Broman
  '5579d000a9bbb6895dbcc74e', // Nico Larsen
  '6a1423d4cfcc9eb20cb4b816', // Bot Botinen
]);

/**
 * Every activity has a discussion. Followers of an activity are participants of
 * its discussion, so following every workspace user = adding all employees to
 * every discussion this app creates.
 *
 * The user list is read live from the workspace, so new hires are picked up
 * automatically (minus EXCLUDED_USER_IDS).
 */
let cached: { workspaceId: string; ids: Promise<string[]> } | null = null;

export function getAllEmployeeIds(hailer: HailerApi): Promise<string[]> {
  const workspaceId = hailer.info().workspaceId || '';
  if (cached && cached.workspaceId === workspaceId) return cached.ids;
  const ids = hailer.user
    .list()
    .then(users => users.map(u => u._id).filter(id => !EXCLUDED_USER_IDS.has(id)))
    .catch(error => {
      cached = null; // don't cache failures
      console.error('Could not list workspace users', error);
      return [] as string[];
    });
  cached = { workspaceId, ids };
  return ids;
}

/** Merge all employees into an activity.create options object (keeps any followers already requested). */
export async function withAllEmployees(
  hailer: HailerApi,
  options: ActivityCreateOptions = {},
): Promise<ActivityCreateOptions> {
  const employees = await getAllEmployeeIds(hailer);
  const followerIds = Array.from(new Set([...(options.followerIds ?? []), ...employees]));
  return { ...options, followerIds };
}

/**
 * Add every employee (or only `onlyUserIds`, for workflows that should be restricted)
 * as follower/discussion member of already-created activities. Never throws.
 */
export async function addAllEmployees(
  hailer: HailerApi,
  activityIds: Array<string | undefined | null>,
  onlyUserIds?: string[],
): Promise<void> {
  const ids = activityIds.filter((id): id is string => !!id);
  if (!ids.length) return;
  const employees = onlyUserIds ?? (await getAllEmployeeIds(hailer));
  if (!employees.length) return;
  const followers = Object.fromEntries(employees.map(id => [id, true as const]));
  try {
    await hailer.activity.update(ids.map(_id => ({ _id })), { followers });
  } catch (error) {
    console.error('Could not add employees to activity discussion', error);
  }
}

type NewActivity = Parameters<HailerApi['activity']['create']>[1][number];

/** hailer.activity.create + all employees as followers. Drop-in replacement. */
export async function createActivities(
  hailer: HailerApi,
  workflowId: string,
  items: NewActivity[],
  options: ActivityCreateOptions = {},
): Promise<Activity[]> {
  return hailer.activity.create(workflowId, items, await withAllEmployees(hailer, options));
}

/**
 * hailer.ui.activity.create (native dialog — it can't take followerIds) and then
 * add all employees to the created activity once the dialog resolves.
 */
export async function createActivityViaDialog(
  hailer: HailerApi,
  workflowId: string,
  options?: Parameters<HailerApi['ui']['activity']['create']>[1],
  onlyUserIds?: string[],
) {
  const created = await hailer.ui.activity.create(workflowId, options);
  if (created?._id) await addAllEmployees(hailer, [created._id], onlyUserIds);
  return created;
}
