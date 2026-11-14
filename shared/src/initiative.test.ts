import { describe, expect, it } from "vitest";
import { compareInitiativeEntries, rollInitiative, sortInitiativeEntries } from "./initiative.js";

describe("compareInitiativeEntries", () => {
  it("sorts by initiative desc, then bonus desc, then name asc", () => {
    const entries = [
      { initiative: 15, bonus: 1, label: "Zed" },
      { initiative: 15, bonus: 2, label: "Ann" },
      { initiative: 18, bonus: 0, label: "Bob" },
      { initiative: 15, bonus: 1, label: "Ada" },
    ];
    const sorted = sortInitiativeEntries(entries);
    expect(sorted.map((entry) => entry.label)).toEqual(["Bob", "Ann", "Ada", "Zed"]);
  });

  it("compares two entries directly", () => {
    expect(
      compareInitiativeEntries(
        { initiative: 10, bonus: 3, label: "A" },
        { initiative: 10, bonus: 1, label: "B" },
      ),
    ).toBeLessThan(0);
  });
});

describe("rollInitiative", () => {
  it("rolls 1d20+bonus and sorts with tie-break", () => {
    const values = [0.95, 0.45, 0.45];
    let index = 0;
    const random = () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    };

    const result = rollInitiative(
      [
        { tokenId: "t1", label: "Goblin", initiativeBonus: 2, kind: "npc" },
        { tokenId: "t2", label: "Zed", initiativeBonus: 0, kind: "pc" },
        { tokenId: "t3", label: "Ann", initiativeBonus: 4, kind: "pc" },
      ],
      random,
    );

    expect(result.map((entry) => ({ label: entry.label, initiative: entry.initiative, die: entry.die }))).toEqual([
      { label: "Goblin", initiative: 22, die: 20 },
      { label: "Ann", initiative: 14, die: 10 },
      { label: "Zed", initiative: 10, die: 10 },
    ]);
  });

  it("supports negative bonuses", () => {
    const result = rollInitiative(
      [{ tokenId: "t1", label: "Slug", initiativeBonus: -1, kind: "npc" }],
      () => 0.5,
    );
    expect(result[0]).toMatchObject({ die: 11, initiative: 10, bonus: -1 });
  });
});
