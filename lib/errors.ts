export type CapabilityType = "skill" | "tool";

/** Thrown whenever execution tries to invoke a disabled Skill/Tool — even via a direct manual call. */
export class CapabilityDisabledError extends Error {
  capabilityType: CapabilityType;
  capabilityId: string;
  capabilityName: string;

  constructor(
    capabilityType: CapabilityType,
    capabilityId: string,
    capabilityName: string,
  ) {
    const label = capabilityType === "skill" ? "Skill" : "Tool";
    super(`${label}「${capabilityName}」当前已被禁用,拒绝执行。`);
    this.name = "CapabilityDisabledError";
    this.capabilityType = capabilityType;
    this.capabilityId = capabilityId;
    this.capabilityName = capabilityName;
  }
}

export class CapabilityNotFoundError extends Error {
  capabilityType: CapabilityType;
  capabilityId: string;

  constructor(capabilityType: CapabilityType, capabilityId: string) {
    const label = capabilityType === "skill" ? "Skill" : "Tool";
    super(`未找到 ${label}:${capabilityId}`);
    this.name = "CapabilityNotFoundError";
    this.capabilityType = capabilityType;
    this.capabilityId = capabilityId;
  }
}
