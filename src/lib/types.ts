export type Visibility = "open" | "invite_only";
export type Role = "owner" | "admin" | "member";
export type VoteAnswer = "yes" | "maybe" | "no";

export type Profile = { id: string; display_name: string; avatar_url: string | null };

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  tint: string;
  emoji: string | null;
};

export type Member = { user_id: string; role: Role; profiles: Profile | null };

export type Message = {
  id: string;
  group_id: string;
  event_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
};
