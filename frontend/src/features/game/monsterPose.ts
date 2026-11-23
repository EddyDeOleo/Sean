/**
 * Clean-pose bookkeeping for the monster's skeleton. The mixer writes each clip's pose onto the bones, and the procedural
 * attack and arm lift are added on top of it. The clip pose is recorded before those offsets, and restored before every
 * mixer update and before the caught close-up. Without this, the offsets compound from frame to frame.
 */
import * as THREE from "three";

/** The clip pose of every bone, by skeleton index. */
export type PoseSnapshot = THREE.Quaternion[];

/** Records the bones' current rotations, so they can be written back later. */
export function snapshotPose(bones: readonly THREE.Bone[]): PoseSnapshot {
  return bones.map((bone) => bone.quaternion.clone());
}

/** Writes a recorded pose back onto the bones. Bones beyond the snapshot are left as they are. */
export function restorePose(bones: readonly THREE.Bone[], pose: PoseSnapshot): void {
  const count = Math.min(bones.length, pose.length);
  for (let i = 0; i < count; i += 1) bones[i]!.quaternion.copy(pose[i]!);
}

/** Adds an Euler rotation (x, y, z, in radians) on top of a bone's current rotation, in its own frame. */
export function addBoneOffset(bone: THREE.Bone, [x, y, z]: readonly [number, number, number]): void {
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")));
}

/** Finds a bone by name. Three.js removes dots from node names when it loads a GLTF, so the sanitised name is tried too. */
export function findBone(skeleton: THREE.Skeleton, name: string): THREE.Bone | null {
  return skeleton.getBoneByName(name) ?? skeleton.getBoneByName(name.replace(/\./g, "")) ?? null;
}

/**
 * Turns each named bone from its current rotation toward a target local rotation (x, y, z, w), by `weight` from 0 (unchanged)
 * to 1 (the target), with a spherical interpolation. Call it after poseWithOffsets, which restores the clip pose first, so the
 * result depends only on this frame's inputs.
 */
export function slerpBonesTowards(
  skeleton: THREE.Skeleton,
  targets: Readonly<Record<string, readonly [number, number, number, number]>>,
  weight: number,
): void {
  const target = new THREE.Quaternion();
  for (const [name, [x, y, z, w]] of Object.entries(targets)) {
    const bone = findBone(skeleton, name);
    if (bone) bone.quaternion.slerp(target.set(x, y, z, w).normalize(), weight);
  }
}

/**
 * Sets the skeleton to the clean clip pose plus the given offsets, by bone name. The clean pose is written first, so the result
 * depends only on this call's inputs. Calling it again with the same inputs gives the same pose, and offsets never accumulate.
 */
export function poseWithOffsets(
  skeleton: THREE.Skeleton,
  clipPose: PoseSnapshot,
  offsets: Readonly<Record<string, readonly [number, number, number]>>,
): void {
  restorePose(skeleton.bones, clipPose);
  for (const [name, angles] of Object.entries(offsets)) {
    const bone = findBone(skeleton, name);
    if (bone) addBoneOffset(bone, angles);
  }
}
