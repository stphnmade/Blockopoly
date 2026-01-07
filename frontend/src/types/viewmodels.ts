export type SetKey = string;

export interface CardVM {
  id: string;
  name: string;
  imageUrl?: string;
  setColors: string[];
  value?: number;
  isWild?: boolean;
  assignedColor?: string | null;
}

export interface PropertySetVM {
  key: SetKey;
  colorKey?: string;
  displayName: string;
  colorToken?: string;
  cards: CardVM[];
  isComplete: boolean;
  requiredCount?: number;
  currentCount?: number;
  rentValue?: number;
  overage?: number;
  hasHouse?: boolean;
  hasHotel?: boolean;
}

export interface PlayerPropertyGridVM {
  sets: PropertySetVM[]; // first 10
  overflow: PropertySetVM[]; // remaining sets
}

export function indexToGrid(i: number) {
  return { row: Math.floor(i / 5), col: i % 5 };
}
