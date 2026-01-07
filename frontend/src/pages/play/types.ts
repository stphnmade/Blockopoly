export type ServerCardType = "GENERAL_ACTION" | "RENT_ACTION" | "PROPERTY" | "MONEY";

export type ServerCard = {
  id: number;
  type: ServerCardType;
  value?: number;
  actionType?: string;
  colors?: string[];
};

export type RentColorOption = {
  color: string;
  setIds: string[];
};

export type DealTargetEntry = {
  card: ServerCard;
  ownerId: string;
  setId: string;
  setColor: string | null;
};

export type PropertySetView = {
  id: string;
  color: string | null;
  isComplete: boolean;
  properties: ServerCard[];
  hasHouse?: boolean;
  hasHotel?: boolean;
};

export type PositioningCard = {
  card: ServerCard;
  fromSetId: string;
};

export type PositioningTargets = {
  existing: PropertySetView[];
  newColors: string[];
  isRainbow: boolean;
};

export type PositioningTarget = {
  toSetId: string;
  toColor?: string | null;
} | null;
