export type ActionSfxKey =
  | "PASS_GO"
  | "JUST_SAY_NO"
  | "DEAL_BREAKER"
  | "DEBT_COLLECTOR"
  | "FORCED_DEAL"
  | "SLY_DEAL"
  | "BIRTHDAY"
  | "HOUSE"
  | "HOTEL"
  | "DOUBLE_RENT"
  | "WILD_RENT"
  | "RENT";

export const SFX_PASS_GO = "/sfx/pass_go.mp3";
export const SFX_JUST_SAY_NO = "/sfx/just_say_no.mp3";
export const SFX_DEAL_BREAKER = "/sfx/deal_breaker.mp3";
export const SFX_DEBT_COLLECTOR = "/sfx/debt_collector.mp3";
export const SFX_FORCED_DEAL = "/sfx/forced_deal.mp3";
export const SFX_SLY_DEAL = "/sfx/sly_deal.mp3";
export const SFX_BIRTHDAY = "/sfx/birthday.mp3";
export const SFX_HOUSE = "/sfx/house.mp3";
export const SFX_HOTEL = "/sfx/hotel.mp3";
export const SFX_DOUBLE_RENT = "/sfx/double_rent.mp3";
export const SFX_WILD_RENT = "/sfx/wild_rent.mp3";
export const SFX_RENT = "/sfx/rent.mp3";

export const SFX_ACTION_OVERLAY = "/sfx/action_overlay.mp3";
export const SFX_ACTION_GENERIC = "/sfx/action_generic.mp3";

export const ACTION_SFX_MAP: Record<ActionSfxKey, string> = {
  PASS_GO: SFX_PASS_GO,
  JUST_SAY_NO: SFX_JUST_SAY_NO,
  DEAL_BREAKER: SFX_DEAL_BREAKER,
  DEBT_COLLECTOR: SFX_DEBT_COLLECTOR,
  FORCED_DEAL: SFX_FORCED_DEAL,
  SLY_DEAL: SFX_SLY_DEAL,
  BIRTHDAY: SFX_BIRTHDAY,
  HOUSE: SFX_HOUSE,
  HOTEL: SFX_HOTEL,
  DOUBLE_RENT: SFX_DOUBLE_RENT,
  WILD_RENT: SFX_WILD_RENT,
  RENT: SFX_RENT,
};

const ACTION_SFX_ALIASES: Record<string, ActionSfxKey> = {
  DEALBREAKER: "DEAL_BREAKER",
  RENT_REQUEST: "RENT",
};

export const resolveActionSfx = (actionType?: string | null): string => {
  if (!actionType) return SFX_ACTION_GENERIC;
  const normalized = actionType.toUpperCase();
  const alias = ACTION_SFX_ALIASES[normalized] ?? (normalized as ActionSfxKey);
  return (ACTION_SFX_MAP as Record<string, string>)[alias] ?? SFX_ACTION_GENERIC;
};
