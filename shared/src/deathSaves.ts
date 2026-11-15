import type { DeathState } from "./events.js";

export type DeathSaveCounters = {
  deathState: DeathState;
  deathSaveSuccesses: number;
  deathSaveFailures: number;
};

export function emptyDeathSaves(): DeathSaveCounters {
  return { deathState: "ok", deathSaveSuccesses: 0, deathSaveFailures: 0 };
}

export function enterDying(): DeathSaveCounters {
  return { deathState: "dying", deathSaveSuccesses: 0, deathSaveFailures: 0 };
}

export function stabilizeDeathSaves(): DeathSaveCounters {
  return { deathState: "stable", deathSaveSuccesses: 3, deathSaveFailures: 0 };
}

export function markDead(): DeathSaveCounters {
  return { deathState: "dead", deathSaveSuccesses: 0, deathSaveFailures: 3 };
}

export function applyDeathSaveRoll(
  current: DeathSaveCounters,
  d20: number,
): DeathSaveCounters & { outcome: "success" | "fail" | "critical_success" | "critical_fail" } {
  if (current.deathState !== "dying") {
    return { ...current, outcome: "fail" };
  }

  if (d20 === 1) {
    const failures = Math.min(3, current.deathSaveFailures + 2);
    if (failures >= 3) {
      return { ...markDead(), outcome: "critical_fail" };
    }
    return {
      deathState: "dying",
      deathSaveSuccesses: current.deathSaveSuccesses,
      deathSaveFailures: failures,
      outcome: "critical_fail",
    };
  }

  if (d20 === 20) {
    return {
      deathState: "ok",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      outcome: "critical_success",
    };
  }

  if (d20 >= 10) {
    const successes = Math.min(3, current.deathSaveSuccesses + 1);
    if (successes >= 3) {
      return { ...stabilizeDeathSaves(), outcome: "success" };
    }
    return {
      deathState: "dying",
      deathSaveSuccesses: successes,
      deathSaveFailures: current.deathSaveFailures,
      outcome: "success",
    };
  }

  const failures = Math.min(3, current.deathSaveFailures + 1);
  if (failures >= 3) {
    return { ...markDead(), outcome: "fail" };
  }
  return {
    deathState: "dying",
    deathSaveSuccesses: current.deathSaveSuccesses,
    deathSaveFailures: failures,
    outcome: "fail",
  };
}

export function deathSavesAfterHpChange(
  previous: DeathSaveCounters & { hpCurrent: number | null },
  nextHpCurrent: number | null,
  options?: { damageWhileDying?: number; hpMax?: number | null },
): DeathSaveCounters {
  const wasDown =
    previous.deathState === "dying" ||
    previous.deathState === "stable" ||
    previous.deathState === "dead" ||
    (previous.hpCurrent !== null && previous.hpCurrent <= 0);
  const nowDown = nextHpCurrent !== null && nextHpCurrent <= 0;
  const nowUp = nextHpCurrent !== null && nextHpCurrent > 0;

  if (nowUp) {
    return emptyDeathSaves();
  }

  if (!nowDown) {
    return {
      deathState: previous.deathState === "ok" ? "ok" : previous.deathState,
      deathSaveSuccesses: previous.deathSaveSuccesses,
      deathSaveFailures: previous.deathSaveFailures,
    };
  }

  if (previous.deathState === "dead") {
    return markDead();
  }

  if (previous.deathState === "dying") {
    const damage = options?.damageWhileDying ?? 0;
    if (damage > 0) {
      const hpMax = options?.hpMax ?? null;
      if (hpMax !== null && damage >= hpMax) {
        return markDead();
      }
      const failures = Math.min(3, previous.deathSaveFailures + 1);
      if (failures >= 3) {
        return markDead();
      }
      return {
        deathState: "dying",
        deathSaveSuccesses: previous.deathSaveSuccesses,
        deathSaveFailures: failures,
      };
    }
    return {
      deathState: "dying",
      deathSaveSuccesses: previous.deathSaveSuccesses,
      deathSaveFailures: previous.deathSaveFailures,
    };
  }

  if (previous.deathState === "stable" && (options?.damageWhileDying ?? 0) > 0) {
    return enterDying();
  }

  if (!wasDown || previous.deathState === "ok") {
    return enterDying();
  }

  return {
    deathState: previous.deathState,
    deathSaveSuccesses: previous.deathSaveSuccesses,
    deathSaveFailures: previous.deathSaveFailures,
  };
}
