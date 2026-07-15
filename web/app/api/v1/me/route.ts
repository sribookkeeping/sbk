import { json, serializeMember, withAuth } from "@/lib/api";

/** GET → current member + family roster. */
export const GET = withAuth(async (member) => {
  return json({
    member: serializeMember(member),
    family: {
      id: member.family.id,
      name: member.family.name,
      members: member.family.members.map(serializeMember),
    },
  });
});
