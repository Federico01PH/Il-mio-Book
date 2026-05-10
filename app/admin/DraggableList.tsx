'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface DraggableItem {
  id: string;
}

interface Props<T extends DraggableItem> {
  items: T[];
  type: 'folder' | 'photo';
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export default function DraggableList<T extends DraggableItem>({
  items: initialItems,
  type,
  renderItem,
  className
}: Props<T>) {
  const router = useRouter();
  const [items, setItems] = useState<T[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const dragIndex = useRef<number | null>(null);

  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    setItems(next);
  }

  async function onDragEnd() {
    dragIndex.current = null;
    setSaving(true);
    try {
      await fetch('/api/admin/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, orderedIds: items.map((i) => i.id) })
      });
      router.refresh();
    } catch (e) {
      console.error('[DraggableList] reorder failed:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      {saving && (
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-white/50 animate-pulse">
          Salvataggio ordine…
        </p>
      )}
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => onDragStart(index)}
          onDragOver={(e) => onDragOver(e, index)}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity"
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
