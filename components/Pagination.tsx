'use client';
// @ts-nocheck
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Pagination — Reusable pagination component
 * @param {number} currentPage - หน้าปัจจุบัน (1-indexed)
 * @param {number} totalItems - จำนวนรายการทั้งหมด
 * @param {number} itemsPerPage - จำนวนรายการต่อหน้า
 * @param {function} onPageChange - callback เมื่อเปลี่ยนหน้า
 * @param {number[]} pageSizeOptions - ตัวเลือกจำนวนต่อหน้า (optional)
 * @param {function} onPageSizeChange - callback เมื่อเปลี่ยนจำนวนต่อหน้า (optional)
 */
export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  pageSizeOptions = [10, 25, 50],
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Clamp current page
  const page = Math.min(Math.max(1, currentPage), totalPages);

  // Build visible page numbers (max 5 buttons)
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (totalItems <= itemsPerPage && !onPageSizeChange) return null;

  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      {/* Info */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          แสดง {startItem}-{endItem} จาก {totalItems} รายการ
        </span>
        {onPageSizeChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-white border border-indigo-200/40 text-slate-600 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / หน้า
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Page Buttons */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="หน้าแรก"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="หน้าก่อน"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 ${
              p === page
                ? 'bg-indigo-100 text-indigo-600 border border-indigo-300/50 shadow-sm shadow-indigo-200/30'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {p}
          </button>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="หน้าถัดไป"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="หน้าสุดท้าย"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
