export type CanonicalMentionIdentity = {
  userId: string;
  displayName: string;
};

export type JobUpdateMentionSegment = {
  text: string;
  userId: string | null;
};

export function tokenizeJobUpdateMentionText(
  value: string,
  mentions: CanonicalMentionIdentity[],
): JobUpdateMentionSegment[] {
  if (!value) return [];

  const candidates = mentions
    .map((mention) => ({ ...mention, token: `@${mention.displayName}` }))
    .filter((mention) => mention.token.length > 1)
    .sort((left, right) => right.token.length - left.token.length);
  const segments: JobUpdateMentionSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const match = candidates
      .map((mention) => ({ ...mention, index: value.indexOf(mention.token, cursor) }))
      .filter((candidate) => candidate.index >= 0)
      .sort((left, right) => left.index - right.index || right.token.length - left.token.length)[0];

    if (!match) {
      segments.push({ text: value.slice(cursor), userId: null });
      break;
    }
    if (match.index > cursor) {
      segments.push({ text: value.slice(cursor, match.index), userId: null });
    }
    segments.push({ text: match.token, userId: match.userId });
    cursor = match.index + match.token.length;
  }

  return segments;
}

export function reconstructJobUpdateMentionText(segments: JobUpdateMentionSegment[]) {
  return segments.map((segment) => segment.text).join("");
}

export function retainCanonicalMentions(
  value: string,
  mentions: CanonicalMentionIdentity[],
) {
  return mentions.filter((mention) => value.includes(`@${mention.displayName}`));
}
