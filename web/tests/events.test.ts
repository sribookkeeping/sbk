import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { choreHiddenFrom, eventForMember, isExcludedFrom, visibleEvents } from "@/lib/events";
import { makeFamily, makeChore } from "./helpers";

describe("surprise events: exclusion + reveal (requirement: reveal for everyone)", () => {
  it("excluded members can't see the event until it is revealed", async () => {
    const { family, parents, kids } = await makeFamily();
    const event = await db.event.create({
      data: { familyId: family.id, title: "Kid1's party", excludedIds: kids[0].id },
    });

    expect(isExcludedFrom(event, kids[0].id)).toBe(true);
    expect(isExcludedFrom(event, parents[0].id)).toBe(false);

    expect(await eventForMember(event.id, kids[0])).toBeNull();
    expect(await eventForMember(event.id, parents[0])).not.toBeNull();

    const kidView = await visibleEvents(family.id, kids[0].id);
    expect(kidView.map((e) => e.id)).not.toContain(event.id);

    // Reveal → visible to the excluded member (and anyone added later)
    await db.event.update({ where: { id: event.id }, data: { revealedAt: new Date() } });
    const revealed = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(isExcludedFrom(revealed, kids[0].id)).toBe(false);
    expect(await eventForMember(event.id, kids[0])).not.toBeNull();

    const newMember = await db.member.create({
      data: { familyId: family.id, name: "New cousin", role: "CHILD" },
    });
    expect(await eventForMember(event.id, newMember)).not.toBeNull();
  });

  it("event chores are hidden from excluded members until reveal", async () => {
    const { family, parents, kids } = await makeFamily();
    const event = await db.event.create({
      data: { familyId: family.id, title: "Surprise", excludedIds: kids[0].id },
    });
    const chore = await makeChore(family.id, parents[0].id, {
      eventId: event.id,
      kind: "ONE_TIME",
    });
    const withEvent = await db.chore.findUniqueOrThrow({
      where: { id: chore.id },
      include: { event: true },
    });

    expect(choreHiddenFrom(withEvent, kids[0].id)).toBe(true);
    expect(choreHiddenFrom(withEvent, parents[1].id)).toBe(false);

    await db.event.update({ where: { id: event.id }, data: { revealedAt: new Date() } });
    const afterReveal = await db.chore.findUniqueOrThrow({
      where: { id: chore.id },
      include: { event: true },
    });
    expect(choreHiddenFrom(afterReveal, kids[0].id)).toBe(false);
  });
});
