export type MessageTextPart = { text: string; href?: string };

/** Link only the application's invitation paths; all other message content stays plain text. */
export function invitationMessageParts(body: string): MessageTextPart[] {
  const pattern = /(^|[\s(["'])\/job-invitations\/([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})(?=$|[\s)\]"'.,!;:])/gi;
  const parts: MessageTextPart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(pattern)) {
    const start = match.index! + match[1].length;
    if (start > cursor) parts.push({ text: body.slice(cursor, start) });
    parts.push({ text: "View invitation", href: `/job-invitations/${match[2]}` });
    cursor = match.index! + match[0].length;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor) });
  return parts;
}
