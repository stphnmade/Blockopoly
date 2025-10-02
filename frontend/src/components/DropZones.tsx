import { useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";

type Props = { zoneId: string };

export function DroppableBind({ zoneId }: Props) {
  const { setNodeRef } = useDroppable({ id: zoneId });

  useEffect(() => {
    const el = document.getElementById(zoneId);
    if (el) setNodeRef(el as HTMLElement);
  }, [zoneId, setNodeRef]);

  return null;
}
