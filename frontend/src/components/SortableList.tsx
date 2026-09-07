import type { HTMLAttributes, ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface DragHandle {
  /** Auf den Zieh-Griff spreaden: {...handle.dragProps} */
  dragProps: HTMLAttributes<HTMLElement>;
  isDragging: boolean;
}

function Row({
  id,
  children,
}: {
  id: number;
  children: (h: DragHandle) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const dragProps = {
    ...attributes,
    ...listeners,
  } as unknown as HTMLAttributes<HTMLElement>;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        position: "relative",
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {children({ dragProps, isDragging })}
    </div>
  );
}

/**
 * Generische, touch-taugliche Sortierliste.
 * activationConstraint.distance = 8 -> ein Tipp startet keinen Drag (DAU-Schutz).
 */
export function SortableList<T extends { id: number }>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (orderedIds: number[]) => void;
  children: (item: T, handle: DragHandle) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((it) => (
          <Row key={it.id} id={it.id}>
            {(h) => children(it, h)}
          </Row>
        ))}
      </SortableContext>
    </DndContext>
  );
}
