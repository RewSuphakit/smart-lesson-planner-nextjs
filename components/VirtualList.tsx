'use client';

import React, { useRef, useMemo, useState, useEffect, ReactNode } from 'react';
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';

export type BreakpointColumns = {
  default?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

export interface VirtualListProps<T> {
  /** ข้อมูลชุดที่ต้องการนำมาแสดงผล */
  items: T[];
  /** ฟังก์ชันสำหรับเรนเดอร์แต่ละรายการ */
  renderItem: (item: T, index: number) => ReactNode;
  /** ความสูงโดยประมาณของแต่ละรายการ (px) ค่าเริ่มต้น: 72 */
  estimateSize?: number;
  /** จำนวนรายการที่เรนเดอร์เตรียมไว้ล่วงหน้าเหนือ/ใต้ขอบจอ ค่าเริ่มต้น: 5 */
  overscan?: number;
  /** ฟังก์ชันดึง Unique Key ของแต่ละไอเทม (ถ้าไม่ระบุจะใช้ index) */
  getItemKey?: (item: T, index: number) => string | number;
  /** ความสูงของ Container เช่น '500px', '70vh', 'calc(100vh - 280px)' (ใช้เมื่อ useWindowScroll เป็น false) ค่าเริ่มต้น: '600px' */
  height?: string | number;
  /** ระยะห่างระหว่างรายการ/แถว (px) เช่น 8, 12, 16 ค่าเริ่มต้น: 0 */
  gap?: number;
  /** จำนวนคอลัมน์: กำหนดเป็นตัวเลขเดี่ยว (เช่น 2) หรือ Responsive Object (เช่น { default: 1, xl: 2 }) */
  columns?: number | BreakpointColumns;
  /** ให้เลื่อนตาม Scrollbar หลักของหน้าเว็บ (Window) แทนที่จะมี Scrollbar แยกเฉพาะของ Container ค่าเริ่มต้น: false */
  useWindowScroll?: boolean;
  /** Custom ClassName สำหรับ Outer Scroll Container */
  className?: string;
  /** Custom ClassName สำหรับ Item wrapper */
  itemClassName?: string;
  /** UI ที่ต้องการแสดงเมื่อ items ว่างเปล่า */
  emptyState?: ReactNode;
  /** คลาสของ Scrollbar (ถ้าต้องการแต่งเพิ่ม) */
  scrollClassName?: string;
}

/**
 * VirtualList — Reusable Component สำหรับแสดงผลชุดข้อมูลขนาดใหญ่ด้วย Virtual Scrolling (@tanstack/react-virtual)
 * รองรับทั้ง List (1 คอลัมน์) และ Grid (หลายคอลัมน์ แบบ Responsive) พร้อมทั้ง Dynamic Height Measurement
 */
export default function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 72,
  overscan = 5,
  getItemKey,
  height = '600px',
  gap = 0,
  columns = 1,
  useWindowScroll = false,
  className = '',
  itemClassName = '',
  emptyState = null,
  scrollClassName = '',
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // คำนวณจำนวนคอลัมน์ตาม Responsive Breakpoints
  const [resolvedColumns, setResolvedColumns] = useState<number>(() => {
    if (typeof columns === 'number') return Math.max(1, columns);
    return columns.default || 1;
  });

  useEffect(() => {
    if (typeof columns === 'number') {
      setResolvedColumns(Math.max(1, columns));
      return;
    }

    const calculateCols = () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (columns.xl && width >= 1280) return columns.xl;
      if (columns.lg && width >= 1024) return columns.lg;
      if (columns.md && width >= 768) return columns.md;
      if (columns.sm && width >= 640) return columns.sm;
      return columns.default || 1;
    };

    setResolvedColumns(calculateCols());

    const handleResize = () => setResolvedColumns(calculateCols());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns]);

  // กรณีเป็น Grid: รวม items ให้เป็นแถวละ N items
  const rowChunks = useMemo(() => {
    if (resolvedColumns <= 1) return null;
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += resolvedColumns) {
      chunks.push(items.slice(i, i + resolvedColumns));
    }
    return chunks;
  }, [items, resolvedColumns]);

  const rowCount = rowChunks ? rowChunks.length : items.length;

  // Window Virtualizer
  const windowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateSize + gap,
    overscan,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
    getItemKey: (index) => {
      if (rowChunks) {
        const firstItem = rowChunks[index]?.[0];
        return firstItem && getItemKey ? getItemKey(firstItem, index * resolvedColumns) : index;
      }
      return getItemKey ? getItemKey(items[index], index) : index;
    },
    enabled: useWindowScroll,
  });

  // Container Virtualizer
  const containerVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
    getItemKey: (index) => {
      if (rowChunks) {
        const firstItem = rowChunks[index]?.[0];
        return firstItem && getItemKey ? getItemKey(firstItem, index * resolvedColumns) : index;
      }
      return getItemKey ? getItemKey(items[index], index) : index;
    },
    enabled: !useWindowScroll,
  });

  if (!items || items.length === 0) {
    return <>{emptyState}</>;
  }

  const virtualizer = useWindowScroll ? windowVirtualizer : containerVirtualizer;
  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      className={`${useWindowScroll ? 'relative' : 'overflow-y-auto relative'} ${scrollClassName} ${className}`}
      style={
        useWindowScroll
          ? undefined
          : { height: typeof height === 'number' ? `${height}px` : height }
      }
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const translateY = useWindowScroll
            ? virtualRow.start - (virtualizer.options.scrollMargin ?? 0)
            : virtualRow.start;

          if (rowChunks) {
            // Render Grid Row
            const rowItems = rowChunks[rowIndex] || [];
            return (
              <div
                key={virtualRow.key}
                data-index={rowIndex}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${translateY}px)`,
                  paddingBottom: gap > 0 ? `${gap}px` : undefined,
                }}
              >
                <div
                  className={`grid gap-4 ${itemClassName}`}
                  style={{
                    gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
                  }}
                >
                  {rowItems.map((item, colIdx) => {
                    const actualIndex = rowIndex * resolvedColumns + colIdx;
                    return (
                      <div key={getItemKey ? getItemKey(item, actualIndex) : colIdx}>
                        {renderItem(item, actualIndex)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Render Single List Item
          const item = items[rowIndex];
          return (
            <div
              key={virtualRow.key}
              data-index={rowIndex}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${translateY}px)`,
                paddingBottom: gap > 0 ? `${gap}px` : undefined,
              }}
              className={itemClassName}
            >
              {renderItem(item, rowIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * useVirtualTable — Hook สำหรับทำ Virtualization บนตาราง HTML Table (<tbody>) โดยใช้ Spacer Pattern
 * ช่วยให้โครงสร้าง <table> / <thead> / <tbody> / <tr> / <td> เดิมคงอยู่ 100% คอลัมน์ไม่เลื่อน ไม่เพี้ยน
 */
export interface UseVirtualTableOptions<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
  useWindowScroll?: boolean;
}

export function useVirtualTable<T>({
  items,
  estimateSize = 52,
  overscan = 8,
  containerRef,
  useWindowScroll = true,
}: UseVirtualTableOptions<T>) {
  const windowVirtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin: containerRef?.current?.offsetTop ?? 0,
    enabled: useWindowScroll,
  });

  const containerVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef?.current ?? null,
    estimateSize: () => estimateSize,
    overscan,
    enabled: !useWindowScroll,
  });

  const virtualizer = useWindowScroll ? windowVirtualizer : containerVirtualizer;
  const virtualRows = virtualizer.getVirtualItems();

  const scrollMargin = useWindowScroll ? (virtualizer.options.scrollMargin ?? 0) : 0;
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? Math.max(0, virtualRows[0].start - scrollMargin) : 0;
  const paddingBottom = virtualRows.length > 0
    ? Math.max(0, totalSize - (virtualRows[virtualRows.length - 1].end - scrollMargin))
    : 0;

  const virtualItems = useMemo(() => {
    return virtualRows.map((virtualRow) => ({
      index: virtualRow.index,
      item: items[virtualRow.index],
      virtualRow,
    }));
  }, [virtualRows, items]);

  return {
    virtualItems,
    paddingTop,
    paddingBottom,
    totalSize,
    virtualizer,
  };
}
