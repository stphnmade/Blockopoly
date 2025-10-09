export type SetKey = string;

export interface CardVM {
  id: string;
  name: string;
  imageUrl?: string;
  setColors: string[];
  value?: number;
}

export interface PropertySetVM {
  key: SetKey;
  displayName: string;
  colorToken?: string;
  cards: CardVM[];
  isComplete: boolean;
}

export interface PlayerPropertyGridVM {
  sets: PropertySetVM[]; // first 10
  overflow: PropertySetVM[]; // remaining sets
}

export function indexToGrid(i: number) {
  return { row: Math.floor(i / 5), col: i % 5 };
}
