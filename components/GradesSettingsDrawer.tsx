'use client';

import { useState } from 'react';
import {
  Settings,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import toast from '@/lib/toast';

export interface Criterion {
  grade: string;
  min_score: number;
}

export interface Weights {
  assignment_weight: number;
  post_test_weight: number;
  affective_weight: number;
  midterm_weight: number;
  final_weight: number;
  midterm_max_score: number;
  final_max_score: number;
  target_weeks?: number;
  is_pws?: boolean;
  max_assign_raw?: number;
  max_post_test_raw?: number;
}

export interface GradesSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  weights: Weights;
  setWeights: React.Dispatch<React.SetStateAction<Weights>>;
  criteria: Criterion[];
  setCriteria: React.Dispatch<React.SetStateAction<Criterion[]>>;
  defaultCriteria: Criterion[];
  onSave: () => void;
  isSaving: boolean;
}

export default function GradesSettingsDrawer({
  isOpen,
  onClose,
  weights,
  setWeights,
  criteria,
  setCriteria,
  defaultCriteria,
  onSave,
  isSaving,
}: GradesSettingsDrawerProps) {
  if (!isOpen) return null;

  const totalWeightSum =
    Number(weights.assignment_weight || 0) +
    Number(weights.post_test_weight || 0) +
    Number(weights.affective_weight || 0) +
    Number(weights.midterm_weight || 0) +
    Number(weights.final_weight || 0);

  const isExact100 = totalWeightSum === 100;

  // Handle Criteria change
  const handleCriteriaChange = (index: number, field: keyof Criterion, value: string | number) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const addCriteriaRow = () => {
    setCriteria([...criteria, { grade: '', min_score: 0 }]);
  };

  const removeCriteriaRow = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  // Presets for weights
  const applyPreset = (preset: {
    affective: number;
    postTest: number;
    assignment: number;
    midterm: number;
    final: number;
  }) => {
    setWeights((prev) => ({
      ...prev,
      affective_weight: preset.affective,
      post_test_weight: preset.postTest,
      assignment_weight: preset.assignment,
      midterm_weight: preset.midterm,
      final_weight: preset.final,
    }));
    toast.success('à¸›à¸£à¸±à¸šà¸„à¹ˆà¸²à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸•à¸²à¸¡à¸£à¸¹à¸›à¹à¸šà¸šà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
  };

  // Auto-balance to 100% proportionally or fix delta
  const autoBalanceTo100 = () => {
    if (totalWeightSum === 0) {
      applyPreset({ affective: 20, postTest: 70, assignment: 10, midterm: 0, final: 0 });
      return;
    }

    const ratio = 100 / totalWeightSum;
    const balancedAffective = Math.round(Number(weights.affective_weight || 0) * ratio);
    const balancedAssignment = Math.round(Number(weights.assignment_weight || 0) * ratio);
    const balancedMidterm = Math.round(Number(weights.midterm_weight || 0) * ratio);
    const balancedFinal = Math.round(Number(weights.final_weight || 0) * ratio);
    // Let post_test take the remainder to guarantee exactly 100
    const remainder =
      100 - (balancedAffective + balancedAssignment + balancedMidterm + balancedFinal);
    const balancedPostTest = Math.max(0, remainder);

    setWeights((prev) => ({
      ...prev,
      affective_weight: balancedAffective,
      assignment_weight: balancedAssignment,
      midterm_weight: balancedMidterm,
      final_weight: balancedFinal,
      post_test_weight: balancedPostTest,
    }));
    toast.success('à¹€à¸‰à¸¥à¸µà¹ˆà¸¢à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¹ƒà¸«à¹‰à¸„à¸£à¸š 100% à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
  };

  const handleValidateAndSave = () => {
    if (totalWeightSum <= 0) {
      toast.error('à¸œà¸¥à¸£à¸§à¸¡à¸„à¹ˆà¸²à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸•à¹‰à¸­à¸‡à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 0%');
      return;
    }

    if (!isExact100) {
      const confirmSave = window.confirm(
        `à¸„à¸³à¹€à¸•à¸·à¸­à¸™: à¸œà¸¥à¸£à¸§à¸¡à¸„à¹ˆà¸²à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸„à¸·à¸­ ${totalWeightSum}% (à¹„à¸¡à¹ˆà¹€à¸—à¹ˆà¸²à¸à¸±à¸š 100%)\n` +
          `à¸£à¸°à¸šà¸šà¸ˆà¸°à¹ƒà¸Šà¹‰ ${totalWeightSum}% à¹€à¸›à¹‡à¸™à¸à¸²à¸™à¸«à¸²à¸£à¹€à¸‰à¸¥à¸µà¹ˆà¸¢à¸„à¸°à¹à¸™à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™\n\n` +
          `à¸„à¸¸à¸“à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?`
      );
      if (!confirmSave) return;
    }

    onSave();
  };

  return (
    <div className="glass dark:bg-slate-900/90 p-6 sm:p-7 rounded-3xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6 animate-fade-in-up shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸„à¸°à¹à¸™à¸™ & à¹€à¸à¸“à¸‘à¹Œà¸•à¸±à¸”à¹€à¸à¸£à¸”
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            à¸à¸³à¸«à¸™à¸”à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¸„à¸°à¹à¸™à¸™à¸£à¸§à¸¡ 100% à¹à¸¥à¸°à¸à¸³à¸«à¸™à¸”à¸Šà¹ˆà¸§à¸‡à¸„à¸°à¹à¸™à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸°à¸”à¸±à¸šà¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™
          </p>
        </div>
        <button
          onClick={onClose}
          className="btn bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs rounded-xl px-3.5 py-1.5"
        >
          à¸›à¸´à¸”
        </button>
      </div>

      {/* Real-Time Weight Balance Bar Section */}
      <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸„à¸°à¹à¸™à¸™ (à¸£à¸§à¸¡ 5 à¸ªà¹ˆà¸§à¸™à¸•à¹‰à¸­à¸‡à¹€à¸—à¹ˆà¸²à¸à¸±à¸š 100%)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              à¸£à¸°à¸šà¸šà¸ˆà¸°à¹à¸›à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¸”à¸´à¸šà¸ªà¸°à¸ªà¸¡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸™à¹‰à¸³à¸«à¸™à¸±à¸à¹€à¸›à¸­à¸£à¹Œà¹€à¸‹à¹‡à¸™à¸•à¹Œà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">à¸œà¸¥à¸£à¸§à¸¡:</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                isExact100
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {isExact100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
              )}
              {totalWeightSum}% / 100%
            </span>
          </div>
        </div>

        {/* Visual Warning Banner when totalWeightSum !== 100 */}
        {!isExact100 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  à¸œà¸¥à¸£à¸§à¸¡à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸„à¸·à¸­ {totalWeightSum}% (à¹„à¸¡à¹ˆà¹€à¸—à¹ˆà¸²à¸à¸±à¸š 100%)
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  à¹à¸™à¸°à¸™à¸³à¹ƒà¸«à¹‰à¸›à¸£à¸±à¸šà¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¸£à¸§à¸¡à¹ƒà¸«à¹‰à¹„à¸”à¹‰ 100% à¹€à¸žà¸·à¹ˆà¸­à¸„à¸§à¸²à¸¡à¹à¸¡à¹ˆà¸™à¸¢à¸³à¹ƒà¸™à¸à¸²à¸£à¹à¸›à¸¥à¸‡à¹€à¸à¸£à¸”à¸•à¸²à¸¡à¸£à¸°à¹€à¸šà¸µà¸¢à¸šà¸§à¸±à¸”à¸œà¸¥
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={autoBalanceTo100}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> à¸›à¸£à¸±à¸šà¹ƒà¸«à¹‰à¸„à¸£à¸š 100% à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
            </button>
          </div>
        )}

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-slate-500">à¸£à¸¹à¸›à¹à¸šà¸šà¹à¸™à¸°à¸™à¸³:</span>
          {weights.is_pws ? (
            <>
              <button
                type="button"
                onClick={() =>
                  applyPreset({ affective: 20, postTest: 60, assignment: 10, midterm: 0, final: 10 })
                }
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 transition-colors cursor-pointer"
              >
                à¸›à¸§à¸ª. à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸¥à¸²à¸‡à¸ à¸²à¸„ (20-60-10-0-10)
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({ affective: 20, postTest: 70, assignment: 10, midterm: 0, final: 0 })
                }
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 transition-colors cursor-pointer"
              >
                à¸›à¸§à¸ª. à¸›à¸à¸´à¸šà¸±à¸•à¸´à¸¥à¹‰à¸§à¸™ (20-70-10-0-0)
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  applyPreset({ affective: 20, postTest: 30, assignment: 20, midterm: 15, final: 15 })
                }
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 transition-colors cursor-pointer"
              >
                à¸›à¸§à¸Š. à¸¡à¸µà¸ªà¸­à¸šà¸à¸¥à¸²à¸‡à¸ à¸²à¸„ (20-30-20-15-15)
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({ affective: 20, postTest: 50, assignment: 20, midterm: 0, final: 10 })
                }
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 transition-colors cursor-pointer"
              >
                à¸›à¸§à¸Š. à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸­à¸šà¸à¸¥à¸²à¸‡à¸ à¸²à¸„ (20-50-20-0-10)
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({ affective: 20, postTest: 70, assignment: 10, midterm: 0, final: 0 })
                }
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 transition-colors cursor-pointer"
              >
                à¸¡à¸²à¸•à¸£à¸à¸²à¸™ à¸ªà¸­à¸¨. à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸ªà¸ à¸²à¸žà¸ˆà¸£à¸´à¸‡ (20-70-10-0-0)
              </button>
            </>
          )}
        </div>

        {/* Visual Weight Distribution Progress Bar */}
        <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.min(100, ((weights.affective_weight || 0) / 100) * 100)}%` }}
            className="bg-pink-500 transition-all"
            title={`à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ ${weights.affective_weight}%`}
          />
          <div
            style={{ width: `${Math.min(100, ((weights.post_test_weight || 0) / 100) * 100)}%` }}
            className="bg-amber-500 transition-all"
            title={`à¸ªà¸­à¸šà¸¢à¹ˆà¸­à¸¢ ${weights.post_test_weight}%`}
          />
          <div
            style={{ width: `${Math.min(100, ((weights.assignment_weight || 0) / 100) * 100)}%` }}
            className="bg-emerald-500 transition-all"
            title={`à¸‡à¸²à¸™à¹€à¸à¹‡à¸š ${weights.assignment_weight}%`}
          />
          <div
            style={{ width: `${Math.min(100, ((weights.midterm_weight || 0) / 100) * 100)}%` }}
            className="bg-cyan-500 transition-all"
            title={`à¸à¸¥à¸²à¸‡à¸ à¸²à¸„ ${weights.midterm_weight}%`}
          />
          <div
            style={{ width: `${Math.min(100, ((weights.final_weight || 0) / 100) * 100)}%` }}
            className="bg-blue-500 transition-all"
            title={`à¸›à¸¥à¸²à¸¢à¸ à¸²à¸„ ${weights.final_weight}%`}
          />
        </div>

        {/* Weight inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-white p-3 rounded-2xl border border-pink-100 shadow-xs">
            <label className="block text-[11px] font-bold text-pink-700 uppercase mb-1">
              à¸ˆà¸´à¸•à¸žà¸´à¸ªà¸±à¸¢ (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={weights.affective_weight}
              onChange={(e) =>
                setWeights({ ...weights, affective_weight: parseFloat(e.target.value) || 0 })
              }
              className="form-input text-center font-bold text-pink-800 text-sm py-1.5"
              placeholder="20"
            />
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-xs">
            <label className="block text-[11px] font-bold text-amber-700 uppercase mb-1">
              à¸ªà¸­à¸šà¸¢à¹ˆà¸­à¸¢ (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={weights.post_test_weight}
              onChange={(e) =>
                setWeights({ ...weights, post_test_weight: parseFloat(e.target.value) || 0 })
              }
              className="form-input text-center font-bold text-amber-800 text-sm py-1.5"
              placeholder="70"
            />
          </div>
          <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs">
            <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">
              à¸‡à¸²à¸™à¹€à¸à¹‡à¸š (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={weights.assignment_weight}
              onChange={(e) =>
                setWeights({ ...weights, assignment_weight: parseFloat(e.target.value) || 0 })
              }
              className="form-input text-center font-bold text-emerald-800 text-sm py-1.5"
              placeholder="10"
            />
          </div>
          <div className={`p-3 rounded-2xl border shadow-xs ${weights.is_pws ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-cyan-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-cyan-700 uppercase">
                à¸à¸¥à¸²à¸‡à¸ à¸²à¸„ (%)
              </label>
              {weights.is_pws && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1 rounded">à¸›à¸§à¸ª. à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸¥à¸²à¸‡à¸ à¸²à¸„</span>
              )}
            </div>
            <input
              type="number"
              min="0"
              max="100"
              disabled={weights.is_pws}
              value={weights.is_pws ? 0 : weights.midterm_weight}
              onChange={(e) =>
                setWeights({ ...weights, midterm_weight: parseFloat(e.target.value) || 0 })
              }
              className="form-input text-center font-bold text-cyan-800 text-sm py-1.5 disabled:bg-slate-100 disabled:cursor-not-allowed"
              placeholder="0"
            />
          </div>
          <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-xs">
            <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">
              à¸›à¸¥à¸²à¸¢à¸ à¸²à¸„ (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={weights.final_weight}
              onChange={(e) =>
                setWeights({ ...weights, final_weight: parseFloat(e.target.value) || 0 })
              }
              className="form-input text-center font-bold text-blue-800 text-sm py-1.5"
              placeholder="0"
            />
          </div>
        </div>

        {/* Max Scores for Exams */}
        <div className="pt-3 border-t border-indigo-100/60">
          <h5 className="font-bold text-slate-700 mb-2 text-xs">
            à¸à¸³à¸«à¸™à¸”à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡à¸ªà¸³à¸«à¸£à¸±à¸šà¸‚à¹‰à¸­à¸ªà¸­à¸š (à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸Šà¹‰à¹à¸›à¸¥à¸‡à¸­à¸±à¸•à¸£à¸²à¸ªà¹ˆà¸§à¸™)
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-indigo-100">
              <label className="text-xs font-semibold text-cyan-800 w-28 shrink-0">
                à¹€à¸•à¹‡à¸¡ à¸à¸¥à¸²à¸‡à¸ à¸²à¸„:
              </label>
              <input
                type="number"
                min="1"
                value={weights.midterm_max_score}
                onChange={(e) =>
                  setWeights({ ...weights, midterm_max_score: parseFloat(e.target.value) || 0 })
                }
                className="form-input text-center font-bold text-slate-800 flex-1 py-1 text-xs"
                placeholder="100"
              />
            </div>
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-indigo-100">
              <label className="text-xs font-semibold text-blue-800 w-28 shrink-0">
                à¹€à¸•à¹‡à¸¡ à¸›à¸¥à¸²à¸¢à¸ à¸²à¸„:
              </label>
              <input
                type="number"
                min="1"
                value={weights.final_max_score}
                onChange={(e) =>
                  setWeights({ ...weights, final_max_score: parseFloat(e.target.value) || 0 })
                }
                className="form-input text-center font-bold text-slate-800 flex-1 py-1 text-xs"
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Criteria Settings Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">à¹€à¸à¸“à¸‘à¹Œà¸„à¸°à¹à¸™à¸™à¸‚à¸±à¹‰à¸™à¸•à¹ˆà¸³ (%) à¸ªà¸³à¸«à¸£à¸±à¸šà¹à¸•à¹ˆà¸¥à¸°à¸£à¸°à¸”à¸±à¸šà¹€à¸à¸£à¸”</h4>
            <p className="text-xs text-slate-500">à¹€à¸£à¸µà¸¢à¸‡à¸ˆà¸²à¸à¸„à¸°à¹à¸™à¸™à¸ªà¸¹à¸‡à¸¥à¸‡à¸¡à¸²à¸•à¹ˆà¸³</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setCriteria([
                  { grade: 'A', min_score: 80 },
                  { grade: 'B+', min_score: 75 },
                  { grade: 'B', min_score: 70 },
                  { grade: 'C+', min_score: 65 },
                  { grade: 'C', min_score: 60 },
                  { grade: 'D+', min_score: 55 },
                  { grade: 'D', min_score: 50 },
                  { grade: 'F', min_score: 0 },
                ])
              }
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200 cursor-pointer"
            >
              à¹ƒà¸Šà¹‰à¹€à¸à¸£à¸”à¸­à¸±à¸à¸©à¸£ (A-F)
            </button>
            <button
              type="button"
              onClick={() => setCriteria([...defaultCriteria])}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer"
            >
              à¹ƒà¸Šà¹‰à¹€à¸à¸£à¸”à¸•à¸±à¸§à¹€à¸¥à¸‚ (4-0)
            </button>
          </div>
        </div>

        <div className="space-y-2 max-w-lg mb-6">
          {criteria.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2.5 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200/80"
            >
              <div className="col-span-5">
                <input
                  type="text"
                  value={c.grade}
                  onChange={(e) => handleCriteriaChange(i, 'grade', e.target.value)}
                  className="form-input py-1.5 text-center font-bold text-slate-800 text-xs rounded-xl"
                  placeholder="à¹€à¸Šà¹ˆà¸™ 4, A"
                />
              </div>
              <div className="col-span-5 flex items-center gap-2">
                <span className="text-slate-500 text-xs shrink-0 font-bold">â‰¥</span>
                <input
                  type="number"
                  value={c.min_score}
                  onChange={(e) => handleCriteriaChange(i, 'min_score', e.target.value)}
                  className="form-input py-1.5 font-semibold text-slate-800 text-xs rounded-xl"
                  min="0"
                  max="100"
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => removeCriteriaRow(i)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addCriteriaRow}
            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-bold p-2 rounded-xl hover:bg-indigo-50 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> à¹€à¸žà¸´à¹ˆà¸¡à¸£à¸°à¸”à¸±à¸šà¹€à¸à¸£à¸”
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleValidateAndSave}
            disabled={isSaving}
            className="btn btn-primary rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            à¸šà¸±à¸™à¸—à¸¶à¸à¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs cursor-pointer"
          >
            à¸¢à¸à¹€à¸¥à¸´à¸
          </button>
        </div>
      </div>
    </div>
  );
}

